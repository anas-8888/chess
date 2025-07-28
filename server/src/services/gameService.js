import Game from '../models/Game.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// الحصول على تفاصيل اللعبة
export const getGameDetailsService = async (gameId) => {
  try {
    const game = await Game.findByPk(gameId, {
      include: [
        {
          model: User,
          as: 'whitePlayer',
          attributes: ['user_id', 'username', 'rank']
        },
        {
          model: User,
          as: 'blackPlayer',
          attributes: ['user_id', 'username', 'rank']
        },
        {
          model: User,
          as: 'startedBy',
          attributes: ['user_id', 'username']
        }
      ]
    });

    if (!game) {
      return {
        success: false,
        message: 'اللعبة غير موجودة'
      };
    }

    return {
      success: true,
      data: {
        whitePlayer: {
          id: game.whitePlayer.user_id,
          name: game.whitePlayer.username,
          rank: game.whitePlayer.rank
        },
        blackPlayer: {
          id: game.blackPlayer.user_id,
          name: game.blackPlayer.username,
          rank: game.blackPlayer.rank
        },
        startedByUser: {
          id: game.startedBy.user_id,
          name: game.startedBy.username
        },
        gameType: game.game_type,
        initialTime: game.initial_time,
        whiteTimeLeft: game.white_time_left,
        blackTimeLeft: game.black_time_left,
        whitePlayMethod: game.white_play_method,
        blackPlayMethod: game.black_play_method,
        currentFen: game.current_fen,
        status: game.status,
        currentTurn: game.current_turn || 'white'
      }
    };

  } catch (error) {
    logger.error('خطأ في service جلب تفاصيل اللعبة:', error);
    return {
      success: false,
      message: 'خطأ في الخادم'
    };
  }
};

// تحديث وقت اللعبة
export const updateGameTimeService = async (gameId, { whiteTimeLeft, blackTimeLeft, currentTurn }) => {
  try {
    const game = await Game.findByPk(gameId);

    if (!game) {
      return {
        success: false,
        message: 'اللعبة غير موجودة'
      };
    }

    // تحديث الوقت والدور في قاعدة البيانات
    await game.update({
      white_time_left: whiteTimeLeft,
      black_time_left: blackTimeLeft,
      current_turn: currentTurn
    });

    return {
      success: true,
      message: 'تم تحديث الوقت بنجاح',
      data: {
        whiteTimeLeft: game.white_time_left,
        blackTimeLeft: game.black_time_left,
        currentTurn: game.current_turn
      }
    };

  } catch (error) {
    logger.error('خطأ في service تحديث وقت اللعبة:', error);
    return {
      success: false,
      message: 'خطأ في الخادم'
    };
  }
};

// جلب حركات اللعبة
export const getGameMovesService = async (gameId) => {
  try {
    // بدون الأقواس المعقوفة:
const GameMove = (await import('../models/GameMove.js')).default;
    const { User } = await import('../models/User.js');
    
    const moves = await GameMove.findAll({
      where: { game_id: gameId },
      include: [
        {
          model: User,
          as: 'player',
          attributes: ['user_id', 'username']
        }
      ],
      order: [['move_number', 'ASC']]
    });

    return {
      success: true,
      data: moves.map(move => ({
        id: move.id,
        moveNumber: move.move_number,
        playerId: move.player_id,
        playerName: move.player?.username,
        uci: move.uci,
        san: move.san,
        fenAfter: move.fen_after,
        createdAt: move.created_at
      }))
    };

  } catch (error) {
    logger.error('خطأ في service جلب حركات اللعبة:', error);
    return {
      success: false,
      message: 'خطأ في الخادم'
    };
  }
}; 