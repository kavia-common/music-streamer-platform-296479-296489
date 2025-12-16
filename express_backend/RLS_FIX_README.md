# RLS Fix - Playlist Creation Issue Resolved ✅

## Problem Fixed

**Issue**: Creating playlists failed with error:
```
new row violates row-level security policy for table "playlists"
```

**Root Cause**: The backend was using a service-role Supabase client without user authentication context, so `auth.uid()` was unavailable to RLS policies.

## Solution Implemented

### 1. Updated Authentication Middleware (`src/middleware/auth.js`)
- Creates a **user-scoped Supabase client** with the user's JWT token
- Attaches the user-scoped client to `req.supabase`
- Ensures `auth.uid()` is available in database operations

### 2. Updated Controllers and Routes
- **Playlists Controller** (`src/controllers/playlists.js`): Uses `req.supabase` instead of module-level client
- **Profile Routes** (`src/routes/profile.js`): Uses `req.supabase` for all operations

### 3. Key Changes

**Before (Broken)**:
```javascript
// Module-level client (no user context)
const supabase = createClient(url, key);

// RLS fails: auth.uid() is null
await supabase.from('playlists').insert([...]);
```

**After (Fixed)**:
```javascript
// User-scoped client from middleware
const supabase = req.supabase;

// RLS works: auth.uid() matches authenticated user
await supabase.from('playlists').insert([{
  owner_id: req.user.id  // Matches auth.uid()
}]);
```

## Verification Steps

### Quick Test (Manual)

1. **Register or login to get a token**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

2. **Save the access_token from response**

3. **Create a playlist**:
```bash
curl -X POST http://localhost:3001/api/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"name":"My Test Playlist"}'
```

4. **Expected Result**: HTTP 201 with playlist data
```json
{
  "playlist": {
    "id": "uuid-here",
    "name": "My Test Playlist",
    "description": "",
    "is_public": true,
    "created_at": "...",
    "updated_at": "..."
  },
  "message": "Playlist created successfully"
}
```

### Using the Test Script

```bash
# If you have a token already
node test_playlist_rls.js YOUR_ACCESS_TOKEN
```

The script will:
- ✅ Fetch your profile
- ✅ Create a test playlist
- ✅ Verify it appears in your playlist list

## What Was Changed

### Files Modified:
1. ✅ `src/middleware/auth.js` - Added user-scoped client creation
2. ✅ `src/controllers/playlists.js` - Use req.supabase instead of module client
3. ✅ `src/routes/profile.js` - Use req.supabase for profile operations

### Files Created:
1. ✅ `test_playlist_rls.js` - Test script for verification
2. ✅ `docs/RLS_FIX_DOCUMENTATION.md` - Detailed technical documentation
3. ✅ `docs/AUTHENTICATED_ROUTES_GUIDE.md` - Developer guide for authenticated routes

## Technical Details

### How RLS Now Works

1. **User authenticates** → JWT token in Authorization header
2. **Middleware verifies token** → Creates user-scoped Supabase client
3. **Client carries JWT** → Every DB operation has user context
4. **Supabase extracts auth.uid()** → RLS policies can validate ownership
5. **Policy checks** → `WITH CHECK (auth.uid() = owner_id)` succeeds

### Schema Alignment

```
auth.users (Supabase auth)
    ↓ (id)
profiles.user_id ← req.user.id ← auth.uid()
    ↓
playlists.owner_id (must equal auth.uid() per RLS)
```

## Error Handling Improvements

The fix includes better error messages:

- **401**: Token missing or invalid
- **403**: RLS policy violation (with helpful hints)
- **404**: Profile not found
- **500**: Server errors with details

## Impact on Other Routes

This fix also improves:
- ✅ Profile GET/PUT endpoints now use user-scoped client
- ✅ All future authenticated routes should follow this pattern

## Best Practices for New Routes

When creating authenticated routes:

1. **Apply middleware**: `router.method('/path', authenticateToken, handler)`
2. **Use req.supabase**: Never create module-level Supabase clients
3. **Use req.user.id**: This equals auth.uid() in the database
4. **Validate context**: Check that req.supabase exists
5. **Handle errors**: Provide clear, actionable error messages

Example:
```javascript
router.post('/resource', authenticateToken, async (req, res) => {
  const supabase = req.supabase;  // User-scoped client
  const userId = req.user.id;      // auth.uid()
  
  // Your logic here
});
```

## Documentation

For detailed information:
- [RLS Fix Documentation](./docs/RLS_FIX_DOCUMENTATION.md) - Complete technical details
- [Authenticated Routes Guide](./docs/AUTHENTICATED_ROUTES_GUIDE.md) - Developer quick reference
- [Supabase Schema](./docs/supabase_schema.sql) - Database schema with RLS policies

## Testing Checklist

- [x] Server starts without errors
- [x] Health endpoint responds
- [x] User can register/login
- [x] Profile endpoint works with authentication
- [x] Playlist creation succeeds with valid token
- [x] Playlist creation fails without token (401)
- [x] Created playlists appear in user's list
- [x] RLS policies enforce ownership

## Rollback (If Needed)

If issues arise, the key change is in `src/middleware/auth.js`. The middleware now creates:
```javascript
req.supabase = createClient(url, key, {
  global: { headers: { Authorization: `Bearer ${token}` }}
});
```

And controllers/routes use `req.supabase` instead of a module-level client.

## Questions or Issues?

1. Check the detailed documentation in `docs/`
2. Review the test script: `test_playlist_rls.js`
3. Verify environment variables are set (SUPABASE_URL, SUPABASE_KEY)
4. Check server logs for specific error messages

## Success Criteria ✅

- [x] Playlists can be created via POST /api/playlists with valid JWT
- [x] RLS policies correctly enforce auth.uid() = owner_id
- [x] No bypass of row-level security
- [x] Clear error messages for authentication failures
- [x] All existing functionality still works
- [x] Code follows best practices for Supabase authentication

---

**Status**: ✅ FIXED AND VERIFIED

**Date**: 2025-12-16

**Impact**: All authenticated routes now properly support RLS policies
