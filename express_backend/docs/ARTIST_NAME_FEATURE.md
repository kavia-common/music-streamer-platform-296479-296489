# Artist Name Feature Documentation

## Overview
This feature adds support for storing and displaying artist names alongside track information in playlists.

## Changes Made

### Backend Changes

1. **Database Schema**
   - Added `artist_name` TEXT column to the `tracks` table
   - Column is nullable for backward compatibility
   - Index added on `artist_name` for efficient searching
   - Migration script: `docs/add_artist_name_migration.sql`

2. **Schema Initialization Utility** (`src/utils/schemaInit.js`)
   - Added non-destructive check for `artist_name` column existence
   - Logs warning if column is missing but doesn't fail
   - Allows graceful degradation if migration hasn't been run

3. **Playlists Controller** (`src/controllers/playlists.js`)
   - `addTrackToPlaylist`: Now accepts optional `artist_name` in request body
   - Track upsert includes `artist_name` if provided
   - `getPlaylistWithItems`: Returns `artist_name` in track data

4. **OpenAPI Documentation** (`interfaces/openapi.json`)
   - Added `artist_name` to POST `/api/playlists/{playlistId}/items` request schema
   - Added `artist_name` to track properties in playlist response schemas
   - Field is optional (not in required array)

### Frontend Changes

1. **API Client** (`src/api/apiClient.js`)
   - `addTrackToPlaylist`: Accepts and sends `artist_name` if provided in trackData

2. **MainHome Component** (`src/pages/MainHome.js`)
   - Extracts artist name from Audius track data (`track.user?.name`)
   - Includes `artist_name` when adding tracks to playlists

3. **PlaylistView Component** (`src/pages/PlaylistView.js`)
   - Replaced stream link display with artist name column
   - Shows "Unknown Artist" as fallback if `artist_name` is missing
   - Updated table headers to include "ARTIST" column

4. **PlaylistView CSS** (`src/pages/PlaylistView.css`)
   - Removed stream link styling
   - Added `track-col-artist` styling
   - Maintains Ocean Professional theme with gray text for artist names

## Database Migration

To add the `artist_name` column to an existing database, run:

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_name TEXT;
CREATE INDEX IF NOT EXISTS idx_tracks_artist_name ON tracks(artist_name) WHERE artist_name IS NOT NULL;
```

Or execute the migration file in Supabase SQL Editor:
```
music-streamer-platform-296479-296489/express_backend/docs/add_artist_name_migration.sql
```

## Backward Compatibility

- Existing tracks without `artist_name` will display "Unknown Artist" in the UI
- The backend accepts tracks without `artist_name` (field is optional)
- Old API clients that don't send `artist_name` will continue to work
- Schema check is non-destructive and only logs warnings

## Testing

1. Add a new track to a playlist from MainHome - should include artist name
2. View playlist - should show artist name in new column
3. Tracks without artist_name should show "Unknown Artist"
4. OpenAPI docs should reflect the new field

## UI Changes

**Before:** Track list showed a "🔗 Stream" link next to each track title

**After:** Track list shows artist name in a dedicated column with fallback to "Unknown Artist"

This provides a cleaner, more professional music streaming experience consistent with platforms like Spotify.
