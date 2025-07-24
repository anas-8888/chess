import express from 'express';
import { protect, userOnly, ownerOrAdmin } from '../middlewares/authMiddleware.js';
import { 
  getUserGameHistory
} from '../controllers/historyController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(userOnly);

// GET /api/history/:id/games - Get user's game history (legacy)
router.get('/:id/games', ownerOrAdmin('id'), getUserGameHistory);

export default router; 