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

/**
 * @swagger
 * /api/playlists/{playlistId}/items:
 *   post:
 *     summary: Add a track to a playlist
 *     description: Upsert a track into the tracks table by audius_track_id and add it to the specified playlist. Ensures tables exist and handles duplicates.
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the playlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - audius_track_id
 *               - audius_stream_url
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Amazing Song"
 *                 description: Title of the track
 *               duration_seconds:
 *                 type: integer
 *                 example: 180
 *                 description: Duration of the track in seconds
 *               audius_track_id:
 *                 type: string
 *                 example: "abc123"
 *                 description: Unique Audius track identifier
 *               audius_stream_url:
 *                 type: string
 *                 example: "https://audius.co/stream/abc123"
 *                 description: Audius streaming URL for the track
 *     responses:
 *       201:
 *         description: Track added to playlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 playlist_item:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     playlist_id:
 *                       type: string
 *                       format: uuid
 *                     position:
 *                       type: integer
 *                     added_at:
 *                       type: string
 *                       format: date-time
 *                     tracks:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         title:
 *                           type: string
 *                         duration_seconds:
 *                           type: integer
 *                         audius_track_id:
 *                           type: string
 *                         audius_stream_url:
 *                           type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request - validation failed
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Permission denied - User does not own the playlist
 *       404:
 *         description: Playlist not found
 *       409:
 *         description: Track already exists in playlist
 *       500:
 *         description: Server error
 */
// PUBLIC_INTERFACE
router.post('/:playlistId/items', authenticateToken, playlistsController.addTrackToPlaylist.bind(playlistsController));

module.exports = router;
