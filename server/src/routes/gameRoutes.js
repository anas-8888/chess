import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import * as gameController from '../controllers/gameController.js';

const router = express.Router();

// Game routes - جميع المسارات تتطلب مصادقة

// All game routes require authentication
router.use(protect);

// Create new game
router.post('/', gameController.createGame);

// Create game from invite
router.post('/from-invite', gameController.createGameFromInvite);

// List user's games
router.get('/', gameController.listGames);

// Get active game for current user (MUST be before /:id)
router.get('/active', gameController.getActiveGame);

// Get game by ID
router.get('/:id', gameController.getGameById);

// Get game moves
router.get('/:id/moves', gameController.getGameMoves);

// Make a move
router.post('/:id/moves', gameController.makeMove);

// Resign game
router.post('/:id/resign', gameController.resignGame);

// Offer draw
router.post('/:id/draw-offer', gameController.offerDraw);

// Accept draw
router.post('/:id/draw-accept', gameController.acceptDraw);

// Decline draw
router.post('/:id/draw-decline', gameController.declineDraw);

// Pause game
router.post('/:id/pause', gameController.pauseGame);

// Resume game
router.post('/:id/resume', gameController.resumeGame);

// Offer/accept draw (legacy)
router.post('/:id/draw', gameController.drawGame);

// Get game players
router.get('/:id/players', gameController.getGamePlayers);

// Time sync and update routes
router.get('/:id/time-sync', gameController.syncGameTime);
router.post('/:id/time-update', gameController.updateGameTime);

// GET /api/games/dashboard - Get active games for dashboard
router.get('/dashboard', gameController.getActiveGamesForDashboard);

// POST /api/games/quick-match - Start quick match
router.post('/quick-match', gameController.startQuickMatch);

export default router;
