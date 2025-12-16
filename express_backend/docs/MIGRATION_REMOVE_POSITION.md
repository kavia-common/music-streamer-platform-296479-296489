# Migration: Remove Position Column from playlist_items

## Overview
This migration removes the `position` column from the `playlist_items` table and updates all related indexes and logic to rely on the `added_at` timestamp for ordering instead.

## Why This Change?
- Simplifies the data model by removing manual position management
- Relies on `added_at` timestamp for natural chronological ordering
- Reduces complexity in insert operations
- Eliminates potential race conditions when calculating next position

## Database Changes Required

### Step 1: Backup Current Data (Recommended)
Before making any changes, backup your playlist_items data:

```sql
-- Create a backup table
CREATE TABLE playlist_items_backup AS 
SELECT * FROM playlist_items;
```

### Step 2: Drop the Old Index
```sql
-- Drop the position-based index
DROP INDEX IF EXISTS idx_playlist_items_playlist_position;
```

### Step 3: Remove the Position Column
```sql
-- Remove the position column
ALTER TABLE playlist_items 
DROP COLUMN IF EXISTS position;
```

### Step 4: Create New Index for Ordering by added_at
```sql
-- Create index for efficient ordering by added_at
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_added_at 
ON playlist_items(playlist_id, added_at DESC);
```

### Step 5: Verify the Changes
```sql
-- Verify the new table structure
\d playlist_items

-- Test querying items ordered by added_at
SELECT * FROM playlist_items 
WHERE playlist_id = 'your-playlist-id-here' 
ORDER BY added_at DESC;
```

## Complete Migration Script

Run this in your Supabase SQL Editor:

```sql
-- ==========================================
-- Migration: Remove position column from playlist_items
-- ==========================================

-- Step 1: Backup (optional but recommended)
CREATE TABLE IF NOT EXISTS playlist_items_backup AS 
SELECT * FROM playlist_items;

-- Step 2: Drop old index
DROP INDEX IF EXISTS idx_playlist_items_playlist_position;

-- Step 3: Remove position column
ALTER TABLE playlist_items 
DROP COLUMN IF EXISTS position;

-- Step 4: Create new index for ordering
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_added_at 
ON playlist_items(playlist_id, added_at DESC);

-- Step 5: Verify
SELECT 
    COUNT(*) as total_items,
    COUNT(DISTINCT playlist_id) as total_playlists
FROM playlist_items;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Position column removed from playlist_items';
    RAISE NOTICE 'New index created: idx_playlist_items_playlist_added_at';
END $$;
```

## Application Code Changes

The following backend files have been updated:

1. **src/controllers/playlists.js**
   - Removed logic to calculate next position
   - Simplified insert operation to not include position field
   - Updated select query to not fetch position

2. **interfaces/openapi.json**
   - Removed `position` field from API response schema

3. **docs/supabase_schema.sql**
   - Updated table definition to remove position column
   - Updated index to use added_at instead of position

4. **docs/ADD_TRACK_TO_PLAYLIST.md**
   - Updated API documentation to reflect new response structure
   - Updated notes to mention ordering by added_at

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Restore from backup
DROP TABLE IF EXISTS playlist_items;
CREATE TABLE playlist_items AS 
SELECT * FROM playlist_items_backup;

-- Recreate the position column with sequential values
ALTER TABLE playlist_items 
ADD COLUMN position INT;

-- Assign positions based on added_at order
WITH numbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY added_at) as new_position
  FROM playlist_items
)
UPDATE playlist_items 
SET position = numbered.new_position
FROM numbered
WHERE playlist_items.id = numbered.id;

-- Add the constraint
ALTER TABLE playlist_items 
ALTER COLUMN position SET NOT NULL,
ADD CONSTRAINT playlist_items_position_check CHECK (position > 0);

-- Recreate the old index
CREATE INDEX idx_playlist_items_playlist_position 
ON playlist_items(playlist_id, position);

-- Drop the new index
DROP INDEX IF EXISTS idx_playlist_items_playlist_added_at;
```

## Testing After Migration

### Test 1: Add a track to a playlist
```bash
curl -X POST http://localhost:3001/api/playlists/{playlistId}/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "title": "Test Song",
    "audius_track_id": "test123",
    "audius_stream_url": "https://audius.co/stream/test123",
    "duration_seconds": 180
  }'
```

Expected: Track is added successfully without position field in response.

### Test 2: Query items are properly ordered
```sql
SELECT id, playlist_id, track_id, added_at 
FROM playlist_items 
WHERE playlist_id = 'your-playlist-id'
ORDER BY added_at DESC;
```

Expected: Items are returned in chronological order (newest first).

## Notes

- The `added_at` column has a default value of `NOW()`, so all new items will automatically get a timestamp
- Existing items already have `added_at` values, so no data migration is needed
- The unique constraint `(playlist_id, track_id)` remains unchanged
- RLS policies are not affected by this change

## Support

If you encounter any issues during migration:
1. Check the Supabase logs for any errors
2. Verify RLS policies are still working correctly
3. Test the POST /api/playlists/:playlistId/items endpoint
4. Restore from backup if needed and contact support
