# Add Track to Playlist Endpoint

## Endpoint
`POST /api/playlists/:playlistId/items`

## Description
Adds a song/track to a specified playlist. The endpoint:
1. Validates user authentication and playlist ownership
2. Ensures the `tracks` and `playlist_items` tables exist in Supabase
3. Upserts the track by `audius_track_id` (creates if new, reuses if exists)
4. Inserts a new entry into `playlist_items` linking the track to the playlist
5. Returns the created playlist_item with track details

## Authentication
Requires a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <your_access_token>
```

## URL Parameters
- `playlistId` (required, UUID): The unique identifier of the playlist

## Request Body
All fields are required except `duration_seconds`:

```json
{
  "title": "Amazing Song",
  "duration_seconds": 180,
  "audius_track_id": "abc123",
  "audius_stream_url": "https://audius.co/stream/abc123"
}
```

### Field Descriptions
- **title** (string, required): The title of the track
- **duration_seconds** (integer, optional): Duration of the track in seconds (must be >= 0)
- **audius_track_id** (string, required): Unique identifier from Audius API
- **audius_stream_url** (string, required): Streaming URL from Audius API

## Response

### Success (201 Created)
```json
{
  "playlist_item": {
    "id": 1,
    "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
    "added_at": "2024-01-15T10:30:00.000Z",
    "tracks": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Amazing Song",
      "duration_seconds": 180,
      "audius_track_id": "abc123",
      "audius_stream_url": "https://audius.co/stream/abc123"
    }
  },
  "message": "Track added to playlist successfully"
}
```

### Error Responses

**400 Bad Request** - Invalid input
```json
{
  "error": "Track title is required and must be a non-empty string"
}
```

**401 Unauthorized** - Missing or invalid token
```json
{
  "error": "Invalid or expired token",
  "details": "Token verification failed. Please login again."
}
```

**403 Forbidden** - User doesn't own the playlist
```json
{
  "error": "Permission denied",
  "details": "You do not have permission to modify this playlist."
}
```

**404 Not Found** - Playlist doesn't exist
```json
{
  "error": "Playlist not found",
  "details": "The specified playlist does not exist or you do not have access to it."
}
```

**409 Conflict** - Track already in playlist
```json
{
  "error": "Track already in playlist",
  "details": "This track has already been added to this playlist."
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to add track to playlist",
  "details": "Error message details"
}
```

## Example Usage

### Using cURL
```bash
curl -X POST http://localhost:3001/api/playlists/550e8400-e29b-41d4-a716-446655440000/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "My Favorite Song",
    "duration_seconds": 240,
    "audius_track_id": "xyz789",
    "audius_stream_url": "https://audius.co/stream/xyz789"
  }'
```

### Using JavaScript (fetch)
```javascript
const response = await fetch(
  `${API_BASE_URL}/api/playlists/${playlistId}/items`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      title: 'My Favorite Song',
      duration_seconds: 240,
      audius_track_id: 'xyz789',
      audius_stream_url: 'https://audius.co/stream/xyz789'
    })
  }
);

const data = await response.json();
console.log(data);
```

## Database Schema Requirements

This endpoint requires the following Supabase tables to exist:

### tracks table
```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  duration_seconds INT CHECK (duration_seconds >= 0),
  audius_track_id TEXT,
  audius_stream_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tracks_audius_track_id 
ON tracks(audius_track_id) 
WHERE audius_track_id IS NOT NULL;
```

### playlist_items table
```sql
CREATE TABLE playlist_items (
  id BIGSERIAL PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (playlist_id, track_id)
);

CREATE INDEX idx_playlist_items_playlist_added_at 
ON playlist_items(playlist_id, added_at DESC);
```

## Notes
- Tracks in a playlist are ordered by `added_at` timestamp (newest first by default)
- If a track with the same `audius_track_id` already exists, it will be reused
- Duplicate tracks in the same playlist are prevented by the unique constraint
- Row-Level Security (RLS) policies ensure users can only add tracks to their own playlists
- The schema initialization utility validates table existence before operations

## Environment Variables
The endpoint uses the following environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon/service key

These should already be configured in your `.env` file.
