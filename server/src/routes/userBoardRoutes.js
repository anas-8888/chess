import express from 'express';
import * as userBoardController from '../controllers/userBoardController.js';
import {
  protect,
  checkOwnership,
} from '../middlewares/authMiddleware.js';
import {
  createUserBoardValidation,
  updateUserBoardValidation,
  userBoardIdValidation,
  listUserBoardsValidation,
} from '../middlewares/validation/userBoardValidation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/boards - List all boards (with pagination and filtering)
router.get('/', listUserBoardsValidation, userBoardController.list);

// GET /api/boards/my - Get current user's boards
router.get('/my', userBoardController.getMyBoards);

// GET /api/boards/connected - Get connected boards
router.get('/connected', userBoardController.getConnectedBoards);

// GET /api/boards/disconnected - Get disconnected boards
router.get('/disconnected', userBoardController.getDisconnectedBoards);

// POST /api/boards - Create new board
router.post('/', createUserBoardValidation, userBoardController.create);

// PUT /api/boards/:id/connection - Update connection status (ownership check)
router.put(
  '/:id/connection',
  userBoardIdValidation,
  checkOwnership,
  userBoardController.updateConnectionStatus
);

// PUT /api/boards/:id - Update board (ownership check)
router.put(
  '/:id',
  updateUserBoardValidation,
  checkOwnership,
  userBoardController.update
);

// DELETE /api/boards/:id - Delete board (ownership check)
router.delete(
  '/:id',
  userBoardIdValidation,
  checkOwnership,
  userBoardController.deleteUserBoard
);

// GET /api/boards/:id - Get board by ID (ownership check) - must be last to avoid conflicts
router.get(
  '/:id',
  userBoardIdValidation,
  checkOwnership,
  userBoardController.getById
);

export default router;
