-- Migration: Add artist_name column to tracks table
-- This migration adds the artist_name column to support storing artist information
-- directly in the tracks table for simplified querying in playlists

-- Add artist_name column if it doesn't exist
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_name TEXT;

-- Create index on artist_name for efficient searching (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_tracks_artist_name ON tracks(artist_name) WHERE artist_name IS NOT NULL;

-- Note: This column is optional and NULL values are allowed for backward compatibility
-- Existing tracks without artist_name will show "Unknown Artist" in the UI
