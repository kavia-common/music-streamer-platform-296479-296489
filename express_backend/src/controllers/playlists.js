const { ensureTablesExist } = require('../utils/schemaInit');

class PlaylistsController {
  /**
   * Create a new playlist for the authenticated user
   * Uses the user-scoped Supabase client from req.supabase to ensure RLS policies work correctly
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async createPlaylist(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { name, description, is_public } = req.body;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Playlist name is required and must be a non-empty string' 
        });
      }

      if (name.length > 100) {
        return res.status(400).json({ 
          error: 'Playlist name must be 100 characters or less' 
        });
      }

      // Validate optional description
      if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ 
          error: 'Description must be a string' 
        });
      }

      // Validate optional is_public
      if (is_public !== undefined && typeof is_public !== 'boolean') {
        return res.status(400).json({ 
          error: 'is_public must be a boolean' 
        });
      }

      // Verify profile exists - using user-scoped client so RLS applies
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Profile lookup error:', profileError);
        return res.status(404).json({ 
          error: 'User profile not found',
          details: 'Please ensure your profile is set up correctly. Profile must exist before creating playlists.'
        });
      }

      // Create the playlist with owner_id = auth.uid() (userId)
      // The user-scoped client ensures auth.uid() is available to RLS
      const { data: playlist, error: insertError } = await supabase
        .from('playlists')
        .insert([
          {
            owner_id: userId, // This must match auth.uid() for RLS policy
            name: name.trim(),
            description: description !== undefined ? description.trim() : '',
            is_public: is_public !== undefined ? is_public : true
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating playlist:', insertError);
        
        // Provide specific error messages for common RLS issues
        if (insertError.code === '42501' || insertError.message?.includes('row-level security')) {
          return res.status(403).json({ 
            error: 'Permission denied',
            details: 'Row-level security policy violation. The owner_id must match your authenticated user ID.',
            hint: 'This usually means the authentication token is not being properly passed to the database.'
          });
        }
        
        throw insertError;
      }

      return res.status(201).json({ 
        playlist: {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          is_public: playlist.is_public,
          created_at: playlist.created_at,
          updated_at: playlist.updated_at
        },
        message: 'Playlist created successfully'
      });
    } catch (error) {
      console.error('Error in createPlaylist:', error);
      return res.status(500).json({ 
        error: 'Failed to create playlist',
        details: error.message
      });
    }
  }

  /**
   * Get all playlists for the authenticated user
   * Uses the user-scoped Supabase client from req.supabase to ensure RLS policies work correctly
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getPlaylists(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Fetch playlists owned by the user - RLS will enforce access control
      const { data: playlists, error } = await supabase
        .from('playlists')
        .select('id, name, description, is_public, created_at, updated_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching playlists:', error);
        throw error;
      }

      return res.status(200).json({ 
        playlists: playlists || []
      });
    } catch (error) {
      console.error('Error in getPlaylists:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch playlists',
        details: error.message
      });
    }
  }

  /**
   * Get playlist details with items (tracks) for the authenticated user
   * Fetches playlist and its items joined with track information
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getPlaylistWithItems(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { playlistId } = req.params;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate playlistId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(playlistId)) {
        return res.status(400).json({ 
          error: 'Invalid playlist ID format' 
        });
      }

      // Fetch playlist details
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('id, name, description, is_public, created_at, updated_at, owner_id')
        .eq('id', playlistId)
        .single();

      if (playlistError || !playlist) {
        console.error('Playlist lookup error:', playlistError);
        return res.status(404).json({ 
          error: 'Playlist not found',
          details: 'The specified playlist does not exist or you do not have access to it.'
        });
      }

      // Verify ownership for private playlists (public playlists can be viewed by anyone)
      if (!playlist.is_public && playlist.owner_id !== userId) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'You do not have permission to view this private playlist.'
        });
      }

      // Fetch playlist items with joined track data (including artist_name), ordered by added_at desc
      const { data: items, error: itemsError } = await supabase
        .from('playlist_items')
        .select(`
          id,
          added_at,
          track:track_id (
            id,
            title,
            duration_seconds,
            audius_track_id,
            audius_stream_url,
            artist_name
          )
        `)
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: false });

      if (itemsError) {
        console.error('Error fetching playlist items:', itemsError);
        throw itemsError;
      }

      // Normalize the response structure
      const normalizedItems = (items || []).map(item => ({
        id: item.id,
        added_at: item.added_at,
        track: item.track
      }));

      return res.status(200).json({ 
        playlist: {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          is_public: playlist.is_public,
          created_at: playlist.created_at,
          updated_at: playlist.updated_at
        },
        items: normalizedItems
      });
    } catch (error) {
      console.error('Error in getPlaylistWithItems:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch playlist',
        details: error.message
      });
    }
  }

  /**
   * Update playlist details (description and is_public)
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async updatePlaylist(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { playlistId } = req.params;
      const { description, is_public } = req.body;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate playlistId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(playlistId)) {
        return res.status(400).json({ 
          error: 'Invalid playlist ID format' 
        });
      }

      // Validate at least one field is provided
      if (description === undefined && is_public === undefined) {
        return res.status(400).json({ 
          error: 'At least one field (description or is_public) must be provided' 
        });
      }

      // Validate types if provided
      if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ 
          error: 'Description must be a string' 
        });
      }

      if (is_public !== undefined && typeof is_public !== 'boolean') {
        return res.status(400).json({ 
          error: 'is_public must be a boolean' 
        });
      }

      // Verify playlist exists and user owns it
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('id, owner_id')
        .eq('id', playlistId)
        .single();

      if (playlistError || !playlist) {
        console.error('Playlist lookup error:', playlistError);
        return res.status(404).json({ 
          error: 'Playlist not found',
          details: 'The specified playlist does not exist or you do not have access to it.'
        });
      }

      // Verify ownership
      if (playlist.owner_id !== userId) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'You do not have permission to modify this playlist.'
        });
      }

      // Build update object with only provided fields
      const updateData = {};
      if (description !== undefined) {
        updateData.description = description;
      }
      if (is_public !== undefined) {
        updateData.is_public = is_public;
      }

      // Update the playlist
      const { data: updatedPlaylist, error: updateError } = await supabase
        .from('playlists')
        .update(updateData)
        .eq('id', playlistId)
        .select('id, name, description, is_public, created_at, updated_at')
        .single();

      if (updateError) {
        console.error('Error updating playlist:', updateError);
        throw updateError;
      }

      return res.status(200).json({ 
        playlist: updatedPlaylist,
        message: 'Playlist updated successfully'
      });
    } catch (error) {
      console.error('Error in updatePlaylist:', error);
      return res.status(500).json({ 
        error: 'Failed to update playlist',
        details: error.message
      });
    }
  }

  /**
   * Add a track to a playlist
   * Ensures tracks and playlist_items tables exist, upserts track (including artist_name), and adds to playlist
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async addTrackToPlaylist(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { playlistId } = req.params;
      const { title, duration_seconds, audius_track_id, audius_stream_url, artist_name } = req.body;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate required fields
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Track title is required and must be a non-empty string' 
        });
      }

      if (!audius_track_id || typeof audius_track_id !== 'string') {
        return res.status(400).json({ 
          error: 'audius_track_id is required and must be a string' 
        });
      }

      if (!audius_stream_url || typeof audius_stream_url !== 'string') {
        return res.status(400).json({ 
          error: 'audius_stream_url is required and must be a string' 
        });
      }

      if (duration_seconds !== undefined && (typeof duration_seconds !== 'number' || duration_seconds < 0)) {
        return res.status(400).json({ 
          error: 'duration_seconds must be a non-negative number' 
        });
      }

      // Validate playlistId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(playlistId)) {
        return res.status(400).json({ 
          error: 'Invalid playlist ID format' 
        });
      }

      // Ensure tables exist
      const schemaCheck = await ensureTablesExist(supabase);
      if (!schemaCheck.success) {
        return res.status(500).json({ 
          error: 'Database schema error',
          details: schemaCheck.error
        });
      }

      // Verify playlist exists and user owns it
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('id, owner_id')
        .eq('id', playlistId)
        .single();

      if (playlistError || !playlist) {
        console.error('Playlist lookup error:', playlistError);
        return res.status(404).json({ 
          error: 'Playlist not found',
          details: 'The specified playlist does not exist or you do not have access to it.'
        });
      }

      // Verify ownership
      if (playlist.owner_id !== userId) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'You do not have permission to modify this playlist.'
        });
      }

      // Upsert track by audius_track_id (insert or return existing)
      const { data: existingTrack, error: trackCheckError } = await supabase
        .from('tracks')
        .select('id')
        .eq('audius_track_id', audius_track_id)
        .maybeSingle();

      let trackId;

      if (existingTrack) {
        // Track already exists, use its ID
        trackId = existingTrack.id;
      } else {
        // Insert new track with artist_name
        const trackInsertData = {
          title: title.trim(),
          duration_seconds: duration_seconds || null,
          audius_track_id: audius_track_id,
          audius_stream_url: audius_stream_url
        };
        
        // Add artist_name if provided
        if (artist_name) {
          trackInsertData.artist_name = artist_name;
        }

        const { data: newTrack, error: insertTrackError } = await supabase
          .from('tracks')
          .insert([trackInsertData])
          .select()
          .single();

        if (insertTrackError) {
          console.error('Error inserting track:', insertTrackError);
          throw insertTrackError;
        }

        trackId = newTrack.id;
      }

      // Insert into playlist_items (with conflict handling for duplicates)
      // No position column - items ordered by added_at timestamp
      const { data: playlistItem, error: insertItemError } = await supabase
        .from('playlist_items')
        .insert([{
          playlist_id: playlistId,
          track_id: trackId
        }])
        .select(`
          id,
          playlist_id,
          added_at,
          tracks:track_id (
            id,
            title,
            duration_seconds,
            audius_track_id,
            audius_stream_url,
            artist_name
          )
        `)
        .single();

      if (insertItemError) {
        // Check for duplicate entry (unique constraint violation)
        if (insertItemError.code === '23505') {
          return res.status(409).json({ 
            error: 'Track already in playlist',
            details: 'This track has already been added to this playlist.'
          });
        }
        console.error('Error inserting playlist item:', insertItemError);
        throw insertItemError;
      }

      return res.status(201).json({ 
        playlist_item: playlistItem,
        message: 'Track added to playlist successfully'
      });
    } catch (error) {
      console.error('Error in addTrackToPlaylist:', error);
      return res.status(500).json({ 
        error: 'Failed to add track to playlist',
        details: error.message
      });
    }
  }
}

module.exports = new PlaylistsController();
