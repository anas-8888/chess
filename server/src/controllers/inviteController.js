import { formatResponse, formatError } from '../utils/helpers.js';
import * as inviteService from '../services/inviteService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import {
  listInvitesSchema,
  createGameInviteSchema,
  respondToInviteSchema,
  startGameSchema,
  gameIdSchema,
} from '../middlewares/validation/commonSchemas.js';

/**
 * Get all invites with pagination and filtering
 */
export const list = asyncHandler(async (req, res) => {
  const validation = listInvitesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الاستعلام غير صحيحة', validation.error.errors));
  }

  const result = await inviteService.listInvites(validation.data);
  return res.status(200).json(formatResponse(result.invites || result, 'تم جلب الدعوات بنجاح'));
});

/**
 * Get invite by ID
 */
export const getById = asyncHandler(async (req, res) => {
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }

  const invite = await inviteService.getInviteById(inviteId);
  
  if (!invite) {
    return res.status(404).json(formatError('الدعوة غير موجودة'));
  }
  
  return res.status(200).json(formatResponse(invite, 'تم جلب الدعوة بنجاح'));
});

/**
 * Create a new invite
 */
export const create = asyncHandler(async (req, res) => {
  const validation = createGameInviteSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الدعوة غير صحيحة', validation.error.errors));
  }

  const inviteData = validation.data;
  const invite = await inviteService.createInvite(inviteData);
  
  return res.status(201).json(formatResponse(invite, 'تم إنشاء الدعوة بنجاح'));
});

/**
 * Update an invite
 */
export const update = asyncHandler(async (req, res) => {
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }

  const updateData = req.body;
  const invite = await inviteService.updateInvite(inviteId, updateData);
  
  return res.status(200).json(formatResponse(invite, 'تم تحديث الدعوة بنجاح'));
});

/**
 * Delete an invite
 */
export const deleteInvite = asyncHandler(async (req, res) => {
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }

  await inviteService.deleteInvite(inviteId);
  
  return res.status(200).json(formatResponse(null, 'تم حذف الدعوة بنجاح'));
});

/**
 * Get invites sent by current user
 */
export const getSentInvites = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const validation = listInvitesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الاستعلام غير صحيحة', validation.error.errors));
  }

  const result = await inviteService.getSentInvites(userId, validation.data);
  return res.status(200).json(formatResponse(result.invites || result, 'تم جلب الدعوات المرسلة بنجاح'));
});

/**
 * Get invites received by current user
 */
export const getReceivedInvites = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const validation = listInvitesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الاستعلام غير صحيحة', validation.error.errors));
  }

  const result = await inviteService.getReceivedInvites(userId, validation.data);
  return res.status(200).json(formatResponse(result.invites || result, 'تم جلب الدعوات المستلمة بنجاح'));
});

/**
 * Create a game invite
 */
export const createGameInvite = asyncHandler(async (req, res) => {
  const fromUserId = req.user.user_id;
  
  const validation = createGameInviteSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الدعوة غير صحيحة', validation.error.errors));
  }
  
  const { to_user_id, game_type, play_method } = validation.data;
  
  console.log('إنشاء دعوة لعب:', { fromUserId, to_user_id, game_type, play_method });
  
  const invite = await inviteService.createGameInvite(fromUserId, to_user_id, game_type, play_method);
  
  return res.status(201).json(formatResponse(invite, 'تم إنشاء دعوة اللعب بنجاح'));
});

/**
 * Get active invites for current user
 */
export const getActiveInvites = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  const invites = await inviteService.getActiveInvites(userId);
  
  return res.status(200).json(formatResponse(invites, 'تم جلب الدعوات النشطة بنجاح'));
});

/**
 * Respond to game invite
 */
export const respondToInvite = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }
  
  const validation = respondToInviteSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات الرد غير صحيحة', validation.error.errors));
  }
  
  const { response } = validation.data;
  
  const result = await inviteService.respondToInvite(inviteId, userId, response);
  
  return res.status(200).json(formatResponse(result, `تم ${response === 'accept' ? 'قبول' : 'رفض'} الدعوة بنجاح`));
});

/**
 * Start game with method
 */
export const startGame = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }
  
  const validation = startGameSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات بدء اللعبة غير صحيحة', validation.error.errors));
  }
  
  const { play_method } = validation.data;
  
  const result = await inviteService.startGame(inviteId, userId, play_method);
  
  return res.status(200).json(formatResponse(result, 'تم بدء اللعبة بنجاح'));
});

/**
 * Get recent invites (last hour)
 */
export const getRecentInvites = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { since } = req.query;
  
  // إذا لم يتم تحديد التاريخ، استخدم الساعة الماضية
  let sinceDate = new Date(Date.now() - 60 * 60 * 1000); // ساعة واحدة ماضية
  
  if (since) {
    try {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json(formatError('تاريخ غير صحيح'));
      }
    } catch (error) {
      return res.status(400).json(formatError('تاريخ غير صحيح'));
    }
  }
  
  try {
    const invites = await inviteService.getRecentInvites(userId, sinceDate);
    return res.status(200).json(formatResponse({ invites }, 'تم جلب الدعوات الحديثة بنجاح'));
  } catch (error) {
    console.error('خطأ في جلب الدعوات الحديثة:', error);
    return res.status(500).json(formatError('خطأ في جلب الدعوات الحديثة'));
  }
});

/**
 * Cancel an invite (only by sender)
 */
export const cancelInvite = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  // تحويل id من string إلى number
  const inviteId = parseInt(req.params.id);
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json(formatError('معرف الدعوة غير صحيح'));
  }
  
  try {
    const result = await inviteService.cancelInvite(inviteId, userId);
    return res.status(200).json(formatResponse(result, 'تم إلغاء الدعوة بنجاح'));
  } catch (error) {
    console.error('خطأ في إلغاء الدعوة:', error);
    if (error.message.includes('غير موجودة')) {
      return res.status(404).json(formatError(error.message));
    } else if (error.message.includes('غير مصرح')) {
      return res.status(403).json(formatError(error.message));
    } else {
      return res.status(500).json(formatError('خطأ في إلغاء الدعوة'));
    }
  }
});

/**
 * Get pending invites for dashboard
 */
export const getPendingInvitesForDashboard = asyncHandler(async (req, res) => {
  // Temporary: Use a default user ID for testing
  const userId = req.user?.user_id || 1;
  
  try {
    // Get pending invites directly from database
    const Invite = await import('../models/Invite.js');
    const User = await import('../models/User.js');
    
    // First get invites
    const invites = await Invite.default.findAll({
      where: {
        to_user_id: userId,
        status: 'pending'
      },
      order: [['date_time', 'DESC']]
    });
    
    // Then get user data for each invite
    const dashboardInvites = await Promise.all(
      invites.map(async (invite) => {
        const fromUser = await User.default.findByPk(invite.from_user_id, {
          attributes: ['user_id', 'username', 'thumbnail', 'rank']
        });
        
        return {
          id: invite.id.toString(),
          from_user: {
            id: fromUser.user_id.toString(),
            username: fromUser.username,
            avatar: fromUser.thumbnail || null,
            rating: fromUser.rank || 1200
          },
          game_type: invite.game_type || 'standard',
          time_control: invite.time_control || 10,
          created_at: invite.date_time
        };
      })
    );
    

    
    return res.status(200).json({
      success: true,
      data: dashboardInvites,
      message: dashboardInvites.length === 0 ? 'لا توجد دعوات معلقة' : `تم العثور على ${dashboardInvites.length} دعوة معلقة`
    });
  } catch (error) {
    console.error('خطأ في جلب الدعوات المعلقة للـ Dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب الدعوات المعلقة'
    });
  }
});

/**
 * Accept game invite for dashboard
 */
export const acceptInviteForDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const inviteId = parseInt(req.params.id);
  
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json({
      success: false,
      message: 'معرف الدعوة غير صحيح'
    });
  }
  
  try {
    const result = await inviteService.respondToInvite(inviteId, userId, 'accept');
    
    return res.status(200).json({
      success: true,
      data: {
        gameId: result.gameId ? result.gameId.toString() : null
      },
      message: 'تم قبول الدعوة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في قبول الدعوة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في قبول الدعوة'
    });
  }
});

/**
 * Decline game invite for dashboard
 */
export const declineInviteForDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const inviteId = parseInt(req.params.id);
  
  if (isNaN(inviteId) || inviteId < 1) {
    return res.status(400).json({
      success: false,
      message: 'معرف الدعوة غير صحيح'
    });
  }
  
  try {
    await inviteService.respondToInvite(inviteId, userId, 'decline');
    
    return res.status(200).json({
      success: true,
      message: 'تم رفض الدعوة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في رفض الدعوة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في رفض الدعوة'
    });
  }
});

/**
 * Send game invite to friend for dashboard
 */
export const sendInviteToFriend = asyncHandler(async (req, res) => {
  const fromUserId = req.user.user_id;
  const { friend_id, time_control = 10, game_type = 'standard' } = req.body;
  
  if (!friend_id) {
    return res.status(400).json({
      success: false,
      message: 'معرف الصديق مطلوب'
    });
  }
  
  try {
    const invite = await inviteService.createGameInvite(fromUserId, friend_id, game_type, 'friend');
    
    return res.status(201).json({
      success: true,
      data: {
        inviteId: invite.id.toString()
      },
      message: 'تم إرسال الدعوة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في إرسال الدعوة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في إرسال الدعوة'
    });
  }
});
