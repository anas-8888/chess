import express from 'express';
import { protect, userOnly } from '../middlewares/authMiddleware.js';
import {
  joinRandomMatchmaking,
  leaveRandomMatchmaking,
} from '../controllers/matchmakingController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(userOnly);

// POST /api/matchmaking/random/join - Join random matchmaking
router.post('/random/join', joinRandomMatchmaking);

// DELETE /api/matchmaking/random/leave - Leave random matchmaking
router.delete('/random/leave', leaveRandomMatchmaking);

export default router; 