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
        currentTurn: game.current_turn || 'white',
        startedAt: game.started_at
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

// جلب مدة اللعبة
export const getGameDurationService = async (gameId) => {
  try {
    const game = await Game.findByPk(gameId);

    if (!game) {
      return {
        success: false,
        message: 'اللعبة غير موجودة'
      };
    }

    // حساب مدة اللعبة
    let durationMs = 0;
    
    if (game.started_at) {
      const endTime = game.ended_at || new Date();
      durationMs = endTime.getTime() - game.started_at.getTime();
    }

    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);

    return {
      success: true,
      data: {
        durationMs: durationMs,
        durationMinutes: durationMinutes,
        durationSeconds: durationSeconds,
        formattedDuration: durationMinutes > 0 
          ? `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`
          : `${durationSeconds} ث`
      }
    };

  } catch (error) {
    logger.error('خطأ في service جلب مدة اللعبة:', error);
    return {
      success: false,
      message: 'خطأ في الخادم'
    };
  }
}; 