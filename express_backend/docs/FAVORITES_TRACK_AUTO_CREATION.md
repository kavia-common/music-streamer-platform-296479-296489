# Favorites Track Auto-Creation Feature

## Overview

The Favorites endpoint now aligns with the Playlists endpoint behavior for track handling. When adding a track to favorites, if the track doesn't exist in the `tracks` table, it will be automatically created using only the allowed track fields.

## Aligned Behavior: Playlists vs Favorites

### Playlists Flow (POST /api/playlists/:playlistId/items)

1. Check if track exists by `audius_track_id`
2. If not found, create track with allowed fields
3. Add track to `playlist_items`
4. Return playlist item with track metadata

### Favorites Flow (POST /api/favorites)

1. Check if track exists by `id` (track_id from request)
2. If not found, create track with allowed fields
3. Add track to `favorites` using composite key (user_id, track_id)
4. Return favorite with confirmation
5. **Idempotent**: If already favorited, return success

## Allowed Track Fields

When auto-creating a track, **only these fields** are used from the `tracks` table schema:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key (provided as `track_id` in request) |
| `title` | TEXT | No | Track title |
| `artist_name` | TEXT | No | Artist name |
| `duration_seconds` | INTEGER | No | Duration in seconds |
| `audius_track_id` | TEXT | No | Audius unique identifier |
| `audius_stream_url` | TEXT | No | Audius streaming URL |
| `created_at` | TIMESTAMPTZ | Auto | Automatically set by database |

### Disallowed Fields

The following fields are **NOT** allowed and will be ignored:
- Any fields not listed above
- Computed or derived fields
- Fields that don't exist in the tracks table schema

## API Usage

### Add Track to Favorites (with auto-creation)

**Request:**
```bash
POST /api/favorites
Authorization: Bearer <token>
Content-Type: application/json

{
  "track_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Amazing Song",
  "artist_name": "Great Artist",
  "duration_seconds": 180,
  "audius_track_id": "abc123",
  "audius_stream_url": "https://audius.co/stream/abc123"
}
```

**Response (201 Created - new favorite):**
```json
{
  "favorite": {
    "user_id": "user-uuid-here",
    "track_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Track added to favorites successfully"
}
```

**Response (200 OK - already favorited, idempotent):**
```json
{
  "favorite": {
    "user_id": "user-uuid-here",
    "track_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Track is already in favorites"
}
```

### Get Favorites (includes auto-created track metadata)

**Request:**
```bash
GET /api/favorites
Authorization: Bearer <token>
```

**Response:**
```json
{
  "favorites": [
    {
      "track_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-01-15T10:30:00Z",
      "track": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Amazing Song",
        "artist_name": "Great Artist",
        "duration_seconds": 180,
        "audius_track_id": "abc123",
        "audius_stream_url": "https://audius.co/stream/abc123"
      }
    }
  ]
}
```

## Implementation Details

### Track Auto-Creation Logic

The `addFavorite` method in `src/controllers/favorites.js` implements:

```javascript
// Check if track exists
const { data: existingTrack } = await supabase
  .from('tracks')
  .select('id')
  .eq('id', track_id)
  .maybeSingle();

// If not found, create it with only allowed fields
if (!existingTrack) {
  const trackData = { id: track_id };
  
  // Add optional allowed fields if provided
  if (title) trackData.title = title;
  if (artist_name) trackData.artist_name = artist_name;
  if (duration_seconds !== undefined) trackData.duration_seconds = duration_seconds;
  if (audius_track_id) trackData.audius_track_id = audius_track_id;
  if (audius_stream_url) trackData.audius_stream_url = audius_stream_url;

  await supabase.from('tracks').insert([trackData]);
}
```

### Idempotency Guarantee

The Favorites endpoint ensures idempotent behavior:

1. **Check before insert**: Queries if favorite already exists
2. **Return existing**: If found, returns success with existing favorite
3. **Handle race conditions**: Catches duplicate key violations (23505) and returns existing favorite
4. **Composite key**: Uses (user_id, track_id) as unique constraint

## Database Schema

### Tracks Table
```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  artist_name TEXT,
  duration_seconds INTEGER,
  audius_track_id TEXT UNIQUE,
  audius_stream_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Favorites Table
```sql
CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);
```

**Note**: The `favorites` table uses a **composite primary key** (user_id, track_id), not a separate `id` column.

## Testing

Run the automated test script:

```bash
cd express_backend
chmod +x test_favorites_track_creation.sh
./test_favorites_track_creation.sh
```

This test verifies:
- ✓ Track auto-creation when adding to favorites
- ✓ Only allowed track fields are used
- ✓ Idempotent behavior (repeated adds succeed)
- ✓ GET returns track metadata
- ✓ DELETE removes from favorites

## Error Handling

### Track Creation Failure
```json
{
  "error": "Failed to create track",
  "details": "Database error message here"
}
```

### Invalid Track ID
```json
{
  "error": "Valid track_id (UUID) is required"
}
```

### Database Schema Error
```json
{
  "error": "Database schema error",
  "details": "Schema check failed"
}
```

## Migration Notes

### Before This Change
- Favorites required track to exist in `tracks` table
- Adding non-existent track returned 404 error
- Frontend had to create track before favoriting

### After This Change
- Favorites auto-creates missing tracks (like Playlists)
- Only allowed fields are used for track creation
- Idempotent behavior for repeated adds
- Consistent experience across Playlists and Favorites

## Frontend Integration

When implementing the "heart" button to favorite a track:

```javascript
// Example: Add to favorites with track auto-creation
async function addToFavorites(track) {
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      track_id: track.id,
      title: track.title,
      artist_name: track.artist,
      duration_seconds: track.duration,
      audius_track_id: track.audiusId,
      audius_stream_url: track.streamUrl
    })
  });

  // Handle both 201 (created) and 200 (already exists)
  if (response.ok) {
    const data = await response.json();
    console.log(data.message); // Success or already favorited
    return true;
  }
  
  return false;
}
```

## Related Documentation

- [Favorites API Verification](./FAVORITES_API_VERIFICATION.md)
- [Favorites Fix Verification](./FAVORITES_FIX_VERIFICATION.md)
- [Add Track to Playlist](./ADD_TRACK_TO_PLAYLIST.md)
- [OpenAPI Specification](../interfaces/openapi.json)

## Summary

The Favorites endpoint now provides a seamless experience aligned with the Playlists flow:

1. **Auto-creation**: Tracks are created if they don't exist
2. **Allowed fields only**: Respects track schema constraints
3. **Idempotent**: Safe to call multiple times
4. **Composite key**: Uses (user_id, track_id) for uniqueness
5. **Consistent**: Same behavior as adding to playlists

This alignment simplifies frontend implementation and provides a better user experience when clicking the "heart" icon to favorite tracks.
