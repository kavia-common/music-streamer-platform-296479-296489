const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favorites');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Favorites
 *   description: User favorites management endpoints
 */

/**
 * @swagger
 * /api/favorites:
 *   post:
 *     summary: Add a track to favorites
 *     description: Insert a track into the authenticated user's favorites table with user_id from auth session and created_at timestamp. Prevents duplicate entries per user_id + track_id.
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - track_id
 *             properties:
 *               track_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: UUID of the track to add to favorites
 *     responses:
 *       201:
 *         description: Track added to favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorite:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     track_id:
 *                       type: string
 *                       format: uuid
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request - track_id is required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Track not found
 *       409:
 *         description: Track already in favorites
 *       500:
 *         description: Server error
 */
router.post('/', authenticateToken, favoritesController.addFavorite.bind(favoritesController));

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Get all favorites for the authenticated user
 *     description: Returns the current user's favorite tracks with track metadata, ordered by created_at descending
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       track_id:
 *                         type: string
 *                         format: uuid
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       track:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           duration_seconds:
 *                             type: integer
 *                           audius_track_id:
 *                             type: string
 *                           audius_stream_url:
 *                             type: string
 *                           artist_name:
 *                             type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get('/', authenticateToken, favoritesController.getFavorites.bind(favoritesController));

/**
 * @swagger
 * /api/favorites/{trackId}:
 *   delete:
 *     summary: Remove a track from favorites
 *     description: Delete a track from the authenticated user's favorites by track_id
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the track to remove from favorites
 *     responses:
 *       200:
 *         description: Track removed from favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid track ID format
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Favorite not found
 *       500:
 *         description: Server error
 */
router.delete('/:trackId', authenticateToken, favoritesController.removeFavorite.bind(favoritesController));

module.exports = router;
