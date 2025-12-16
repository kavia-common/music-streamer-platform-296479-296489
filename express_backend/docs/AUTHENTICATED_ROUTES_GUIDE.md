# Authenticated Routes Quick Reference Guide

## Overview

When building authenticated routes in this Express backend, you must use the **user-scoped Supabase client** to ensure Row-Level Security (RLS) policies work correctly.

## The Golden Rule

**Always use `req.supabase` (not a module-level client) for database operations in authenticated routes.**

## Quick Start Template

```javascript
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// PUBLIC_INTERFACE
router.get('/my-resource', authenticateToken, async (req, res) => {
  try {
    // ✅ CORRECT: Use req.supabase (user-scoped client)
    const supabase = req.supabase;
    const userId = req.user.id;

    // Validate client is available
    if (!supabase) {
      return res.status(500).json({ 
        error: 'Authentication context not available' 
      });
    }

    // Perform database operations
    const { data, error } = await supabase
      .from('my_table')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Operation failed',
      details: error.message
    });
  }
});

module.exports = router;
```

## What You Get from `authenticateToken` Middleware

After the `authenticateToken` middleware runs, the following is attached to `req`:

| Property | Type | Description |
|----------|------|-------------|
| `req.user` | Object | The authenticated user object from Supabase auth |
| `req.user.id` | UUID String | The authenticated user's ID (equals `auth.uid()` in DB) |
| `req.supabase` | Supabase Client | User-scoped client with JWT token in headers |
| `req.accessToken` | String | The raw JWT access token |

## Common Patterns

### 1. Simple SELECT Query

```javascript
router.get('/items', authenticateToken, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ items: data });
});
```

### 2. INSERT with User Ownership

```javascript
router.post('/items', authenticateToken, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const { name, description } = req.body;

  // RLS policy will check that user_id = auth.uid()
  const { data, error } = await supabase
    .from('items')
    .insert([{
      user_id: userId,  // Must match auth.uid() for RLS
      name,
      description
    }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ item: data });
});
```

### 3. UPDATE with Ownership Check

```javascript
router.put('/items/:id', authenticateToken, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const { id } = req.params;
  const { name } = req.body;

  // RLS will ensure user can only update their own items
  const { data, error } = await supabase
    .from('items')
    .update({ name })
    .eq('id', id)
    .eq('user_id', userId)  // Double-check ownership
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ item: data });
});
```

### 4. DELETE with Ownership Check

```javascript
router.delete('/items/:id', authenticateToken, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const { id } = req.params;

  // RLS will ensure user can only delete their own items
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Item deleted' });
});
```

## Common Mistakes to Avoid

### ❌ DON'T: Use Module-Level Supabase Client

```javascript
// BAD - This bypasses RLS and user context
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);  // Module-level

router.get('/items', authenticateToken, async (req, res) => {
  // This won't have user context - auth.uid() will be null
  const { data } = await supabase.from('items').select('*');
  // ...
});
```

### ❌ DON'T: Forget to Apply authenticateToken Middleware

```javascript
// BAD - No authentication
router.get('/items', async (req, res) => {
  // req.supabase won't exist!
  const supabase = req.supabase;  // undefined
  // ...
});
```

### ❌ DON'T: Use Wrong User ID

```javascript
// BAD - Using profile id instead of auth user id
const { data: profile } = await supabase
  .from('profiles')
  .select('id')  // Wrong! This is profile's ID
  .single();

// Don't do this:
await supabase.from('items').insert([{
  user_id: profile.id  // Should be req.user.id (auth.uid())
}]);
```

## ✅ DO: Best Practices

1. **Always use `req.supabase`** in authenticated routes
2. **Set owner/user ID to `req.user.id`** for inserts
3. **Validate client exists** before using it
4. **Add ownership filters** (`.eq('user_id', userId)`) even if RLS enforces it
5. **Handle errors gracefully** with meaningful messages
6. **Log errors** for debugging

## RLS Policy Alignment

When your RLS policy looks like this:

```sql
CREATE POLICY "users_select_own" 
ON my_table FOR SELECT 
USING (auth.uid() = user_id);
```

Your code should use:

```javascript
const userId = req.user.id;  // This IS auth.uid()

const { data } = await req.supabase  // User-scoped client
  .from('my_table')
  .select('*')
  .eq('user_id', userId);  // Explicit filter (RLS also enforces)
```

## Testing Your Authenticated Routes

### Using curl

```bash
# 1. Get a token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Use the token
curl -X GET http://localhost:3001/api/your-route \
  -H "Authorization: Bearer $TOKEN"
```

### Using the Test Script

```bash
node test_playlist_rls.js YOUR_ACCESS_TOKEN
```

## Controller Pattern

For more complex logic, create a controller class:

```javascript
// controllers/items.js
class ItemsController {
  // PUBLIC_INTERFACE
  async getItems(req, res) {
    try {
      const supabase = req.supabase;
      const userId = req.user.id;

      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication context not available' 
        });
      }

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return res.status(200).json({ items: data });
    } catch (error) {
      console.error('Error in getItems:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch items',
        details: error.message
      });
    }
  }
}

module.exports = new ItemsController();
```

## Summary Checklist

When creating a new authenticated route:

- [ ] Import `authenticateToken` middleware
- [ ] Apply middleware to route: `router.method('/path', authenticateToken, handler)`
- [ ] Use `req.supabase` for all database operations
- [ ] Use `req.user.id` for user identification
- [ ] Validate `req.supabase` exists before using
- [ ] Handle errors with proper status codes
- [ ] Test with valid JWT token
- [ ] Verify RLS policies are respected

## Need Help?

- Check the [RLS Fix Documentation](./RLS_FIX_DOCUMENTATION.md)
- Review existing routes: `src/routes/playlists.js` or `src/routes/profile.js`
- Test with: `node test_playlist_rls.js YOUR_TOKEN`
