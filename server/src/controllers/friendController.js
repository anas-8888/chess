import { formatResponse, formatError } from '../utils/helpers.js';
import * as friendService from '../services/friendService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import {
  sendFriendRequestSchema,
  sendFriendRequestByEmailSchema,
  userIdSchema,
} from '../middlewares/validation/commonSchemas.js';

// Get current user's friends
export const getMyFriends = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
      logger.debug('Fetching friends for user:', userId);
  
  try {
    const friends = await friendService.getUserFriends(userId);
    
    logger.debug('Friends count:', friends.length);
    
    return res.status(200).json(formatResponse(friends, {
      message: friends.length === 0 ? 'لا توجد أصدقاء حالياً. أضف أصدقاء جدد!' : `تم العثور على ${friends.length} صديق`,
      count: friends.length
    }));
  } catch (error) {
    logger.error('Failed to fetch friends:', error);
    return res.status(500).json(formatError('فشل في جلب قائمة الأصدقاء', error.message));
  }
});

// Get friend requests
export const getFriendRequests = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const requests = await friendService.getFriendRequests(userId);
  
  return res.status(200).json(formatResponse(requests, 'تم جلب طلبات الصداقة بنجاح'));
});

// Send friend request
export const sendFriendRequest = asyncHandler(async (req, res) => {
  const fromUserId = req.user.user_id;
  
  // Validate input
  const validation = sendFriendRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات غير صحيحة', validation.error.errors));
  }
  
  const { toUserId } = validation.data;
  
  // تحويل string إلى number
  const toUserIdNumber = parseInt(toUserId);
  
  logger.debug('Sending friend request:', { fromUserId, toUserId: toUserIdNumber });
  
  const result = await friendService.sendFriendRequest(fromUserId, toUserIdNumber);
  
  // إرسال إشعار للطرف الآخر عبر WebSocket
  try {
    const io = global.io;
    if (io) {
      io.to(`user::${toUserIdNumber}`).emit('friendRequestReceived', {
        fromUserId: fromUserId,
        toUserId: toUserIdNumber,
        requestId: result.id,
        message: 'طلب صداقة جديد'
      });
      logger.debug('Friend request notification sent');
    }
  } catch (error) {
    logger.error('Failed to send friend request notification:', error);
  }
  
  return res.status(201).json(formatResponse(result, 'تم إرسال طلب الصداقة بنجاح'));
});

// Send friend request by email
export const sendFriendRequestByEmail = asyncHandler(async (req, res) => {
  const fromUserId = req.user.user_id;
  
  // Validate input
  const validation = sendFriendRequestByEmailSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات غير صحيحة', validation.error.errors));
  }
  
  const { email } = validation.data;
  
  const result = await friendService.sendFriendRequestByEmail(fromUserId, email);
  
  return res.status(201).json(formatResponse(result, 'تم إرسال طلب الصداقة بنجاح'));
});

// Accept/reject friend request
export const updateFriendRequest = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  // Validate input
  const validation = userIdSchema.safeParse(req.params);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات غير صحيحة', validation.error.errors));
  }
  
  const { userId: friendUserId } = validation.data;
  
  // تحويل string إلى number
  const friendUserIdNumber = parseInt(friendUserId);
  
  // تحديد الـ action من الـ URL path
  const action = req.path.includes('/accept/') ? 'accept' : 'reject';
  
  logger.debug('Processing friend request:', { userId, friendUserId: friendUserIdNumber, action });
  
  const result = await friendService.updateFriendRequest(userId, friendUserIdNumber, action);
  
  return res.status(200).json(formatResponse(result, `تم ${action === 'accept' ? 'قبول' : 'رفض'} طلب الصداقة بنجاح`));
});

// Remove friend
export const deleteFriend = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  // Validate input
  const validation = userIdSchema.safeParse(req.params);
  if (!validation.success) {
    return res.status(400).json(formatError('بيانات غير صحيحة', validation.error.errors));
  }
  
  const { userId: friendUserId } = validation.data;
  
  // تحويل string إلى number
  const friendUserIdNumber = parseInt(friendUserId);
  
  logger.debug('Removing friend:', { userId, friendUserId: friendUserIdNumber });
  
  const result = await friendService.deleteFriend(userId, friendUserIdNumber);
  
  logger.debug('Friend removal result:', result);
  
  return res.status(200).json(formatResponse(result, 'تم حذف الصديق بنجاح'));
});

// Get pending friend requests sent by current user
export const getPendingRequests = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  const result = await friendService.getPendingRequests(userId);
  
  return res.status(200).json(formatResponse(result, 'تم جلب الطلبات المعلقة بنجاح'));
}); 

// Get current user's friends with status for dashboard
export const getMyFriendsForDashboard = asyncHandler(async (req, res) => {
  // Temporary: Use a default user ID for testing
  const userId = req.user?.user_id || 1;
  
  logger.debug('Dashboard:', userId);
  
  try {
    const friends = await friendService.getUserFriends(userId);
    
    // Transform friends data for dashboard
    const dashboardFriends = friends.map(friend => ({
      id: friend.user_id.toString(),
      username: friend.username,
      avatar: friend.thumbnail || null,
      status: friend.state || 'offline',
      rating: friend.rank || 1200
    }));
    
    logger.debug('Dashboard:', dashboardFriends.length);
    
    return res.status(200).json({
      success: true,
      data: dashboardFriends,
      message: dashboardFriends.length === 0 ? 'لا توجد أصدقاء حالياً. أضف أصدقاء جدد!' : `تم العثور على ${dashboardFriends.length} صديق`
    });
  } catch (error) {
    logger.error('Dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب قائمة الأصدقاء'
    });
  }
}); 

