const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase client
// Note: SUPABASE_URL and SUPABASE_KEY must be set in the .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper function to create or ensure profile exists for a user
 * @param {string} userId - The user's UUID from Supabase auth
 * @param {string} username - The desired username
 * @param {string} email - The user's email (used as fallback for username)
 * @returns {Promise<{profile: object, created: boolean}>} The profile object and whether it was newly created
 */
async function ensureProfileExists(userId, username, email) {
  try {
    // Check if profile already exists (idempotency check)
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Profile already exists, return it
      return { profile: existingProfile, created: false };
    }

    // Profile doesn't exist, create it
    // Generate username from email if not provided
    const finalUsername = username || email.split('@')[0] + '_' + userId.substring(0, 8);

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          user_id: userId,
          username: finalUsername,
          display_name: username || null,
          avatar_url: null
        }
      ])
      .select()
      .single();

    if (insertError) {
      // Check if error is due to duplicate username
      if (insertError.code === '23505' && insertError.message.includes('username')) {
        // Username conflict, try with a unique suffix
        const uniqueUsername = finalUsername + '_' + Date.now();
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .insert([
            {
              user_id: userId,
              username: uniqueUsername,
              display_name: username || null,
              avatar_url: null
            }
          ])
          .select()
          .single();

        if (retryError) {
          throw retryError;
        }
        return { profile: retryProfile, created: true };
      }
      throw insertError;
    }

    return { profile: newProfile, created: true };
  } catch (error) {
    console.error('Error ensuring profile exists:', error);
    throw error;
  }
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password using Supabase Auth and create a corresponding profile record
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *               username:
 *                 type: string
 *                 example: johndoe
 *     responses:
 *       200:
 *         description: User registered successfully with profile created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 profile:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     avatar_url:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Registration failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
// PUBLIC_INTERFACE
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign up user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || null
        }
      }
    });

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        details: 'Failed to create authentication account'
      });
    }

    // Check if user was created
    if (!data.user) {
      return res.status(400).json({ 
        error: 'Registration failed',
        details: 'User account was not created'
      });
    }

    // Create profile record for the new user
    let profileResult;
    try {
      profileResult = await ensureProfileExists(data.user.id, username, email);
    } catch (profileError) {
      console.error('Profile creation error:', profileError);
      // Profile creation failed, but auth account was created
      // Return success but inform about profile issue
      return res.status(200).json({
        user: data.user,
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        message: data.session 
          ? 'Registration successful but profile creation pending. Please contact support if issues persist.'
          : 'Registration successful. Please check your email to confirm your account. Profile will be created upon confirmation.',
        profile_error: profileError.message
      });
    }

    // Check if session is available (email confirmation may be required)
    if (data.session) {
      return res.status(200).json({
        user: data.user,
        profile: profileResult.profile,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        message: profileResult.created 
          ? 'Registration successful. Profile created.'
          : 'Registration successful. Existing profile found.'
      });
    } else {
      // Email confirmation required
      return res.status(200).json({
        user: data.user,
        profile: profileResult.profile,
        message: profileResult.created
          ? 'Registration successful. Profile created. Please check your email to confirm your account.'
          : 'Registration successful. Existing profile found. Please check your email to confirm your account.'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ 
      error: 'Registration failed',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password using Supabase Auth
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *       400:
 *         description: Login failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// PUBLIC_INTERFACE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign in user with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      user: data.user,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(400).json({ error: 'Login failed' });
  }
});

module.exports = router;
