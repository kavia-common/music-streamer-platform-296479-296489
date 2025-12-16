const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const playlistsController = require('../controllers/playlists');

const router = express.Router();

/**
 * @swagger
 * /api/playlists:
 *   post:
 *     summary: Create a new playlist
 *     description: Create a new playlist for the authenticated user with the specified name, empty description, and public visibility
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Awesome Playlist
 *                 description: Name of the playlist (max 100 characters)
 *     responses:
 *       201:
 *         description: Playlist created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 playlist:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     is_public:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request - validation failed
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Server error
 */
// PUBLIC_INTERFACE
router.post('/', authenticateToken, playlistsController.createPlaylist.bind(playlistsController));

/**
 * @swagger
 * /api/playlists:
 *   get:
 *     summary: Get all playlists for the authenticated user
 *     description: Retrieve all playlists owned by the authenticated user, ordered by creation date (newest first)
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Playlists retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 playlists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       is_public:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
// PUBLIC_INTERFACE
router.get('/', authenticateToken, playlistsController.getPlaylists.bind(playlistsController));

module.exports = router;
