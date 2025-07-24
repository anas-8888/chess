import express from 'express';
import { protect, userOnly } from '../middlewares/authMiddleware.js';
import {
  createChallenge,
  getChallenges,
  acceptChallenge,
  rejectChallenge,
} from '../controllers/challengeController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(userOnly);

// POST /api/challenges - Create a new challenge
router.post('/', createChallenge);

// GET /api/challenges - Get user's challenges
router.get('/', getChallenges);

// PUT /api/challenges/:id/accept - Accept a challenge
router.put('/:id/accept', acceptChallenge);

// PUT /api/challenges/:id/reject - Reject a challenge
router.put('/:id/reject', rejectChallenge);

export default router; 