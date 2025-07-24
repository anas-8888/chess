import express from 'express';
import { protect, userOnly } from '../middlewares/authMiddleware.js';
import { getLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(userOnly);

// GET /api/leaderboard - Get leaderboard
router.get('/', getLeaderboard);

export default router; 