import express from 'express';
import * as puzzleController from '../controllers/puzzleController.js';
import {
  protect,
  requireRole,
} from '../middlewares/authMiddleware.js';
import {
  createPuzzleValidation,
  updatePuzzleValidation,
  puzzleIdValidation,
  listPuzzlesValidation,
} from '../middlewares/validation/puzzleValidation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/puzzles - List all puzzles (with pagination and filtering)
router.get('/', listPuzzlesValidation, puzzleController.list);

// GET /api/puzzles/random - Get random puzzle
router.get('/random', puzzleController.getRandom);

// GET /api/puzzles/random/:level - Get random puzzle by level
router.get('/random/:level', puzzleController.getRandom);

// POST /api/puzzles/random/validate - Validate random puzzle solution
router.post('/random/validate', puzzleController.validateRandomSolution);

// POST /api/puzzles/random/:level/validate - Validate random puzzle solution by level
router.post(
  '/random/:level/validate',
  puzzleController.validateRandomSolutionByLevel
);

// GET /api/puzzles/level/:level - Get puzzles by level
router.get('/level/:level', puzzleController.getByLevel);

// POST /api/puzzles/:id/validate - Validate puzzle solution
router.post(
  '/:id/validate',
  puzzleIdValidation,
  puzzleController.validateSolution
);

// GET /api/puzzles/:id - Get puzzle by ID (must be last to avoid conflicts)
router.get('/:id', puzzleIdValidation, puzzleController.getById);

// POST /api/puzzles - Create new puzzle (admin only)
router.post(
  '/',
  requireRole('admin'),
  createPuzzleValidation,
  puzzleController.create
);

// PUT /api/puzzles/:id - Update puzzle (admin only)
router.put(
  '/:id',
  requireRole('admin'),
  updatePuzzleValidation,
  puzzleController.update
);

// DELETE /api/puzzles/:id - Delete puzzle (admin only)
router.delete(
  '/:id',
  requireRole('admin'),
  puzzleIdValidation,
  puzzleController.deletePuzzle
);

export default router;
