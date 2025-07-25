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
    logger.error('خطأ في البحث عن المستخدمين:', error);
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
  // Temporary: Use a default user ID for testing
  const userId = req.user?.user_id || 1;

  try {
    // Get user data directly
    const User = await import('../models/User.js');
    const user = await User.default.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'deleted_at'] },
    });

    if (!user) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }
    
    // Get game statistics - return 0 for now since Game table might not exist
    let wins = 0, losses = 0, draws = 0;
    
    try {
      const Game = await import('../models/Game.js');
      const { Op } = await import('sequelize');
      
      // Count wins, losses, draws
      [wins, losses, draws] = await Promise.all([
        Game.default.count({
          where: {
            [Op.or]: [
              { player1_id: userId, winner: 'player1' },
              { player2_id: userId, winner: 'player2' }
            ],
            status: 'finished'
          }
        }),
        Game.default.count({
          where: {
            [Op.or]: [
              { player1_id: userId, winner: 'player2' },
              { player2_id: userId, winner: 'player1' }
            ],
            status: 'finished'
          }
        }),
        Game.default.count({
          where: {
            [Op.or]: [
              { player1_id: userId },
              { player2_id: userId }
            ],
            winner: 'draw',
            status: 'finished'
          }
        })
      ]);
    } catch (error) {
      logger.warn('Game table might not exist, using default statistics:', error.message);
      // Use default values if Game table doesn't exist
      wins = 0;
      losses = 0;
      draws = 0;
    }

    const response = {
      success: true,
      data: {
        user: user,
        statistics: {
          wins,
          losses,
          draws
        }
      },
      message: 'تم جلب بيانات المستخدم والإحصائيات بنجاح'
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('خطأ في جلب إحصائيات المستخدم:', error);
    res.status(500).json(formatError('خطأ في جلب إحصائيات المستخدم'));
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

    res.status(200).json({
      user_id: user.user_id,
      state: user.state
    });
  } catch (error) {
    logger.error('Error getting current user status:', error);
    res.status(500).json(formatError('Failed to get user status'));
  }
});
