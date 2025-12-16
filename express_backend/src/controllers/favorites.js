const { ensureTablesExist } = require('../utils/schemaInit');

class FavoritesController {
  /**
   * Add a track to the authenticated user's favorites
   * Inserts into 'favorites' table with user_id from auth session and created_at timestamp
   * Prevents duplicate entries per user_id + track_id combination
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async addFavorite(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { track_id } = req.body;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate track_id is provided and is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!track_id || !uuidRegex.test(track_id)) {
        return res.status(400).json({ 
          error: 'Valid track_id (UUID) is required' 
        });
      }

      // Ensure favorites table exists
      const schemaCheck = await ensureTablesExist(supabase);
      if (!schemaCheck.success) {
        return res.status(500).json({ 
          error: 'Database schema error',
          details: schemaCheck.error
        });
      }

      // Verify the track exists
      const { data: track, error: trackError } = await supabase
        .from('tracks')
        .select('id')
        .eq('id', track_id)
        .single();

      if (trackError || !track) {
        return res.status(404).json({ 
          error: 'Track not found',
          details: 'The specified track does not exist.'
        });
      }

      // Insert into favorites table
      // The created_at will be set automatically by the database (timestamptz default now())
      const { data: favorite, error: insertError } = await supabase
        .from('favorites')
        .insert([{
          user_id: userId,
          track_id: track_id
        }])
        .select(`
          user_id,
          track_id,
          created_at
        `)
        .single();

      if (insertError) {
        // Check for duplicate entry (unique constraint violation on user_id + track_id)
        if (insertError.code === '23505') {
          return res.status(409).json({ 
            error: 'Track already in favorites',
            details: 'This track has already been added to your favorites.'
          });
        }
        console.error('Error inserting favorite:', insertError);
        throw insertError;
      }

      return res.status(201).json({ 
        favorite,
        message: 'Track added to favorites successfully'
      });
    } catch (error) {
      console.error('Error in addFavorite:', error);
      return res.status(500).json({ 
        error: 'Failed to add favorite',
        details: error.message
      });
    }
  }

  /**
   * Get all favorite tracks for the authenticated user
   * Returns current user's favorite track_ids with track metadata
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getFavorites(req, res) {
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

      // Fetch favorites with joined track data, ordered by created_at desc (most recent first)
      const { data: favorites, error } = await supabase
        .from('favorites')
        .select(`
          track_id,
          created_at,
          track:track_id (
            id,
            title,
            duration_seconds,
            audius_track_id,
            audius_stream_url,
            artist_name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching favorites:', error);
        throw error;
      }

      // Normalize the response structure
      // Note: favorites table uses composite key (user_id, track_id), no id column
      const normalizedFavorites = (favorites || []).map(fav => ({
        track_id: fav.track_id,
        created_at: fav.created_at,
        track: fav.track
      }));

      return res.status(200).json({ 
        favorites: normalizedFavorites
      });
    } catch (error) {
      console.error('Error in getFavorites:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch favorites',
        details: error.message
      });
    }
  }

  /**
   * Remove a track from the authenticated user's favorites
   * Deletes the favorite entry by track_id for the current user
   * @param {object} req - Express request object with authenticated user and Supabase client
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async removeFavorite(req, res) {
    try {
      // Get user-scoped Supabase client and user ID
      const supabase = req.supabase;
      const userId = req.user.id;
      const { trackId } = req.params;

      // Validate that we have the user-scoped client
      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available',
          details: 'User-scoped Supabase client is missing. Please ensure authentication middleware is applied.'
        });
      }

      // Validate trackId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(trackId)) {
        return res.status(400).json({ 
          error: 'Invalid track ID format' 
        });
      }

      // Delete the favorite entry for this user and track
      const { data, error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .select();

      if (deleteError) {
        console.error('Error deleting favorite:', deleteError);
        throw deleteError;
      }

      // Check if any rows were deleted
      if (!data || data.length === 0) {
        return res.status(404).json({ 
          error: 'Favorite not found',
          details: 'This track is not in your favorites.'
        });
      }

      return res.status(200).json({ 
        message: 'Track removed from favorites successfully'
      });
    } catch (error) {
      console.error('Error in removeFavorite:', error);
      return res.status(500).json({ 
        error: 'Failed to remove favorite',
        details: error.message
      });
    }
  }
}

module.exports = new FavoritesController();
