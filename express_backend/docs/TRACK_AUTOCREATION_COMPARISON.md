# Track Auto-Creation: Playlists vs Favorites Comparison

## Overview

Both the **Playlists** and **Favorites** endpoints now implement consistent track auto-creation behavior. When adding a track that doesn't exist, it will be automatically created in the `tracks` table using only allowed fields before being added to the respective collection.

## Side-by-Side Comparison

### Track Lookup Strategy

| Aspect | Playlists | Favorites |
|--------|-----------|-----------|
| **Lookup Method** | By `audius_track_id` | By `id` (track_id) |
| **Reason** | Audius tracks are identified by their platform ID | Frontend provides explicit UUID for track |
| **Query** | `.eq('audius_track_id', audius_track_id)` | `.eq('id', track_id)` |

### Track Creation Logic

Both implementations use **identical allowed fields**:

```javascript
// Allowed fields for track creation
const trackData = {
  id: track_id,              // UUID (provided or generated)
  title: title,              // TEXT
  artist_name: artist_name,  // TEXT  
  duration_seconds: duration_seconds, // INTEGER
  audius_track_id: audius_track_id,   // TEXT
  audius_stream_url: audius_stream_url // TEXT
  // created_at: AUTO (database default)
};
```

### Implementation Code Comparison

#### Playlists (addTrackToPlaylist)

```javascript
// Check if track exists by audius_track_id
const { data: existingTrack } = await supabase
  .from('tracks')
  .select('id')
  .eq('audius_track_id', audius_track_id)
  .maybeSingle();

if (existingTrack) {
  trackId = existingTrack.id;
} else {
  // Create track with allowed fields
  const trackInsertData = {
    title: title.trim(),
    duration_seconds: duration_seconds || null,
    audius_track_id: audius_track_id,
    audius_stream_url: audius_stream_url
  };
  
  if (artist_name) {
    trackInsertData.artist_name = artist_name;
  }

  const { data: newTrack } = await supabase
    .from('tracks')
    .insert([trackInsertData])
    .select()
    .single();

  trackId = newTrack.id;
}

// Add to playlist_items
await supabase
  .from('playlist_items')
  .insert([{ playlist_id: playlistId, track_id: trackId }]);
```

#### Favorites (addFavorite)

```javascript
// Check if track exists by id
const { data: existingTrack } = await supabase
  .from('tracks')
  .select('id')
  .eq('id', track_id)
  .maybeSingle();

if (!existingTrack) {
  // Create track with allowed fields
  const trackData = { id: track_id };
  
  if (title) trackData.title = title;
  if (artist_name) trackData.artist_name = artist_name;
  if (duration_seconds !== undefined) {
    trackData.duration_seconds = duration_seconds;
  }
  if (audius_track_id) trackData.audius_track_id = audius_track_id;
  if (audius_stream_url) trackData.audius_stream_url = audius_stream_url;

  await supabase
    .from('tracks')
    .insert([trackData])
    .select('id')
    .single();
}

// Check if already favorited (idempotency)
const { data: existingFavorite } = await supabase
  .from('favorites')
  .select('user_id, track_id, created_at')
  .eq('user_id', userId)
  .eq('track_id', track_id)
  .maybeSingle();

if (existingFavorite) {
  return { /* Already favorited */ };
}

// Add to favorites
await supabase
  .from('favorites')
  .insert([{ user_id: userId, track_id: track_id }]);
```

## Key Differences

### 1. Uniqueness Check

| Feature | Playlists | Favorites |
|---------|-----------|-----------|
| **Check By** | `audius_track_id` (Audius platform identifier) | `id` (UUID provided in request) |
| **Duplicate Prevention** | 23505 error on playlist_items insert | Pre-check + 23505 error handling |
| **Idempotency** | Returns 409 Conflict | Returns 200 OK with existing favorite |

### 2. Request Body Differences

**Playlists Request:**
```json
{
  "title": "Song Title",
  "artist_name": "Artist Name",
  "duration_seconds": 180,
  "audius_track_id": "abc123",
  "audius_stream_url": "https://audius.co/stream/abc123"
}
```
- `audius_track_id` is **required**
- Track ID is auto-generated if new

**Favorites Request:**
```json
{
  "track_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Song Title",
  "artist_name": "Artist Name",
  "duration_seconds": 180,
  "audius_track_id": "abc123",
  "audius_stream_url": "https://audius.co/stream/abc123"
}
```
- `track_id` is **required** (UUID)
- Frontend determines the track ID

### 3. Idempotency Behavior

**Playlists:**
- Returns **409 Conflict** if track already in playlist
- "Track already in playlist" error message
- Forces frontend to handle conflict

**Favorites:**
- Returns **200 OK** if track already favorited
- "Track is already in favorites" success message
- Idempotent: safe to call multiple times
- Better UX for "heart" button (click multiple times = OK)

## Allowed Track Fields

Both implementations use **exactly the same allowed fields** from the `tracks` table schema:

| Field | Type | Required | Auto-Created | Description |
|-------|------|----------|--------------|-------------|
| `id` | UUID | Yes* | Favorites: Required in request<br>Playlists: Auto-generated | Primary key |
| `title` | TEXT | No | Optional | Track title |
| `artist_name` | TEXT | No | Optional | Artist name |
| `duration_seconds` | INTEGER | No | Optional | Duration in seconds |
| `audius_track_id` | TEXT | No | Playlists: Required<br>Favorites: Optional | Audius platform identifier (unique) |
| `audius_stream_url` | TEXT | No | Playlists: Required<br>Favorites: Optional | Audius streaming URL |
| `created_at` | TIMESTAMPTZ | N/A | AUTO | Database default `NOW()` |

### Disallowed Fields

Neither implementation references these fields (they don't exist or are not allowed):
- ❌ `position` (removed from schema)
- ❌ `album`
- ❌ `genre`
- ❌ `cover_art_url`
- ❌ Any computed or derived fields

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

### Playlist Items Table
```sql
CREATE TABLE playlist_items (
  id SERIAL PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);
```

### Favorites Table
```sql
CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)  -- Composite key, no separate id
);
```

## Error Handling Comparison

### Playlists Errors

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Missing title | "Track title is required" |
| 400 | Missing audius_track_id | "audius_track_id is required" |
| 404 | Playlist not found | "Playlist not found" |
| 403 | Not playlist owner | "Permission denied" |
| 409 | Track already in playlist | "Track already in playlist" |

### Favorites Errors

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Invalid track_id | "Valid track_id (UUID) is required" |
| 200 | Track already favorited | "Track is already in favorites" *(not an error)* |
| 500 | Track creation failed | "Failed to create track" |

## Usage Examples

### Adding to Playlist

```javascript
// POST /api/playlists/:playlistId/items
const response = await fetch(`/api/playlists/${playlistId}/items`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: "Amazing Song",
    artist_name: "Great Artist",
    duration_seconds: 180,
    audius_track_id: "abc123",  // Required
    audius_stream_url: "https://audius.co/stream/abc123"
  })
});

// Response: 201 Created or 409 Conflict
```

### Adding to Favorites

```javascript
// POST /api/favorites
const response = await fetch('/api/favorites', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    track_id: "550e8400-e29b-41d4-a716-446655440000",  // Required UUID
    title: "Amazing Song",
    artist_name: "Great Artist",
    duration_seconds: 180,
    audius_track_id: "abc123",
    audius_stream_url: "https://audius.co/stream/abc123"
  })
});

// Response: 201 Created or 200 OK (already favorited)
```

## Testing Both Flows

### Test Playlists Auto-Creation

```bash
# See: docs/ADD_TRACK_TO_PLAYLIST.md
# The playlist flow has been tested and verified
```

### Test Favorites Auto-Creation

```bash
# Run the automated test
cd express_backend
./test_favorites_track_creation.sh
```

## Summary

Both endpoints now provide **aligned behavior** for track auto-creation:

### ✅ Similarities
- Auto-create tracks if they don't exist
- Use **identical allowed fields** (id, title, artist_name, duration_seconds, audius_track_id, audius_stream_url)
- No disallowed fields referenced
- Proper error handling
- RLS policy enforcement

### 🔄 Differences
- **Lookup**: Playlists use `audius_track_id`, Favorites use `id`
- **ID Source**: Playlists auto-generate, Favorites require UUID in request
- **Idempotency**: Playlists return 409, Favorites return 200 (both are correct for their use case)
- **Primary Key**: Playlists use separate `id`, Favorites use composite (user_id, track_id)

### 🎯 Result
Frontend developers can now:
1. Add tracks to playlists → auto-creates track by Audius ID
2. Click "heart" to favorite → auto-creates track by provided UUID
3. Both flows respect the same track schema
4. Consistent, predictable behavior across the API

## Related Documentation

- [Add Track to Playlist](./ADD_TRACK_TO_PLAYLIST.md)
- [Favorites Track Auto-Creation](./FAVORITES_TRACK_AUTO_CREATION.md)
- [Favorites API Verification](./FAVORITES_API_VERIFICATION.md)
- [OpenAPI Specification](../interfaces/openapi.json)
