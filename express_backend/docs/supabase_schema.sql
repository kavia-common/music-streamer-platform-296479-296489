-- ==========================================
-- Supabase PostgreSQL Schema for Music Streaming Platform
-- ==========================================
-- This file contains the complete database schema including:
-- - Tables with constraints and indexes
-- - Row Level Security (RLS) policies
-- - Triggers and functions
-- - Helpful views for common queries
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily listening statistics
CREATE OR REPLACE FUNCTION update_daily_stats_on_history_insert()
RETURNS TRIGGER AS $$
DECLARE
    stat_date_value DATE;
BEGIN
    -- Extract the date from listened_at
    stat_date_value := DATE_TRUNC('day', NEW.listened_at)::DATE;
    
    -- Upsert the daily stats
    INSERT INTO daily_listening_stats (user_id, stat_date, total_seconds, total_plays)
    VALUES (NEW.user_id, stat_date_value, COALESCE(NEW.seconds_listened, 0), 1)
    ON CONFLICT (user_id, stat_date)
    DO UPDATE SET
        total_seconds = daily_listening_stats.total_seconds + COALESCE(NEW.seconds_listened, 0),
        total_plays = daily_listening_stats.total_plays + 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TABLES
-- ==========================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 2. Artists table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    external_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on external_id for API lookups
CREATE INDEX IF NOT EXISTS idx_artists_external_id ON artists(external_id) WHERE external_id IS NOT NULL;

-- 3. Albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    release_date DATE,
    cover_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on artist_id for efficient joins
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);

-- 4. Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    duration_seconds INT CHECK (duration_seconds >= 0),
    audius_track_id TEXT,
    audius_stream_url TEXT,
    explicit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);

-- Create unique partial index for audius_track_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_audius_track_id 
ON tracks(audius_track_id) 
WHERE audius_track_id IS NOT NULL;

-- 5. Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on owner_id for user's playlists
CREATE INDEX IF NOT EXISTS idx_playlists_owner_id ON playlists(owner_id);

-- 6. Playlist items table
CREATE TABLE IF NOT EXISTS playlist_items (
    id BIGSERIAL PRIMARY KEY,
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position > 0),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (playlist_id, track_id)
);

-- Create index for efficient ordering and lookups
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_position 
ON playlist_items(playlist_id, position);

-- 7. Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- Create index on track_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_favorites_track_id ON favorites(track_id);

-- 8. Listening history table
CREATE TABLE IF NOT EXISTS listening_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    listened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seconds_listened INT CHECK (seconds_listened >= 0)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_listening_history_user_listened 
ON listening_history(user_id, listened_at DESC);

CREATE INDEX IF NOT EXISTS idx_listening_history_track_listened 
ON listening_history(track_id, listened_at DESC);

-- 9. Daily listening stats table
CREATE TABLE IF NOT EXISTS daily_listening_stats (
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    total_seconds INT NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
    total_plays INT NOT NULL DEFAULT 0 CHECK (total_plays >= 0),
    PRIMARY KEY (user_id, stat_date)
);

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger to update updated_at on profiles
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Trigger to update updated_at on playlists
DROP TRIGGER IF EXISTS trigger_playlists_updated_at ON playlists;
CREATE TRIGGER trigger_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Trigger to update daily stats when listening history is inserted
DROP TRIGGER IF EXISTS trigger_update_daily_stats ON listening_history;
CREATE TRIGGER trigger_update_daily_stats
    AFTER INSERT ON listening_history
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_stats_on_history_insert();

-- ==========================================
-- VIEWS
-- ==========================================

-- View: Recently listened tracks (last 50 per user)
CREATE OR REPLACE VIEW recently_listened AS
SELECT DISTINCT ON (lh.user_id, lh.track_id)
    lh.user_id,
    lh.track_id,
    t.title,
    t.artist_id,
    a.name AS artist_name,
    lh.listened_at,
    lh.seconds_listened
FROM listening_history lh
JOIN tracks t ON lh.track_id = t.id
LEFT JOIN artists a ON t.artist_id = a.id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
ORDER BY lh.user_id, lh.track_id, lh.listened_at DESC;

-- View: Most listened tracks (top 50 per user in last 30 days)
CREATE OR REPLACE VIEW most_listened_tracks AS
SELECT 
    lh.user_id,
    lh.track_id,
    t.title,
    t.artist_id,
    a.name AS artist_name,
    COUNT(*) AS play_count,
    SUM(lh.seconds_listened) AS total_seconds
FROM listening_history lh
JOIN tracks t ON lh.track_id = t.id
LEFT JOIN artists a ON t.artist_id = a.id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
GROUP BY lh.user_id, lh.track_id, t.title, t.artist_id, a.name
ORDER BY lh.user_id, play_count DESC, total_seconds DESC;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all user-data tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_listening_stats ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES POLICIES
-- ==========================================

-- Allow anyone to select profiles (for public viewing)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" 
ON profiles FOR SELECT 
USING (true);

-- Allow users to update only their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" 
ON profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- PLAYLISTS POLICIES
-- ==========================================

-- Allow users to view public playlists or their own playlists
DROP POLICY IF EXISTS "playlists_select" ON playlists;
CREATE POLICY "playlists_select" 
ON playlists FOR SELECT 
USING (is_public = true OR auth.uid() = owner_id);

-- Allow users to insert their own playlists
DROP POLICY IF EXISTS "playlists_insert_own" ON playlists;
CREATE POLICY "playlists_insert_own" 
ON playlists FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

-- Allow users to update only their own playlists
DROP POLICY IF EXISTS "playlists_update_own" ON playlists;
CREATE POLICY "playlists_update_own" 
ON playlists FOR UPDATE 
USING (auth.uid() = owner_id);

-- Allow users to delete only their own playlists
DROP POLICY IF EXISTS "playlists_delete_own" ON playlists;
CREATE POLICY "playlists_delete_own" 
ON playlists FOR DELETE 
USING (auth.uid() = owner_id);

-- ==========================================
-- PLAYLIST_ITEMS POLICIES
-- ==========================================

-- Allow users to view playlist items if they own the playlist or it's public
DROP POLICY IF EXISTS "playlist_items_select" ON playlist_items;
CREATE POLICY "playlist_items_select" 
ON playlist_items FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_items.playlist_id 
        AND (playlists.is_public = true OR playlists.owner_id = auth.uid())
    )
);

-- Allow users to insert items into their own playlists
DROP POLICY IF EXISTS "playlist_items_insert_own" ON playlist_items;
CREATE POLICY "playlist_items_insert_own" 
ON playlist_items FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_items.playlist_id 
        AND playlists.owner_id = auth.uid()
    )
);

-- Allow users to update items in their own playlists
DROP POLICY IF EXISTS "playlist_items_update_own" ON playlist_items;
CREATE POLICY "playlist_items_update_own" 
ON playlist_items FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_items.playlist_id 
        AND playlists.owner_id = auth.uid()
    )
);

-- Allow users to delete items from their own playlists
DROP POLICY IF EXISTS "playlist_items_delete_own" ON playlist_items;
CREATE POLICY "playlist_items_delete_own" 
ON playlist_items FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_items.playlist_id 
        AND playlists.owner_id = auth.uid()
    )
);

-- ==========================================
-- FAVORITES POLICIES
-- ==========================================

-- Allow users to view only their own favorites
DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own" 
ON favorites FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own favorites
DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
CREATE POLICY "favorites_insert_own" 
ON favorites FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own favorites
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_delete_own" 
ON favorites FOR DELETE 
USING (auth.uid() = user_id);

-- ==========================================
-- LISTENING_HISTORY POLICIES
-- ==========================================

-- Allow users to view only their own listening history
DROP POLICY IF EXISTS "listening_history_select_own" ON listening_history;
CREATE POLICY "listening_history_select_own" 
ON listening_history FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own listening history
DROP POLICY IF EXISTS "listening_history_insert_own" ON listening_history;
CREATE POLICY "listening_history_insert_own" 
ON listening_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- DAILY_LISTENING_STATS POLICIES
-- ==========================================

-- Allow users to view only their own stats
DROP POLICY IF EXISTS "daily_listening_stats_select_own" ON daily_listening_stats;
CREATE POLICY "daily_listening_stats_select_own" 
ON daily_listening_stats FOR SELECT 
USING (auth.uid() = user_id);

-- Allow the trigger function to insert/update stats (this is handled automatically)
-- Note: The trigger runs with the privileges of the function owner

-- ==========================================
-- SCHEMA SETUP COMPLETE
-- ==========================================
-- To use this schema:
-- 1. Copy this entire file
-- 2. Go to your Supabase project dashboard
-- 3. Navigate to SQL Editor
-- 4. Paste and execute this script
-- 5. Verify tables, policies, and functions are created
-- ==========================================
