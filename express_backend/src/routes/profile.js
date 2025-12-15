const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get current user's profile
 *     description: Retrieve the profile information for the authenticated user
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Profile not found
 */
// PUBLIC_INTERFACE
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - profile doesn't exist
        return res.status(404).json({ 
          error: 'Profile not found',
          details: 'Profile record does not exist for this user'
        });
      }
      throw error;
    }

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch profile',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update current user's profile
 *     description: Update username and display_name for the authenticated user
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               display_name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request - validation failed
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       409:
 *         description: Conflict - Username already taken
 *       404:
 *         description: Profile not found
 */
// PUBLIC_INTERFACE
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, display_name } = req.body;

    // Validate input
    if (!username && !display_name) {
      return res.status(400).json({ 
        error: 'At least one field (username or display_name) is required'
      });
    }

    // Validate username format if provided
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Username must be a non-empty string'
        });
      }
      if (username.length > 50) {
        return res.status(400).json({ 
          error: 'Username must be 50 characters or less'
        });
      }
      // Check for valid username characters (alphanumeric, underscore, hyphen)
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return res.status(400).json({ 
          error: 'Username can only contain letters, numbers, underscores, and hyphens'
        });
      }
    }

    // Validate display_name format if provided
    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Display name must be a non-empty string'
        });
      }
      if (display_name.length > 100) {
        return res.status(400).json({ 
          error: 'Display name must be 100 characters or less'
        });
      }
    }

    // Build update object with only provided fields
    const updates = {};
    if (username !== undefined) updates.username = username.trim();
    if (display_name !== undefined) updates.display_name = display_name.trim();
    updates.updated_at = new Date().toISOString();

    // Update profile in database
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation (duplicate username)
      if (error.code === '23505' && error.message.includes('username')) {
        return res.status(409).json({ 
          error: 'Username already taken',
          details: 'Please choose a different username'
        });
      }
      // Check for no rows returned
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Profile not found',
          details: 'Profile record does not exist for this user'
        });
      }
      throw error;
    }

    return res.status(200).json({ 
      profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ 
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Partially update current user's profile
 *     description: Update username and/or display_name for the authenticated user (alias for PUT)
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               display_name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Username already taken
 */
// PUBLIC_INTERFACE
router.patch('/', authenticateToken, async (req, res) => {
  // Reuse PUT handler for PATCH
  return router.stack.find(layer => layer.route && layer.route.methods.put).handle(req, res);
});

module.exports = router;
