import { getGameDetailsService, updateGameTimeService } from '../services/gameService.js';
import GameMove from '../models/GameMove.js';
import User from '../models/User.js';
import Game from '../models/Game.js'; // Added import for Game model
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

// الحصول على نقلات اللعبة
export const getGameMoves = async (req, res) => {
  try {
    const { id } = req.params;

    // جلب معلومات اللعبة أولاً
    const game = await Game.findByPk(id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }

    // جلب جميع النقلات مرتبة حسب الرقم
    const moves = await GameMove.findAll({
      where: { game_id: id },
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['user_id', 'username']
        }
      ],
      order: [['move_number', 'ASC'], ['created_at', 'ASC']],
      attributes: ['id', 'move_number', 'player_id', 'san', 'fen_after', 'created_at']
    });

    // تنظيم النقلات في أزواج (أبيض + أسود)
    const organizedMoves = [];
    let currentPair = {};

    moves.forEach(move => {
      if (move.move_number !== currentPair.moveNumber) {
        if (Object.keys(currentPair).length > 0) {
          organizedMoves.push(currentPair);
        }
        currentPair = {
          moveNumber: move.move_number,
          white: null,
          black: null,
          fen: move.fen_after
        };
      }

      // تحديد اللون بناءً على معرف اللاعب
      const isWhiteMove = move.player_id === game.white_player_id;

      if (isWhiteMove) {
        currentPair.white = {
          san: move.san,
          playerId: move.player_id,
          playerName: move.player?.username || 'Unknown',
          timestamp: move.created_at
        };
      } else {
        currentPair.black = {
          san: move.san,
          playerId: move.player_id,
          playerName: move.player?.username || 'Unknown',
          timestamp: move.created_at
        };
      }
    });

    // إضافة آخر زوج إذا كان موجوداً
    if (Object.keys(currentPair).length > 0) {
      organizedMoves.push(currentPair);
    }

    res.json({
      success: true,
      data: {
        gameId: id,
        moves: organizedMoves,
        totalMoves: moves.length
      }
    });

  } catch (error) {
    logger.error('خطأ في جلب نقلات اللعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب النقلات'
    });
  }
};