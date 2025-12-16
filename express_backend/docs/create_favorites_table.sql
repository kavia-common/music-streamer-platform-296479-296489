-- Create favorites table for storing user favorite tracks
-- This table links users to their favorite tracks with a timestamp

CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, track_id) -- Prevent duplicate favorites per user
);

-- Create index on user_id for fast lookup of user's favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Create index on track_id for checking if track is favorited
CREATE INDEX IF NOT EXISTS idx_favorites_track_id ON favorites(track_id);

-- Create composite index for checking specific user-track combination
CREATE INDEX IF NOT EXISTS idx_favorites_user_track ON favorites(user_id, track_id);

-- Enable Row Level Security
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own favorites
CREATE POLICY "Users can view their own favorites"
    ON favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own favorites
CREATE POLICY "Users can insert their own favorites"
    ON favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own favorites
CREATE POLICY "Users can delete their own favorites"
    ON favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment to table for documentation
COMMENT ON TABLE favorites IS 'Stores user favorite tracks with user_id, track_id, and created_at timestamp';
COMMENT ON COLUMN favorites.user_id IS 'Reference to the user who favorited the track';
COMMENT ON COLUMN favorites.track_id IS 'Reference to the favorited track';
COMMENT ON COLUMN favorites.created_at IS 'Timestamp when the track was added to favorites';
