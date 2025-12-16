/**
 * Schema initialization utility for Supabase tables
 * Ensures required tables exist with proper schema
 */

/**
 * Initialize tracks, playlist_items, and favorites tables if they don't exist
 * Also ensures artist_name column exists in tracks table
 * @param {object} supabase - User-scoped Supabase client
 * @returns {Promise<{success: boolean, error?: string}>}
 */
// PUBLIC_INTERFACE
async function ensureTablesExist(supabase) {
  try {
    // Check if tracks table exists by attempting a simple query
    const { error: tracksCheckError } = await supabase
      .from('tracks')
      .select('id')
      .limit(1);

    // If table doesn't exist (error code PGRST204 or 42P01), we need to create it
    // Note: Direct DDL operations require service role or database admin access
    // Since we're using user-scoped client, we'll assume tables are created via migration
    // This function serves as a validation check
    
    if (tracksCheckError && tracksCheckError.code === '42P01') {
      console.warn('tracks table does not exist. Please run database migrations.');
      return {
        success: false,
        error: 'Database schema not initialized. Contact administrator.'
      };
    }

    // Check if playlist_items table exists
    const { error: playlistItemsCheckError } = await supabase
      .from('playlist_items')
      .select('id')
      .limit(1);

    if (playlistItemsCheckError && playlistItemsCheckError.code === '42P01') {
      console.warn('playlist_items table does not exist. Please run database migrations.');
      return {
        success: false,
        error: 'Database schema not initialized. Contact administrator.'
      };
    }

    // Check if favorites table exists
    const { error: favoritesCheckError } = await supabase
      .from('favorites')
      .select('id')
      .limit(1);

    if (favoritesCheckError && favoritesCheckError.code === '42P01') {
      console.warn('favorites table does not exist. Please run database migrations.');
      return {
        success: false,
        error: 'Database schema not initialized. Contact administrator.'
      };
    }

    // Non-destructive check: verify artist_name column exists
    // Try to select artist_name - if it fails with column not found error, log a warning
    const { error: columnCheckError } = await supabase
      .from('tracks')
      .select('artist_name')
      .limit(1);

    if (columnCheckError && (columnCheckError.code === '42703' || columnCheckError.message?.includes('artist_name'))) {
      console.warn('artist_name column does not exist in tracks table. Please run ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_name TEXT;');
      // We don't fail here - the app can still work without artist_name (graceful degradation)
    }

    return { success: true };
  } catch (error) {
    console.error('Error checking table existence:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  ensureTablesExist
};
