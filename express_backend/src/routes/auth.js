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
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password using Supabase Auth
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
 *         description: User registered successfully
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
 */
// PUBLIC_INTERFACE
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign up user with Supabase
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
      return res.status(400).json({ error: error.message });
    }

    // Check if session is available (email confirmation may be required)
    if (data.session) {
      return res.status(200).json({
        user: data.user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
    } else {
      // Email confirmation required
      return res.status(200).json({
        user: data.user,
        message: 'Registration successful. Please check your email to confirm your account.'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ error: 'Registration failed' });
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
