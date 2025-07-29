import { getGameDetailsService, updateGameTimeService, getGameDurationService } from '../services/gameService.js';
import GameMove from '../models/GameMove.js';
import User from '../models/User.js';
import Game from '../models/Game.js'; // Added import for Game model
import logger from '../utils/logger.js';
import { handleGameMove } from '../socket/socketHelpers.js';

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

// الحصول على مدة اللعبة
export const getGameDuration = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getGameDurationService(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('خطأ في جلب مدة اللعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// التحكم في لاعب معين (للتحكم عبر Postman)
export const controlPlayer = async (req, res) => {
  try {
    const { gameId, playerId, action, moveData } = req.body;

    // التحقق من وجود اللعبة
    const game = await Game.findByPk(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }

    // التحقق من أن اللاعب ينتمي للعبة
    if (playerId !== game.white_player_id && playerId !== game.black_player_id) {
      return res.status(403).json({
        success: false,
        message: 'اللاعب غير مسموح له بالتحكم في هذه اللعبة'
      });
    }

    // تحديد لون اللاعب
    const playerColor = playerId === game.white_player_id ? 'white' : 'black';

    // معالجة الإجراءات المختلفة
    switch (action) {
      case 'make_move':
        if (!moveData) {
          return res.status(400).json({
            success: false,
            message: 'بيانات الحركة مطلوبة'
          });
        }
        
        // إرسال الحركة عبر WebSocket
        if (global.io) {
          const movePayload = {
            gameId: gameId,
            from: moveData.from,
            to: moveData.to,
            promotion: moveData.promotion || 'q',
            san: moveData.san,
            fen: moveData.fen,
            movedBy: playerColor,
            currentTurn: playerColor === 'white' ? 'black' : 'white'
          };
          
          global.io.to(`game::${gameId}`).emit('move', movePayload);
          
          // معالجة الحركة
          await handleGameMove(global.io, gameId, movePayload);
        }
        
        res.json({
          success: true,
          message: 'تم إرسال الحركة بنجاح',
          data: {
            gameId,
            playerId,
            move: moveData.san,
            fen: moveData.fen
          }
        });
        break;

      case 'resign':
        // إرسال استسلام اللاعب
        if (global.io) {
          global.io.to(`game::${gameId}`).emit('playerResigned', {
            gameId,
            playerId,
            playerColor,
            timestamp: Date.now()
          });
        }
        
        // تحديث حالة اللعبة
        await game.update({ 
          status: 'ended',
          winner_id: playerColor === 'white' ? game.black_player_id : game.white_player_id,
          end_reason: 'resignation'
        });
        
        res.json({
          success: true,
          message: 'تم استسلام اللاعب بنجاح',
          data: {
            gameId,
            playerId,
            playerColor
          }
        });
        break;

      case 'offer_draw':
        // إرسال عرض التعادل
        if (global.io) {
          global.io.to(`game::${gameId}`).emit('drawOffered', {
            gameId,
            playerId,
            playerColor,
            timestamp: Date.now()
          });
        }
        
        res.json({
          success: true,
          message: 'تم إرسال عرض التعادل',
          data: {
            gameId,
            playerId,
            playerColor
          }
        });
        break;

      case 'accept_draw':
        // قبول التعادل
        if (global.io) {
          global.io.to(`game::${gameId}`).emit('drawAccepted', {
            gameId,
            playerId,
            playerColor,
            timestamp: Date.now()
          });
        }
        
        // تحديث حالة اللعبة
        await game.update({ 
          status: 'ended',
          end_reason: 'draw'
        });
        
        res.json({
          success: true,
          message: 'تم قبول التعادل',
          data: {
            gameId,
            playerId,
            playerColor
          }
        });
        break;

      case 'reject_draw':
        // رفض التعادل
        if (global.io) {
          global.io.to(`game::${gameId}`).emit('drawRejected', {
            gameId,
            playerId,
            playerColor,
            timestamp: Date.now()
          });
        }
        
        res.json({
          success: true,
          message: 'تم رفض التعادل',
          data: {
            gameId,
            playerId,
            playerColor
          }
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'إجراء غير معروف'
        });
    }

  } catch (error) {
    logger.error('خطأ في التحكم في اللاعب:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// الحصول على حالة اللعبة الحالية
export const getGameState = async (req, res) => {
  try {
    const { gameId } = req.params;

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
        }
      ]
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }

    // جلب آخر النقلات
    const lastMove = await GameMove.findOne({
      where: { game_id: gameId },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        gameId: game.id,
        status: game.status,
        currentFen: game.current_fen,
        currentTurn: game.current_turn,
        whiteTimeLeft: game.white_time_left,
        blackTimeLeft: game.black_time_left,
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
        lastMove: lastMove ? {
          san: lastMove.san,
          fen: lastMove.fen_after,
          timestamp: lastMove.created_at
        } : null,
        startedAt: game.started_at,
        gameType: game.game_type,
        initialTime: game.initial_time
      }
    });

  } catch (error) {
    logger.error('خطأ في جلب حالة اللعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};