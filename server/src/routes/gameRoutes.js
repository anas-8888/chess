import express from 'express';
import { getGameDetails } from '../controllers/gameController.js';
import { validateGameId } from '../middlewares/validation/gameValidation.js';

const router = express.Router();

// الحصول على تفاصيل اللعبة
router.get('/:id', validateGameId, getGameDetails);

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