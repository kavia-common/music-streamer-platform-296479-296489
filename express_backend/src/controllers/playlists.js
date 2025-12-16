const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

class PlaylistsController {
  /**
   * Create a new playlist for the authenticated user
   * @param {object} req - Express request object with authenticated user
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async createPlaylist(req, res) {
    try {
      const userId = req.user.id;
      const { name } = req.body;

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

      // Fetch the profile to get the owner_id (which is the user_id from profiles table)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ 
          error: 'User profile not found',
          details: 'Please ensure your profile is set up correctly'
        });
      }

      // Create the playlist
      const { data: playlist, error: insertError } = await supabase
        .from('playlists')
        .insert([
          {
            owner_id: profile.user_id,
            name: name.trim(),
            description: '',
            is_public: true
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating playlist:', insertError);
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
   * @param {object} req - Express request object with authenticated user
   * @param {object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getPlaylists(req, res) {
    try {
      const userId = req.user.id;

      // Fetch playlists owned by the user
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
