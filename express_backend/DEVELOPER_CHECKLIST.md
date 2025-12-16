# Developer Checklist for Authenticated Routes

Use this checklist when creating or modifying authenticated routes that interact with Supabase.

---

## ✅ Creating a New Authenticated Route

- [ ] Import `authenticateToken` middleware from `../middleware/auth`
- [ ] Apply middleware to route: `router.method('/path', authenticateToken, handler)`
- [ ] Use `req.supabase` for ALL database operations (not a module-level client)
- [ ] Use `req.user.id` for user identification (equals `auth.uid()`)
- [ ] Validate `req.supabase` exists at the start of handler
- [ ] For INSERT operations: set `user_id` or `owner_id` to `req.user.id`
- [ ] Add ownership filters: `.eq('user_id', userId)` or `.eq('owner_id', userId)`
- [ ] Handle errors with proper HTTP status codes (400, 401, 403, 404, 500)
- [ ] Add descriptive error messages with `details` field
- [ ] Log errors for debugging: `console.error('Context:', error)`
- [ ] Add JSDoc comments explaining the endpoint
- [ ] Add `// PUBLIC_INTERFACE` comment above the handler
- [ ] Update OpenAPI/Swagger documentation
- [ ] Test with valid JWT token
- [ ] Test without token (should return 401)
- [ ] Test with expired token (should return 401)
- [ ] Verify RLS policies are respected

---

## ✅ Modifying Existing Authenticated Route

- [ ] Check if route uses `req.supabase` (not module-level client)
- [ ] Verify `authenticateToken` middleware is applied
- [ ] Ensure `req.user.id` is used for user identification
- [ ] Check that ownership filters are in place
- [ ] Validate error handling is comprehensive
- [ ] Update tests if behavior changes
- [ ] Update API documentation if interface changes
- [ ] Test the change with real JWT token
- [ ] Verify no regression in authentication flow

---

## ✅ Code Review Checklist

When reviewing code that includes authenticated routes:

- [ ] `authenticateToken` middleware is applied to the route
- [ ] `req.supabase` is used (NOT `supabase` module-level variable)
- [ ] `req.user.id` is used for user identification
- [ ] No hardcoded user IDs or owner IDs
- [ ] Proper validation of `req.supabase` existence
- [ ] INSERT operations set `owner_id`/`user_id` to `req.user.id`
- [ ] Ownership filters applied: `.eq('owner_id', userId)`
- [ ] Error handling covers all failure cases
- [ ] Error messages are clear and actionable
- [ ] No sensitive information leaked in errors
- [ ] JSDoc documentation is present
- [ ] `PUBLIC_INTERFACE` marker is added
- [ ] Tests are included or updated

---

## ✅ Testing Checklist

Before deploying changes to authenticated routes:

### Manual Testing
- [ ] Server starts without errors
- [ ] Route is accessible at expected path
- [ ] Request with valid token succeeds
- [ ] Request without token returns 401
- [ ] Request with invalid token returns 401
- [ ] Request with expired token returns 401
- [ ] Data is correctly scoped to authenticated user
- [ ] Other users' data is not accessible
- [ ] RLS policies are enforced
- [ ] Error messages are helpful

### Automated Testing
- [ ] Unit tests cover the handler logic
- [ ] Integration tests verify authentication flow
- [ ] RLS enforcement is tested
- [ ] Edge cases are covered

---

## ✅ Common Mistakes to Avoid

- [ ] ❌ Using module-level Supabase client in authenticated routes
- [ ] ❌ Forgetting to apply `authenticateToken` middleware
- [ ] ❌ Not validating `req.supabase` exists
- [ ] ❌ Using wrong user ID (profile id instead of auth.uid)
- [ ] ❌ Missing ownership filters in queries
- [ ] ❌ Not handling authentication errors properly
- [ ] ❌ Leaking sensitive information in error messages
- [ ] ❌ Hardcoding user IDs or owner IDs
- [ ] ❌ Bypassing RLS with service role client
- [ ] ❌ Not testing with real authentication

---

## ✅ Security Checklist

- [ ] User authentication is required for the route
- [ ] JWT token is verified by middleware
- [ ] User-scoped client is used for database operations
- [ ] RLS policies are in place and enforced
- [ ] Users can only access their own data
- [ ] No data leakage between users
- [ ] Service role is never used for user operations
- [ ] Proper authorization checks are in place
- [ ] Input validation prevents injection attacks
- [ ] Error messages don't reveal system internals

---

## ✅ Performance Checklist

- [ ] Queries include appropriate filters (don't fetch unnecessary data)
- [ ] Indexes exist for commonly queried fields
- [ ] No N+1 query patterns
- [ ] Pagination is implemented for large result sets
- [ ] Unnecessary data fields are not selected
- [ ] Client creation overhead is acceptable (per-request is fine)

---

## 📚 Quick Reference

### Template for New Authenticated Route

```javascript
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// PUBLIC_INTERFACE
/**
 * Description of what this endpoint does
 * @param {object} req - Express request with authenticated user
 * @param {object} res - Express response
 */
router.post('/resource', authenticateToken, async (req, res) => {
  try {
    // Get user-scoped client and user ID
    const supabase = req.supabase;
    const userId = req.user.id;

    // Validate context
    if (!supabase) {
      return res.status(500).json({ 
        error: 'Authentication context not available' 
      });
    }

    // Your logic here
    const { data, error } = await supabase
      .from('your_table')
      .insert([{
        user_id: userId,  // or owner_id: userId
        // other fields...
      }])
      .select()
      .single();

    if (error) {
      console.error('Error:', error);
      throw error;
    }

    return res.status(201).json({ data });
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ 
      error: 'Operation failed',
      details: error.message
    });
  }
});

module.exports = router;
```

---

## 📖 Documentation References

- [RLS Fix Documentation](./docs/RLS_FIX_DOCUMENTATION.md)
- [Authenticated Routes Guide](./docs/AUTHENTICATED_ROUTES_GUIDE.md)
- [Supabase Schema](./docs/supabase_schema.sql)
- [Test Script](./test_playlist_rls.js)

---

## 🚀 Before You Push

Final checklist before committing:

- [ ] All code changes are complete
- [ ] Linter passes: `npm run lint`
- [ ] Server starts: `npm start`
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] No console.log() debug statements left in code
- [ ] Error handling is comprehensive
- [ ] Security best practices followed
- [ ] Performance considerations addressed
- [ ] Code review requested (if applicable)

---

**Remember**: Authentication and authorization are critical for security. When in doubt, refer to the documentation or ask for a code review!
