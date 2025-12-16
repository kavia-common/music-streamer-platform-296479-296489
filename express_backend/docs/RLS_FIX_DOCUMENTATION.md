# RLS (Row-Level Security) Fix Documentation

## Problem Description

When creating playlists via `POST /api/playlists`, the operation was failing with the error:
```
new row violates row-level security policy for table "playlists"
```

This occurred because the Supabase RLS policy requires:
```sql
WITH CHECK (auth.uid() = owner_id)
```

## Root Cause

The backend was using a **module-level Supabase client** initialized with the service key, which meant:

1. All database operations were performed with the service role context
2. The end-user's JWT token was **not** being passed to the database
3. `auth.uid()` was **not available** in the database session
4. RLS policies that depend on `auth.uid()` would fail

### Original Flow (Broken)
```
User Request → Auth Middleware → Controller → Module-level Supabase Client → Database
                (verifies token)                  (uses service key, no user context)
```

## Solution

### 1. Updated Authentication Middleware

**File**: `src/middleware/auth.js`

**Changes**:
- Keep the admin client for token verification only
- Create a **user-scoped Supabase client** with the user's JWT token
- Attach the user-scoped client to `req.supabase`

**Key Code**:
```javascript
// Create a user-scoped Supabase client with the user's access token
const userSupabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});

// Attach to request
req.supabase = userSupabase;
req.user = user;
req.accessToken = token;
```

### 2. Updated Playlists Controller

**File**: `src/controllers/playlists.js`

**Changes**:
- Removed module-level Supabase client
- Use `req.supabase` (user-scoped client) for all database operations
- Set `owner_id` to `userId` (which equals `auth.uid()`)

**Key Code**:
```javascript
async createPlaylist(req, res) {
  const supabase = req.supabase; // User-scoped client
  const userId = req.user.id;     // This is auth.uid()
  
  // Insert with owner_id = userId (matches auth.uid())
  const { data: playlist, error } = await supabase
    .from('playlists')
    .insert([{
      owner_id: userId,  // This now matches auth.uid() in RLS context
      name: name.trim(),
      description: '',
      is_public: true
    }])
    .select()
    .single();
}
```

### 3. Updated Profile Routes

**File**: `src/routes/profile.js`

**Changes**:
- Removed module-level Supabase client
- Use `req.supabase` for all profile operations

### New Flow (Fixed)
```
User Request → Auth Middleware → Controller → User-scoped Supabase Client → Database
                (verifies token    (uses user's JWT,
                 + creates user-   auth.uid() available)
                 scoped client)
```

## Why This Works

1. **User Context**: The user-scoped client carries the JWT token in every request to Supabase
2. **auth.uid() Available**: Supabase can extract the user ID from the JWT and make it available as `auth.uid()`
3. **RLS Enforcement**: The RLS policy `WITH CHECK (auth.uid() = owner_id)` can now verify that the owner_id matches the authenticated user
4. **Security**: Each user can only create/modify resources they own, as enforced by RLS

## Schema Alignment

The `playlists` table schema:
```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  ...
);
```

The `profiles` table schema:
```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ...
);
```

**Important**: 
- `profiles.user_id` references `auth.users(id)` (the Supabase auth user ID)
- `playlists.owner_id` references `profiles.user_id`
- Therefore, `owner_id` should be set to the authenticated user's ID (`auth.uid()`)
- In our code: `userId = req.user.id` which is the same as `auth.uid()`

## Testing

### Manual Testing

1. **Login/Register** to get an access token:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

2. **Create a playlist** with the token:
```bash
curl -X POST http://localhost:3001/api/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"name":"My Test Playlist"}'
```

3. **Expected Success Response** (201 Created):
```json
{
  "playlist": {
    "id": "uuid-here",
    "name": "My Test Playlist",
    "description": "",
    "is_public": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "Playlist created successfully"
}
```

### Automated Testing

Use the provided test script:

```bash
# Run the test script with your access token
node test_playlist_rls.js YOUR_ACCESS_TOKEN
```

The script will:
1. Fetch the user profile
2. Create a new playlist
3. Verify the playlist appears in the user's playlist list

## Error Handling

The fix includes enhanced error messages:

### Missing Token (401)
```json
{
  "error": "Access token is required",
  "details": "Please provide a valid JWT token in the Authorization header"
}
```

### Invalid Token (401)
```json
{
  "error": "Invalid or expired token",
  "details": "Token verification failed. Please login again."
}
```

### RLS Violation (403)
```json
{
  "error": "Permission denied",
  "details": "Row-level security policy violation. The owner_id must match your authenticated user ID.",
  "hint": "This usually means the authentication token is not being properly passed to the database."
}
```

## Best Practices Applied

1. ✅ **User-scoped clients**: Each authenticated request gets its own Supabase client with user context
2. ✅ **No service role bypass**: Database operations respect RLS policies
3. ✅ **Security first**: Users can only access/modify their own data
4. ✅ **Clear error messages**: Help developers debug authentication issues
5. ✅ **Consistent pattern**: All protected routes use the same authentication flow

## Impact on Other Routes

This fix also improves:
- **Profile routes** (`/api/profile`): Now properly use user-scoped client
- **Future routes**: Any new authenticated routes should follow this pattern

## Migration Notes

If you have existing code that uses a module-level Supabase client:

**Before** (❌ Broken):
```javascript
const supabase = createClient(url, key);  // Module level

router.get('/resource', authenticateToken, async (req, res) => {
  const { data } = await supabase.from('table').select();  // No user context
});
```

**After** (✅ Fixed):
```javascript
router.get('/resource', authenticateToken, async (req, res) => {
  const supabase = req.supabase;  // User-scoped client
  const { data } = await supabase.from('table').select();  // User context available
});
```

## Verification Checklist

- [x] Authentication middleware creates user-scoped client
- [x] User-scoped client attached to `req.supabase`
- [x] Playlists controller uses `req.supabase`
- [x] Profile routes use `req.supabase`
- [x] `owner_id` set to `auth.uid()` equivalent (`req.user.id`)
- [x] Enhanced error messages for debugging
- [x] Test script provided for validation
- [x] Documentation created

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JS Client Authentication](https://supabase.com/docs/reference/javascript/auth-api)
- [Database Schema](./supabase_schema.sql)
