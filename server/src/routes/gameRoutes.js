import express from 'express';
import { getGameDetails, updateGameTime, getGameMoves } from '../controllers/gameController.js';
import { validateGameId, validateUpdateTime } from '../middlewares/validation/gameValidation.js';

const router = express.Router();

// الحصول على تفاصيل اللعبة
router.get('/:id', validateGameId, getGameDetails);

// جلب حركات اللعبة
router.get('/:id/moves', validateGameId, getGameMoves);

// تحديث وقت اللعبة
router.post('/:id/update-time', validateUpdateTime, updateGameTime);

// Route للـ /api/game/ بدون معرف
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Game API is working. Use /api/game/:id to get game details',
    endpoints: {
      'GET /api/game/:id': 'Get game details by ID',
      'GET /api/game/:id/moves': 'Get game moves by ID'
    }
  });
});

export default router; 