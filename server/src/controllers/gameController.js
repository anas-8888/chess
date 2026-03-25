import { getGameDetailsService, updateGameTimeService, getGameDurationService } from '../services/gameService.js';
import { Op } from 'sequelize';
import GameMove from '../models/GameMove.js';
import User from '../models/User.js';
import Game from '../models/Game.js'; // Added import for Game model
import logger from '../utils/logger.js';
import { handleGameMove, handleGameEnd } from '../socket/socketHelpers.js';

const AI_SYSTEM_EMAIL = 'ai.bot@system.local';
const AI_SYSTEM_USERNAME = 'ai_bot';

const AI_DIFFICULTY_LEVELS = {
  easy: 1100,
  medium: 1500,
  hard: 1900,
};

const resolveAiLevel = (difficulty, aiLevel) => {
  if (difficulty && AI_DIFFICULTY_LEVELS[difficulty]) {
    return AI_DIFFICULTY_LEVELS[difficulty];
  }

  const numeric = Number(aiLevel);
  if (!Number.isFinite(numeric)) {
    return AI_DIFFICULTY_LEVELS.medium;
  }

  return Math.max(800, Math.min(2400, Math.round(numeric)));
};

const ensureAiSystemUser = async () => {
  let aiUser = await User.findOne({ where: { email: AI_SYSTEM_EMAIL } });
  if (aiUser) return aiUser;

  let username = AI_SYSTEM_USERNAME;
  const existingUsername = await User.findOne({ where: { username } });
  if (existingUsername) {
    username = `${AI_SYSTEM_USERNAME}_${Date.now()}`;
  }

  aiUser = await User.create({
    username,
    email: AI_SYSTEM_EMAIL,
    password_hash: '!ai-system-account!',
    type: 'user',
    rank: 1500,
    state: 'offline',
  });

  return aiUser;
};

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
    logger.error('Failed to get game details:', error);
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
    logger.error('Failed to get games list:', error);
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
    logger.error('Failed to update game time:', error);
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
    logger.error('Failed to fetch game moves:', error);
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
    logger.error('Failed to get game duration:', error);
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
    logger.error('Player control operation failed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// الحصول على حالة اللعبة الحالية
export const getGameState = async (req, res) => {
  try {
    const gameId = req.params.id;

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
    logger.error('Failed to get game state:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};


// استسلام لاعب في مباراة مباشرة (fallback API)
export const resignGame = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const game = await Game.findByPk(id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    const isParticipant =
      Number(game.white_player_id) === Number(userId) ||
      Number(game.black_player_id) === Number(userId);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resign this game',
      });
    }

    if (game.status !== 'active') {
      return res.status(409).json({
        success: false,
        message: 'Game is not active',
      });
    }

    const winner = Number(userId) === Number(game.white_player_id) ? 'black' : 'white';
    const friendsNamespace = global.io?.of ? global.io.of('/friends') : null;

    if (friendsNamespace) {
      await handleGameEnd(friendsNamespace, String(id), 'resign', winner);
    } else {
      const winnerId = winner === 'white' ? game.white_player_id : game.black_player_id;
      await game.update({
        status: 'ended',
        winner_id: winnerId,
        ended_at: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Resignation processed successfully',
    });
  } catch (error) {
    logger.error('Failed to resign game:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resign game',
    });
  }
};

// تسجيل نتيجة مباراة ضد الذكاء الاصطناعي في قاعدة البيانات
export const recordAiGameResult = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      result,
      playerColor = 'white',
      aiLevel = 1500,
      difficulty = 'medium',
      initialTime = 600,
      whiteTimeLeft = 600,
      blackTimeLeft = 600,
      finalFen = 'startpos',
      startedAt,
      endedAt,
    } = req.body || {};

    if (!['win', 'loss', 'draw'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid result value. Use win, loss, or draw.',
      });
    }

    if (!['white', 'black'].includes(playerColor)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playerColor value. Use white or black.',
      });
    }
    if (difficulty && !Object.prototype.hasOwnProperty.call(AI_DIFFICULTY_LEVELS, difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty value. Use easy, medium, or hard.',
      });
    }

    const aiUser = await ensureAiSystemUser();
    if (!aiUser || aiUser.user_id === userId) {
      return res.status(500).json({
        success: false,
        message: 'Unable to prepare AI opponent user.',
      });
    }

    const safeInitial = Math.max(0, Number(initialTime) || 600);
    const resolvedAiLevel = resolveAiLevel(difficulty, aiLevel);
    const safeWhiteLeft = Math.max(0, Number(whiteTimeLeft) || 0);
    const safeBlackLeft = Math.max(0, Number(blackTimeLeft) || 0);
    const safeFen =
      typeof finalFen === 'string' && finalFen.trim().length > 0
        ? finalFen.trim().slice(0, 100)
        : 'startpos';

    const whitePlayerId = playerColor === 'white' ? userId : aiUser.user_id;
    const blackPlayerId = playerColor === 'black' ? userId : aiUser.user_id;

    let winnerId = null;
    if (result === 'win') winnerId = userId;
    if (result === 'loss') winnerId = aiUser.user_id;

    const startDate = startedAt ? new Date(startedAt) : new Date();
    const endDate = endedAt ? new Date(endedAt) : new Date();
    const safeStartedAt = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
    const safeEndedAt = Number.isNaN(endDate.getTime()) ? new Date() : endDate;

    const game = await Game.create({
      white_player_id: whitePlayerId,
      black_player_id: blackPlayerId,
      started_by_user_id: userId,
      game_type: 'ai',
      ai_level: resolvedAiLevel,
      initial_time: safeInitial,
      white_time_left: safeWhiteLeft,
      black_time_left: safeBlackLeft,
      white_play_method: 'phone',
      black_play_method: 'phone',
      current_fen: safeFen,
      status: 'ended',
      current_turn: 'white',
      winner_id: winnerId,
      started_at: safeStartedAt,
      ended_at: safeEndedAt,
    });

    return res.status(201).json({
      success: true,
      message: 'AI game result recorded successfully',
      data: {
        gameId: game.id,
        result,
      },
    });
  } catch (error) {
    logger.error('Failed to record AI game result:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record AI game result',
    });
  }
};

// إنشاء مباراة AI فعلية في قاعدة البيانات (active)
export const createAiGameSession = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { playerColor = 'white', aiLevel = 1500, difficulty = 'medium', initialTime = 600 } = req.body || {};
    if (!['white', 'black'].includes(playerColor)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playerColor value. Use white or black.',
      });
    }
    if (difficulty && !Object.prototype.hasOwnProperty.call(AI_DIFFICULTY_LEVELS, difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty value. Use easy, medium, or hard.',
      });
    }

    const aiUser = await ensureAiSystemUser();
    if (!aiUser || aiUser.user_id === userId) {
      return res.status(500).json({
        success: false,
        message: 'Unable to prepare AI opponent user.',
      });
    }

    const whitePlayerId = playerColor === 'white' ? userId : aiUser.user_id;
    const blackPlayerId = playerColor === 'black' ? userId : aiUser.user_id;
    const safeInitial = Math.max(0, Number(initialTime) || 600);
    const resolvedAiLevel = resolveAiLevel(difficulty, aiLevel);

    const existingActiveGame = await Game.findOne({
      where: {
        [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
        status: { [Op.in]: ['waiting', 'active'] },
      },
      attributes: ['id', 'game_type', 'status'],
      order: [['created_at', 'DESC']],
    });

    if (existingActiveGame) {
      return res.status(409).json({
        success: false,
        code: 'ACTIVE_GAME_EXISTS',
        message: 'يوجد لديك مباراة غير مغلقة. يرجى إغلاقها أولاً.',
        data: {
          existingGameId: existingActiveGame.id,
          existingGameType: existingActiveGame.game_type,
          existingStatus: existingActiveGame.status,
        },
      });
    }

    const game = await Game.create({
      white_player_id: whitePlayerId,
      black_player_id: blackPlayerId,
      started_by_user_id: userId,
      game_type: 'ai',
      ai_level: resolvedAiLevel,
      initial_time: safeInitial,
      white_time_left: safeInitial,
      black_time_left: safeInitial,
      white_play_method: 'phone',
      black_play_method: 'phone',
      current_fen: 'startpos',
      status: 'active',
      current_turn: 'white',
      winner_id: null,
      started_at: new Date(),
      ended_at: null,
    });

    return res.status(201).json({
      success: true,
      message: 'AI game session created',
      data: {
        gameId: game.id,
        aiUserId: aiUser.user_id,
        aiLevel: resolvedAiLevel,
        difficulty: difficulty || 'medium',
      },
    });
  } catch (error) {
    logger.error('Failed to create AI game session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create AI game session',
    });
  }
};

// جلب مباراة AI النشطة الحالية للمستخدم (إن وجدت)
export const getActiveAiGameSession = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const activeGame = await Game.findOne({
      where: {
        game_type: 'ai',
        status: 'active',
        [Op.or]: [
          { white_player_id: userId },
          { black_player_id: userId },
        ],
      },
      order: [['started_at', 'DESC']],
      attributes: [
        'id',
        'white_player_id',
        'black_player_id',
        'ai_level',
        'initial_time',
        'white_time_left',
        'black_time_left',
        'current_fen',
        'current_turn',
        'status',
        'started_at',
        'updated_at',
      ],
    });

    if (!activeGame) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    const playerColor = activeGame.white_player_id === userId ? 'white' : 'black';

    return res.status(200).json({
      success: true,
      data: {
        gameId: activeGame.id,
        playerColor,
        aiLevel: activeGame.ai_level || 1500,
        initialTime: activeGame.initial_time,
        whiteTimeLeft: activeGame.white_time_left,
        blackTimeLeft: activeGame.black_time_left,
        currentFen: activeGame.current_fen,
        currentTurn: activeGame.current_turn,
        status: activeGame.status,
        startedAt: activeGame.started_at,
        clockSyncedAt: activeGame.updated_at,
      },
    });
  } catch (error) {
    logger.error('Failed to get active AI game session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active AI game session',
    });
  }
};

// حفظ نقلة واحدة في مباراة AI
export const recordAiGameMove = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const gameId = Number(req.params.gameId);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!gameId) {
      return res.status(400).json({ success: false, message: 'Invalid game ID' });
    }

    const game = await Game.findByPk(gameId);
    if (!game || game.game_type !== 'ai') {
      return res.status(404).json({ success: false, message: 'AI game not found' });
    }

    const userInGame = game.white_player_id === userId || game.black_player_id === userId;
    if (!userInGame) {
      return res.status(403).json({ success: false, message: 'You are not part of this game' });
    }

    if (game.status === 'ended') {
      return res.status(409).json({ success: false, message: 'Game already ended' });
    }

    const { from, to, promotion = '', san, fenAfter, movedBy, nextTurn } = req.body || {};
    if (!from || !to || !san || !fenAfter || !['human', 'ai'].includes(movedBy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid move payload',
      });
    }

    const humanIsWhite = game.white_player_id === userId;
    const aiUserId = humanIsWhite ? game.black_player_id : game.white_player_id;
    const playerId = movedBy === 'human' ? userId : aiUserId;

    const movesCount = await GameMove.count({ where: { game_id: gameId } });
    const moveNumber = Math.floor(movesCount / 2) + 1;
    const uci = `${from}${to}${promotion || ''}`.slice(0, 8);

    await GameMove.create({
      game_id: gameId,
      move_number: moveNumber,
      player_id: playerId,
      uci,
      san: String(san).slice(0, 16),
      fen_after: String(fenAfter).slice(0, 100),
    });

    await game.update({
      current_fen: String(fenAfter).slice(0, 100),
      current_turn:
        nextTurn === 'white' || nextTurn === 'black'
          ? nextTurn
          : game.current_turn === 'white'
            ? 'black'
            : 'white',
    });

    return res.status(201).json({
      success: true,
      message: 'AI move recorded',
    });
  } catch (error) {
    logger.error('Failed to record AI move:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record AI move',
    });
  }
};

// إنهاء مباراة AI وتسجيل الفائز
export const finalizeAiGame = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const gameId = Number(req.params.gameId);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!gameId) {
      return res.status(400).json({ success: false, message: 'Invalid game ID' });
    }

    const game = await Game.findByPk(gameId);
    if (!game || game.game_type !== 'ai') {
      return res.status(404).json({ success: false, message: 'AI game not found' });
    }

    const userInGame = game.white_player_id === userId || game.black_player_id === userId;
    if (!userInGame) {
      return res.status(403).json({ success: false, message: 'You are not part of this game' });
    }

    const {
      result,
      finalFen = game.current_fen || 'startpos',
      whiteTimeLeft = game.white_time_left,
      blackTimeLeft = game.black_time_left,
    } = req.body || {};

    if (!['win', 'loss', 'draw'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid result value. Use win, loss, or draw.',
      });
    }

    const aiUserId = game.white_player_id === userId ? game.black_player_id : game.white_player_id;
    const winnerId = result === 'draw' ? null : result === 'win' ? userId : aiUserId;

    await game.update({
      status: 'ended',
      winner_id: winnerId,
      ended_at: new Date(),
      current_fen: String(finalFen).slice(0, 100),
      white_time_left: Math.max(0, Number(whiteTimeLeft) || 0),
      black_time_left: Math.max(0, Number(blackTimeLeft) || 0),
    });

    return res.status(200).json({
      success: true,
      message: 'AI game finalized',
    });
  } catch (error) {
    logger.error('Failed to finalize AI game:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to finalize AI game',
    });
  }
};


