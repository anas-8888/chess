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
        status: game.status
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