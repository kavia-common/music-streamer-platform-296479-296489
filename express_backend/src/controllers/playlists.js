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
      const { name } = req.body;

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
            description: '',
            is_public: true
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
}

module.exports = new PlaylistsController();
