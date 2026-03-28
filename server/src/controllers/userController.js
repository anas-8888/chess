import {
  getAllUsers,
  getUserById,
  getCurrentUserProfile,
  updateUserProfile,
  deleteUser,
  createUser,
  searchUsers,
  getUserStats,
  changePassword,
} from '../services/userService.js';
import {
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
} from '../services/authService.js';
import { formatResponse, formatError } from '../utils/helpers.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
// إحصائيات عامة للموقع
import User from '../models/User.js';
import Game from '../models/Game.js';
import Puzzle from '../models/Puzzle.js';
import Course from '../models/Course.js';
import Session from '../models/Session.js';
import { Op, QueryTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../models/index.js';
import {
  hasActivePlayableGame,
  isUserOnline,
  updateUserStatus as updateSocketUserStatus,
} from '../socket/socketHelpers.js';
import { INITIAL_RATING, PLACEMENT_MATCHES } from '../utils/elo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create new user (Admin only)
export const createNewUser = asyncHandler(async (req, res) => {
  const userData = req.body;

  const newUser = await createUser(userData, req.user);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(201).json(newUser);
});

// Get all users (Admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, type, state, sortBy, sortOrder } = req.query;

  const result = await getAllUsers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    search: search || '',
    type: type || '',
    state: state || '',
    sortBy: sortBy || 'created_at',
    sortOrder: sortOrder || 'DESC',
  });

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result.users || result);
});

// Get user by ID (Admin or owner)
export const getUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  if (!userId) {
    return res.status(400).json(formatError('User ID is required'));
  }

  const user = await getUserById(userId);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(user);
});

// Get current user profile
export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const user = await getCurrentUserProfile(userId);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(user);
});

// Update user profile
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id) || req.user.user_id;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated directly
  delete updateData.user_id;
  delete updateData.type; // Only admin should be able to change user type
  delete updateData.created_at;
  delete updateData.deleted_at;

  const updatedUser = await updateUserProfile(userId, updateData, req.user);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(updatedUser);
});

// Update current user profile (shorthand)
export const updateCurrentProfile = asyncHandler(async (req, res) => {
  const updateData = req.body;

  // Remove sensitive fields
  delete updateData.user_id;
  delete updateData.type;
  delete updateData.created_at;
  delete updateData.deleted_at;

  const updatedUser = await updateUserProfile(
    req.user.user_id,
    updateData,
    req.user
  );
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(updatedUser);
});

// Upload current user avatar (base64 data URL)
export const uploadCurrentAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const rawContentType = (req.headers['content-type'] || '').toLowerCase();
  let imageBuffer = null;
  let extension = null;

  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    imageBuffer = req.body;
    if (rawContentType.includes('image/png')) extension = 'png';
    else if (rawContentType.includes('image/webp')) extension = 'webp';
    else if (
      rawContentType.includes('image/jpeg') ||
      rawContentType.includes('image/jpg')
    ) {
      extension = 'jpg';
    }
  } else {
    const { imageData } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json(formatError('Image data is required'));
    }

    const matched = imageData.match(
      /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i
    );
    if (!matched) {
      return res.status(400).json(formatError('Invalid image format'));
    }

    const mimeType = matched[1].toLowerCase();
    extension = mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';
    const base64 = matched[3];
    imageBuffer = Buffer.from(base64, 'base64');
  }

  if (!imageBuffer || !extension) {
    return res.status(400).json(formatError('Unsupported image payload'));
  }

  const maxBytes = 2 * 1024 * 1024;
  if (imageBuffer.length > maxBytes) {
    return res.status(400).json(formatError('Image is too large (max 2MB)'));
  }

  const storageDir = path.join(__dirname, '../../storage', 'thumbnails');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const fileName = `${Date.now()}_${userId}.${extension}`;
  const absoluteFilePath = path.join(storageDir, fileName);
  fs.writeFileSync(absoluteFilePath, imageBuffer);

  // Store avatar as a relative path to avoid host/proxy mismatches between
  // environments (dev/prod) and keep it stable after page refreshes.
  const publicPath = `/thumbnails/${fileName}`;
  const [updatedRows] = await User.update(
    { thumbnail: publicPath },
    { where: { user_id: userId } }
  );

  if (!updatedRows) {
    return res.status(404).json(formatError('User not found while updating avatar'));
  }

  const updatedUser = await User.findByPk(userId, {
    attributes: ['user_id', 'thumbnail'],
  });

  return res.status(200).json({
    success: true,
    data: {
      thumbnail: updatedUser?.thumbnail,
      avatar: updatedUser?.thumbnail,
    },
    message: 'Avatar uploaded successfully',
  });
});

// Delete user (Admin or owner)
export const deleteUserAccount = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id) || req.user.user_id;

  if (!userId) {
    return res.status(400).json(formatError('User ID is required'));
  }

  const result = await deleteUser(userId, req.user);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
});

// Delete current user account (shorthand)
export const deleteCurrentAccount = asyncHandler(async (req, res) => {
  const result = await deleteUser(req.user.user_id, req.user);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
});

// Search users (for friend requests)
export const searchUsersController = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json(formatError('Search query must be at least 2 characters'));
  }

  try {
    const User = await import('../models/User.js');
    const Friend = await import('../models/Friend.js');
    const { Op } = await import('sequelize');

    const searchTerm = q.trim();
    const searchPattern = `%${searchTerm}%`;
    const currentUserId = req.user.user_id;

    // البحث عن المستخدمين المطابقين
    const allUsers = await User.default.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: searchPattern } },
          { email: { [Op.like]: searchPattern } },
          { username: { [Op.like]: `${searchTerm}%` } },
          { email: { [Op.like]: `${searchTerm}%` } }
        ],
        user_id: { [Op.ne]: currentUserId } // استبعاد المستخدم الحالي
      },
      attributes: ['user_id', 'username', 'email', 'thumbnail', 'rank'],
      order: [
        ['username', 'ASC']
      ]
    });

    // الحصول على معرفات المستخدمين
    const userIds = allUsers.map(user => user.user_id);

    if (userIds.length === 0) {
      return res.status(200).json([]);
    }

    // البحث عن العلاقات الموجودة مع المستخدم الحالي
    const existingRelationships = await Friend.default.findAll({
      where: {
        [Op.or]: [
          { user_id: currentUserId, friend_user_id: { [Op.in]: userIds } },
          { user_id: { [Op.in]: userIds }, friend_user_id: currentUserId }
        ]
      },
      attributes: ['user_id', 'friend_user_id', 'status']
    });

    // إنشاء مجموعة من المستخدمين الذين لا يمكن إرسال طلب صداقة لهم
    const excludedUserIds = new Set();
    
    existingRelationships.forEach(relationship => {
      const otherUserId = relationship.user_id === currentUserId 
        ? relationship.friend_user_id 
        : relationship.user_id;
      
      // استبعاد الأصدقاء الحاليين
      if (relationship.status === 'accepted') {
        excludedUserIds.add(otherUserId);
      }
      // استبعاد طلبات الصداقة المعلقة
      else if (relationship.status === 'pending') {
        excludedUserIds.add(otherUserId);
      }
      // لا نستبعد طلبات الصداقة المرفوضة - يمكن إعادة المحاولة
    });

    // تصفية المستخدمين لاستبعاد من لا يمكن إرسال طلب صداقة لهم
    const filteredUsers = allUsers.filter(user => !excludedUserIds.has(user.user_id));

    // تطبيق الحد الأقصى
    const limitedUsers = filteredUsers.slice(0, parseInt(limit) || 10);

    res.status(200).json(limitedUsers);
  } catch (error) {
    logger.error('User search failed:', error);
    res.status(500).json(formatError('فشل البحث عن المستخدمين'));
  }
});

// Get user statistics
export const getUserStatsController = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id) || req.user.user_id;

  if (!userId) {
    return res.status(400).json(formatError('User ID is required'));
  }

  const stats = await getUserStats(userId);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(stats);
});

// Change password
export const changePasswordController = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json(formatError('Current password and new password are required'));
  }

  const result = await changePassword(
    req.user.user_id,
    currentPassword,
    newPassword,
    req.user
  );
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
});

// Get user sessions
export const getUserSessionsController = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id) || req.user.user_id;

  // Check permissions - user can only see their own sessions
  if (req.user.type !== 'admin' && req.user.user_id !== userId) {
    return res
      .status(403)
      .json(formatError('Access denied. You can only view your own sessions.'));
  }

  const sessions = await getUserSessions(userId);

  // Mark current session
  const currentToken = req.headers.authorization?.replace('Bearer ', '');
  const sessionsWithCurrent = sessions.map(session => ({
    ...session,
    is_current:
      session.session_id ===
      (currentToken ? currentToken.substring(0, 20) + '...' : false),
  }));

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(sessionsWithCurrent);
});

// Revoke specific session
export const revokeSessionController = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = parseInt(req.params.id) || req.user.user_id;

  if (!sessionId) {
    return res.status(400).json(formatError('Session ID is required'));
  }

  // Check permissions - user can only revoke their own sessions
  if (req.user.type !== 'admin' && req.user.user_id !== userId) {
    return res
      .status(403)
      .json(
        formatError('Access denied. You can only revoke your own sessions.')
      );
  }

  const result = await revokeSession(userId, sessionId);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
});

// Revoke all other sessions
export const revokeAllOtherSessionsController = asyncHandler(
  async (req, res) => {
    const userId = parseInt(req.params.id) || req.user.user_id;
    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    if (!currentToken) {
      return res
        .status(400)
        .json(formatError('Current session token is required'));
    }

    // Check permissions - user can only revoke their own sessions
    if (req.user.type !== 'admin' && req.user.user_id !== userId) {
      return res
        .status(403)
        .json(
          formatError('Access denied. You can only revoke your own sessions.')
        );
    }

    const result = await revokeAllOtherSessions(userId, currentToken);
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json({ success: true });
  }
);

// إحصائيات عامة للموقع
export const getSiteStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalGames, totalPuzzles, totalCourses] = await Promise.all([
    User.count(),
    Game.count(),
    Puzzle.count(),
    Course.count(),
  ]);
  res.json({
    totalUsers,
    totalGames,
    totalPuzzles,
    totalCourses,
  });
});

// Update user status
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const userId = req.user.user_id;

  if (!status) {
    return res.status(400).json(formatError('حالة المستخدم مطلوبة'));
  }

  // التحقق من صحة الحالة
  const validStatuses = ['online', 'offline', 'in-game', 'away'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json(formatError('حالة المستخدم غير صحيحة'));
  }

  const updatedUser = await updateUserProfile(userId, { status }, req.user);
  
  return res.status(200).json(formatResponse(updatedUser, 'تم تحديث حالة المستخدم بنجاح'));
});

// Get user profile with statistics for dashboard
export const getProfileWithStats = asyncHandler(async (req, res) => {
  const userId = req.user?.user_id;

  if (!userId) {
    return res.status(401).json(formatError('غير مصرح'));
  }

  try {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'deleted_at'] },
    });

    if (!user) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    const participationWhere = {
      [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
      status: 'ended',
    };

    const [wins, losses, draws] = await Promise.all([
      Game.count({
        where: {
          ...participationWhere,
          winner_id: userId,
        },
      }),
      Game.count({
        where: {
          ...participationWhere,
          [Op.and]: [{ winner_id: { [Op.ne]: null } }, { winner_id: { [Op.ne]: userId } }],
        },
      }),
      Game.count({
        where: {
          ...participationWhere,
          winner_id: null,
        },
      }),
    ]);

    const total_games = wins + losses + draws;
    const win_rate = total_games > 0 ? (wins / total_games) * 100 : 0;
    const placementGamesPlayed = Math.min(total_games, PLACEMENT_MATCHES);
    const isPlacement = total_games < PLACEMENT_MATCHES;
    const placementRemaining = Math.max(0, PLACEMENT_MATCHES - total_games);

    return res.status(200).json({
      success: true,
      data: {
        ...user.toJSON(),
        wins,
        losses,
        draws,
        total_games,
        win_rate,
        rating: user.rank,
        avatar: user.thumbnail,
        isPlacement,
        placementGamesPlayed,
        placementMatches: PLACEMENT_MATCHES,
        placementRemaining,
        isNewPlayer: isPlacement,
      },
      message: 'تم جلب بيانات المستخدم والإحصائيات بنجاح',
    });
  } catch (error) {
    logger.error('Failed to fetch profile statistics:', error);
    return res.status(500).json(formatError('خطأ في جلب إحصائيات المستخدم'));
  }
});

// Get current user status
export const getCurrentUserStatus = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  try {
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'state']
    });

    if (!user) {
      return res.status(404).json(formatError('User not found'));
    }

    let resolvedState = user.state;

    if (user.state === 'in-game') {
      const activeGame = await hasActivePlayableGame(userId);
      if (!activeGame) {
        resolvedState = isUserOnline(userId) ? 'online' : 'offline';
        await updateSocketUserStatus(userId, resolvedState, { force: true });
      }
    }

    res.status(200).json({
      user_id: user.user_id,
      state: resolvedState
    });
  } catch (error) {
    logger.error('Error getting current user status:', error);
    res.status(500).json(formatError('Failed to get user status'));
  }
});
// Get current user recent games
export const getRecentGamesForCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const rows = await sequelize.query(
    `
      SELECT
        g.id,
        g.status,
        g.game_type AS game_type,
        g.started_at,
        g.ended_at,
        g.winner_id,
        g.white_player_id,
        g.black_player_id,
        wp.username AS white_username,
        bp.username AS black_username
      FROM game g
      INNER JOIN users wp ON wp.user_id = g.white_player_id
      INNER JOIN users bp ON bp.user_id = g.black_player_id
      WHERE g.white_player_id = :userId OR g.black_player_id = :userId
      ORDER BY g.created_at DESC
      LIMIT :limit
    `,
    {
      replacements: { userId, limit },
      type: QueryTypes.SELECT,
    }
  );

  const data = rows.map(game => {
    const isWhite = Number(game.white_player_id) === Number(userId);
    const opponent = isWhite ? game.black_username : game.white_username;

    let result = 'جارية';
    if (game.status === 'ended') {
      if (!game.winner_id) {
        result = 'تعادل';
      } else if (Number(game.winner_id) === Number(userId)) {
        result = 'فوز';
      } else {
        result = 'خسارة';
      }
    }

    return {
      id: game.id,
      status: game.status,
      game_type: game.game_type,
      started_at: game.started_at,
      ended_at: game.ended_at,
      opponent,
      color: isWhite ? 'white' : 'black',
      result,
    };
  });

  return res.status(200).json({
    success: true,
    data,
  });
});

// Get rating history for current user
export const getRatingHistoryForCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const totalCompletedGames = await Game.count({
    where: {
      [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
      status: 'ended',
      ended_at: { [Op.ne]: null },
    },
  });

  const rows = await sequelize.query(
    `
      SELECT
        g.id,
        g.game_type,
        g.ended_at,
        g.winner_id,
        g.white_player_id,
        g.black_player_id,
        g.white_rank_change,
        g.black_rank_change,
        wp.username AS white_username,
        bp.username AS black_username
      FROM game g
      INNER JOIN users wp ON wp.user_id = g.white_player_id
      INNER JOIN users bp ON bp.user_id = g.black_player_id
      WHERE
        g.status = 'ended'
        AND g.ended_at IS NOT NULL
        AND (g.white_player_id = :userId OR g.black_player_id = :userId)
      ORDER BY g.ended_at DESC
      LIMIT :limit
    `,
    {
      replacements: { userId, limit },
      type: QueryTypes.SELECT,
    }
  );

  const user = await User.findByPk(userId, {
    attributes: ['user_id', 'rank'],
  });
  const currentRating = Number(user?.rank) || INITIAL_RATING;

  let rollingAfter = currentRating;
  const history = rows.map((game) => {
    const isWhite = Number(game.white_player_id) === Number(userId);
    const deltaRaw = isWhite ? game.white_rank_change : game.black_rank_change;
    const delta = Number(deltaRaw) || 0;
    const opponent = isWhite ? game.black_username : game.white_username;

    let result = 'تعادل';
    if (game.winner_id) {
      result = Number(game.winner_id) === Number(userId) ? 'فوز' : 'خسارة';
    }

    const ratingAfter = rollingAfter;
    const ratingBefore = ratingAfter - delta;
    rollingAfter = ratingBefore;

    return {
      gameId: Number(game.id),
      endedAt: game.ended_at,
      gameType: game.game_type,
      opponent,
      result,
      delta,
      ratingBefore,
      ratingAfter,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      currentRating,
      lastDelta: history.length > 0 ? history[0].delta : 0,
      isPlacement: totalCompletedGames < PLACEMENT_MATCHES,
      placementGamesPlayed: Math.min(totalCompletedGames, PLACEMENT_MATCHES),
      placementMatches: PLACEMENT_MATCHES,
      placementRemaining: Math.max(0, PLACEMENT_MATCHES - totalCompletedGames),
      history,
    },
    message: 'تم جلب سجل تغيّر التقييم بنجاح',
  });
});

// Get current active/waiting game for logged-in user
export const getCurrentActiveGame = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const game = await Game.findOne({
    where: {
      [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
      status: { [Op.in]: ['waiting', 'active'] },
    },
    order: [['created_at', 'DESC']],
    attributes: [
      'id',
      'status',
      'game_type',
      'white_player_id',
      'black_player_id',
      'started_at',
      'created_at',
    ],
  });

  if (!game) {
    return res.status(200).json({
      success: true,
      data: null,
    });
  }

  const color = Number(game.white_player_id) === Number(userId) ? 'white' : 'black';

  return res.status(200).json({
    success: true,
    data: {
      id: game.id,
      status: game.status,
      game_type: game.game_type,
      color,
      started_at: game.started_at || game.created_at,
    },
  });
});

// End an active/waiting game for current user (forfeit when active)
export const endCurrentGame = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const gameId = Number(req.params.gameId);

  if (!gameId) {
    return res.status(400).json(formatError('Game ID is required'));
  }

  const game = await Game.findByPk(gameId);
  if (!game) {
    return res.status(404).json(formatError('Game not found'));
  }

  const isParticipant =
    Number(game.white_player_id) === Number(userId) ||
    Number(game.black_player_id) === Number(userId);
  if (!isParticipant) {
    return res.status(403).json(formatError('Not authorized to end this game'));
  }

  if (!['waiting', 'active'].includes(game.status)) {
    return res.status(409).json(formatError('Game is not active'));
  }

  const opponentId =
    Number(game.white_player_id) === Number(userId) ? game.black_player_id : game.white_player_id;
  const winnerId = game.status === 'active' ? opponentId : null;

  await game.update({
    status: 'ended',
    winner_id: winnerId,
    ended_at: new Date(),
  });

  try {
    const { stopClock } = await import('../socket/socketHelpers.js');
    await stopClock(String(gameId));
  } catch (error) {
    logger.error('Failed to stop game clock while ending game:', error);
  }

  // مزامنة حالة اللاعبين بعد إنهاء المباراة مباشرة
  try {
    const { updateUserStatusAfterGameEnd } = await import('../socket/socketHelpers.js');
    await updateUserStatusAfterGameEnd(gameId);
  } catch (error) {
    logger.error('Failed to update player statuses while ending game:', error);
  }

  return res.status(200).json({
    success: true,
    message: 'Game ended successfully',
    data: {
      id: game.id,
      status: 'ended',
      winner_id: winnerId,
    },
  });
});

// الحصول على توكن المستخدم ورقم آخر لعبة له
export const getUserTokenAndLastGame = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'رقم المستخدم مطلوب'
      });
    }

    // التحقق من وجود المستخدم
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // البحث عن آخر جلسة نشطة للمستخدم
    const activeSession = await Session.findOne({
      where: {
        user_id: userId,
        deleted_at: null,
        expires_at: {
          [Op.gt]: new Date()
        }
      },
      order: [['last_activity', 'DESC']]
    });

    if (!activeSession) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد جلسة نشطة للمستخدم'
      });
    }

    // البحث عن آخر لعبة نشطة للمستخدم مع معلومات طريقة اللعب
    const lastGame = await Game.findOne({
      where: {
        [Op.or]: [
          { white_player_id: userId },
          { black_player_id: userId }
        ],
        status: {
          [Op.in]: ['active', 'pending']
        }
      },
      order: [['created_at', 'DESC']]
    });

    // تحديد طريقة اللعب للاعب
    let playerPlayMethod = null;
    let playerColor = null;
    
    if (lastGame) {
      if (lastGame.white_player_id == userId) {
        playerColor = 'white';
        playerPlayMethod = lastGame.white_play_method;
      } else if (lastGame.black_player_id == userId) {
        playerColor = 'black';
        playerPlayMethod = lastGame.black_play_method;
      }
    }

    // إرجاع النتيجة
    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        username: user.username,
        token: activeSession.id, // توكن الجلسة
        lastGameId: lastGame ? lastGame.id : null,
        lastGameStatus: lastGame ? lastGame.status : null,
        playerColor: playerColor, // لون اللاعب في اللعبة
        playerPlayMethod: playerPlayMethod, // طريقة اللعب (physical_board, phone, etc.)
        sessionExpiresAt: activeSession.expires_at,
        lastActivity: activeSession.last_activity
      }
    });

  } catch (error) {
    logger.error('Failed to get user token and latest game:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});




