import express from 'express';
import { getGameDetails, updateGameTime } from '../controllers/gameController.js';
import { validateGameId, validateUpdateTime } from '../middlewares/validation/gameValidation.js';

const router = express.Router();

// الحصول على تفاصيل اللعبة
router.get('/:id', validateGameId, getGameDetails);

// تحديث وقت اللعبة
router.post('/:id/update-time', validateUpdateTime, updateGameTime);

// Route للـ /api/game/ بدون معرف
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Game API is working. Use /api/game/:id to get game details',
    endpoints: {
      'GET /api/game/:id': 'Get game details by ID'
    }
  });
});

export default router; 