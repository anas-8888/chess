import { getGameDetailsService, updateGameTimeService } from '../services/gameService.js';
import logger from '../utils/logger.js';

// الحصول على تفاصيل اللعبة
export const getGameDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getGameDetailsService(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('خطأ في جلب تفاصيل اللعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// الحصول على قائمة الألعاب
export const getGamesList = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Game API is working. Use /api/game/:id to get game details',
      endpoints: {
        'GET /api/game/:id': 'Get game details by ID'
      },
      example: {
        url: '/api/game/1',
        description: 'Get details for game with ID 1'
      }
    });
  } catch (error) {
    logger.error('خطأ في جلب قائمة الألعاب:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// تحديث وقت اللعبة
export const updateGameTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { whiteTimeLeft, blackTimeLeft, currentTurn } = req.body;

    const result = await updateGameTimeService(id, { whiteTimeLeft, blackTimeLeft, currentTurn });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('خطأ في تحديث وقت اللعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};