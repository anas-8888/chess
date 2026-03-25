import express from 'express';
import {
  getGameDetails,
  updateGameTime,
  getGameMoves,
  getGameDuration,
  controlPlayer,
  getGameState,
  resignGame,
  recordAiGameResult,
  createAiGameSession,
  getActiveAiGameSession,
  recordAiGameMove,
  finalizeAiGame,
} from '../controllers/gameController.js';
import { validateGameId, validateUpdateTime } from '../middlewares/validation/gameValidation.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// تسجيل نتيجة مباراة الذكاء الاصطناعي
router.post('/ai/result', protect, recordAiGameResult);
router.post('/ai/session', protect, createAiGameSession);
router.get('/ai/session/active', protect, getActiveAiGameSession);
router.post('/ai/:gameId/move', protect, recordAiGameMove);
router.post('/ai/:gameId/finalize', protect, finalizeAiGame);

// الحصول على تفاصيل اللعبة
router.get('/:id', validateGameId, getGameDetails);

// الحصول على نقلات اللعبة
router.get('/:id/moves', validateGameId, getGameMoves);

// الحصول على مدة اللعبة
router.get('/:id/duration', validateGameId, getGameDuration);

// الحصول على حالة اللعبة الحالية
router.get('/:id/state', validateGameId, getGameState);
router.post('/:id/resign', protect, validateGameId, resignGame);

// تحديث وقت اللعبة
router.post('/:id/update-time', validateUpdateTime, updateGameTime);

// التحكم في لاعب معين (للتحكم عبر Postman)
router.post('/control-player', controlPlayer);

// Route للـ /api/game/ بدون معرف
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Game API is working. Use /api/game/:id to get game details',
    endpoints: {
      'GET /api/game/:id': 'Get game details by ID',
      'GET /api/game/:id/state': 'Get current game state',
      'POST /api/game/control-player': 'Control a player (make moves, resign, etc.)'
    }
  });
});

export default router;
