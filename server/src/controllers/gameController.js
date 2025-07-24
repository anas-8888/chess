import { formatResponse, formatError } from '../utils/helpers.js';
import * as gameService from '../services/gameService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import {
  createGameSchema,
  moveSchema,
  gameIdParamSchema,
  drawSchema,
  listGamesQuerySchema,
} from '../middlewares/validation/game.validator.js';

/**
 * Create a new game lobby or immediate game
 */
export const createGame = asyncHandler(async (req, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatError('بيانات اللعبة غير صحيحة', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const game = await gameService.createGame(parsed.data, userId);
  
  return res.status(201).json(formatResponse(game, 'تم إنشاء اللعبة بنجاح'));
});

/**
 * Create a game from an accepted invite
 */
export const createGameFromInvite = asyncHandler(async (req, res) => {
  const parsed = playMethodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatError('بيانات الدعوة غير صحيحة', parsed.error.errors));
  }
  
  const { inviteId, playMethod } = parsed.data;
  const userId = req.user.user_id;

  if (!inviteId) {
    return res.status(400).json(formatError('معرف الدعوة مطلوب'));
  }

  const game = await gameService.createGameFromInvite(inviteId, playMethod, userId);
  return res.status(201).json(formatResponse(game, 'تم إنشاء اللعبة من الدعوة بنجاح'));
});

/**
 * List current user's games
 */
export const listGames = asyncHandler(async (req, res) => {
  const parsed = listGamesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(formatError('بيانات الاستعلام غير صحيحة', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const games = await gameService.listGames(parsed.data, userId);
  
  return res.status(200).json(formatResponse(games, 'تم جلب الألعاب بنجاح'));
});

/**
 * Get game header (no moves)
 */
export const getGameById = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const game = await gameService.getGameById(parsed.data.id, userId);
  
  if (!game) {
    return res.status(404).json(formatError('اللعبة غير موجودة'));
  }
  
  return res.status(200).json(formatResponse(game, 'تم جلب اللعبة بنجاح'));
});

/**
 * Get moves for a game
 */
export const getGameMoves = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const moves = await gameService.getGameMoves(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(moves, 'تم جلب حركات اللعبة بنجاح'));
});

/**
 * Make a move in a game
 */
export const makeMove = asyncHandler(async (req, res) => {
  const paramParsed = gameIdParamSchema.safeParse(req.params);
  const bodyParsed = moveSchema.safeParse(req.body);
  
  if (!paramParsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', paramParsed.error.errors));
  }
  
  if (!bodyParsed.success) {
    return res.status(400).json(formatError('بيانات الحركة غير صحيحة', bodyParsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.makeMove(paramParsed.data.id, userId, bodyParsed.data);
  
  return res.status(200).json(formatResponse(result, 'تم تنفيذ الحركة بنجاح'));
});

/**
 * Resign from a game
 */
export const resignGame = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.resignGame(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم الاستسلام بنجاح'));
});

/**
 * Offer draw in a game
 */
export const offerDraw = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.offerDraw(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم إرسال طلب التعادل بنجاح'));
});

/**
 * Accept draw offer
 */
export const acceptDraw = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.acceptDraw(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم قبول التعادل بنجاح'));
});

/**
 * Decline draw offer
 */
export const declineDraw = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.declineDraw(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم رفض طلب التعادل'));
});

/**
 * Pause a game
 */
export const pauseGame = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.pauseGame(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم إيقاف اللعبة مؤقتاً'));
});

/**
 * Resume a paused game
 */
export const resumeGame = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const result = await gameService.resumeGame(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(result, 'تم استئناف اللعبة بنجاح'));
});

/**
 * Draw game (legacy endpoint)
 */
export const drawGame = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const { action } = req.body;
  
  let result;
  switch (action) {
    case 'offer':
      result = await gameService.offerDraw(parsed.data.id, userId);
      break;
    case 'accept':
      result = await gameService.acceptDraw(parsed.data.id, userId);
      break;
    case 'decline':
      result = await gameService.declineDraw(parsed.data.id, userId);
      break;
    default:
      return res.status(400).json(formatError('إجراء التعادل غير صحيح'));
  }
  
  return res.status(200).json(formatResponse(result, 'تم تنفيذ إجراء التعادل بنجاح'));
});

/**
 * Get game players
 */
export const getGamePlayers = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const players = await gameService.getGamePlayers(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(players, 'تم جلب بيانات اللاعبين بنجاح'));
});

/**
 * Get active game for current user
 */
export const getActiveGame = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const game = await gameService.getActiveGame(userId);
  
  if (!game) {
    return res.status(404).json(formatError('لا توجد لعبة نشطة'));
  }
  
  return res.status(200).json(formatResponse(game, 'تم جلب اللعبة النشطة بنجاح'));
});

/**
 * Sync game time with server
 */
export const syncGameTime = asyncHandler(async (req, res) => {
  const parsed = gameIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', parsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const timeData = await gameService.syncGameTime(parsed.data.id, userId);
  
  return res.status(200).json(formatResponse(timeData, 'تم مزامنة الوقت بنجاح'));
});

/**
 * Update game time
 */
export const updateGameTime = asyncHandler(async (req, res) => {
  const paramParsed = gameIdParamSchema.safeParse(req.params);
  const bodyParsed = timeUpdateSchema.safeParse(req.body);
  
  if (!paramParsed.success) {
    return res.status(400).json(formatError('معرف اللعبة غير صحيح', paramParsed.error.errors));
  }
  
  if (!bodyParsed.success) {
    return res.status(400).json(formatError('بيانات الوقت غير صحيحة', bodyParsed.error.errors));
  }
  
  const userId = req.user.user_id;
  const { whiteTime, blackTime, currentTurn, timestamp } = bodyParsed.data;
  
  const result = await gameService.updateGameTime(parsed.data.id, userId, {
    whiteTime,
    blackTime,
    currentTurn,
    timestamp
  });
  
  return res.status(200).json(formatResponse(result, 'تم تحديث الوقت بنجاح'));
});

/**
 * Get active games for dashboard
 */
export const getActiveGamesForDashboard = asyncHandler(async (req, res) => {
  // Temporary: Use a default user ID for testing
  const userId = req.user?.user_id || 1;
  
  try {
    const Game = await import('../models/Game.js');
    const User = await import('../models/User.js');
    const { Op } = await import('sequelize');
    
    // Get active games where user is a player
    const activeGames = await Game.default.findAll({
      where: {
        [Op.or]: [
          { player1_id: userId },
          { player2_id: userId }
        ],
        status: {
          [Op.in]: ['active', 'waiting', 'paused']
        }
      },
      order: [['created_at', 'DESC']]
    });
    
    // Get user data for each game
    const dashboardGames = await Promise.all(
      activeGames.map(async (game) => {
        const isPlayer1 = game.player1_id === userId;
        const opponentId = isPlayer1 ? game.player2_id : game.player1_id;
        
        const opponent = await User.default.findByPk(opponentId, {
          attributes: ['user_id', 'username', 'thumbnail']
        });
        
        const yourColor = isPlayer1 ? 'white' : 'black';
        
        return {
          id: game.id.toString(),
          opponent: {
            username: opponent.username,
            avatar: opponent.thumbnail || null
          },
          your_color: yourColor,
          status: game.status,
          time_left: game.time_control || 600 // Default 10 minutes
        };
      })
    );
    
    return res.status(200).json({
      success: true,
      data: dashboardGames,
      message: dashboardGames.length === 0 ? 'لا توجد مباريات نشطة' : `تم العثور على ${dashboardGames.length} مباراة نشطة`
    });
  } catch (error) {
    console.error('خطأ في جلب المباريات النشطة للـ Dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب المباريات النشطة'
    });
  }
});

/**
 * Start quick match for dashboard
 */
export const startQuickMatch = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { time_control = 10, mode = 'random' } = req.body;
  
  try {
    // Validate time control
    const validTimeControls = [1, 3, 5, 10, 15, 30];
    if (!validTimeControls.includes(time_control)) {
      return res.status(400).json({
        success: false,
        message: 'وقت التحكم غير صحيح'
      });
    }
    
    // Join matchmaking queue
    const match = await gameService.joinMatchmaking(userId, {
      timeControl: time_control,
      gameMode: mode
    });
    
    if (match) {
      // Match found, return game info
      return res.status(200).json({
        success: true,
        data: {
          gameId: match.id.toString()
        },
        message: 'تم العثور على خصم وبدء المباراة'
      });
    } else {
      // No match found, user is in queue
      return res.status(200).json({
        success: true,
        data: {
          gameId: null,
          status: 'searching'
        },
        message: 'تم إضافتك إلى قائمة البحث عن خصم'
      });
    }
  } catch (error) {
    console.error('خطأ في بدء اللعبة السريعة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في بدء اللعبة السريعة'
    });
  }
});
