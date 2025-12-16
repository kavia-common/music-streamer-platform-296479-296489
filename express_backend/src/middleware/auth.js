const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase admin client for token verification only
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

/**
 * Middleware to authenticate requests using Supabase JWT token
 * Verifies the access token from the Authorization header and creates
 * a user-scoped Supabase client for RLS policy enforcement
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
// PUBLIC_INTERFACE
async function authenticateToken(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token is required',
        details: 'Please provide a valid JWT token in the Authorization header'
      });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        details: 'Token verification failed. Please login again.'
      });
    }

    // Create a user-scoped Supabase client with the user's access token
    // This ensures RLS policies have access to auth.uid()
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Attach both user and user-scoped Supabase client to request object
    req.user = user;
    req.supabase = userSupabase;
    req.accessToken = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
}

module.exports = {
  authenticateToken
};
