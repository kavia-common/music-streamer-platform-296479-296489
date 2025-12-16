/**
 * Schema initialization utility for Supabase tables
 * Ensures required tables exist with proper schema
 */

/**
 * Initialize tracks and playlist_items tables if they don't exist
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
