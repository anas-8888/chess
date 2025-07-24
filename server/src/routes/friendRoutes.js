import express from 'express';
import { protect, userOnly } from '../middlewares/authMiddleware.js';
import {
  getMyFriends,
  getFriendRequests,
  sendFriendRequest,
  sendFriendRequestByEmail,
  updateFriendRequest,
  deleteFriend,
  getPendingRequests,
  getMyFriendsForDashboard,
} from '../controllers/friendController.js';
import {
  friendRequestActionSchema,
  userIdParamSchema,
  sendFriendRequestSchema,
  updateFriendRequestSchema,
  deleteFriendSchema,
} from '../middlewares/validation/friendValidation.js';
import { validate } from '../middlewares/validation/validationMiddleware.js';
import { Op } from 'sequelize';
import Friend from '../models/Friend.js';
import User from '../models/User.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(userOnly);

// GET /api/friends - Get current user's friends
router.get('/', getMyFriends);

// GET /api/friends/requests - Get friend requests
router.get('/requests', getFriendRequests);

// GET /api/friends/pending - Get pending friend requests sent by current user
router.get('/pending', getPendingRequests);

// GET /api/friends/incoming - Get incoming friend requests
router.get('/incoming', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const incomingRequests = await Friend.findAll({
      where: {
        friend_user_id: userId,
        status: 'pending'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'email', 'thumbnail']
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    const formattedRequests = incomingRequests.map(request => ({
      id: request.id,
      from_user_id: request.user_id,
      from_user: request.user,
      status: request.status,
      created_at: request.created_at
    }));
    
    return res.status(200).json({
      success: true,
      data: formattedRequests,
      message: 'تم جلب الطلبات الواردة بنجاح'
    });
    
  } catch (error) {
    console.error('خطأ في جلب الطلبات الواردة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات الواردة'
    });
  }
});

// POST /api/friends/request - Send friend request
router.post('/request', validate(sendFriendRequestSchema), sendFriendRequest);

// POST /api/friends/request/:requestId/accept - Accept friend request by request ID
router.post('/request/:requestId/accept', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const userId = req.user.user_id;
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }
    
    // Find the friend request
    const friendRequest = await Friend.findOne({
      where: {
        id: requestId,
        friend_user_id: userId,
        status: 'pending'
      }
    });
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصداقة غير موجود أو تم الرد عليه مسبقاً'
      });
    }
    
    // Update the request status to accepted
    await friendRequest.update({ status: 'accepted' });
    
    return res.status(200).json({
      success: true,
      message: 'تم قبول طلب الصداقة بنجاح'
    });
    
  } catch (error) {
    console.error('خطأ في قبول طلب الصداقة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في قبول طلب الصداقة'
    });
  }
});

// POST /api/friends/request/:requestId/reject - Reject friend request by request ID
router.post('/request/:requestId/reject', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const userId = req.user.user_id;
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }
    
    // Find the friend request
    const friendRequest = await Friend.findOne({
      where: {
        id: requestId,
        friend_user_id: userId,
        status: 'pending'
      }
    });
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصداقة غير موجود أو تم الرد عليه مسبقاً'
      });
    }
    
    // Update the request status to rejected
    await friendRequest.update({ status: 'rejected' });
    
    return res.status(200).json({
      success: true,
      message: 'تم رفض طلب الصداقة بنجاح'
    });
    
  } catch (error) {
    console.error('خطأ في رفض طلب الصداقة:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل في رفض طلب الصداقة'
    });
  }
});

// POST /api/friends - Send friend request by email
router.post('/', sendFriendRequestByEmail);

// POST /api/friends/accept/:userId - Accept friend request
router.post('/accept/:userId', validate(updateFriendRequestSchema), updateFriendRequest);

// POST /api/friends/reject/:userId - Reject friend request
router.post('/reject/:userId', validate(updateFriendRequestSchema), updateFriendRequest);

// DELETE /api/friends/:userId - Remove friend
router.delete('/:userId', deleteFriend);

// GET /api/friends/check/:userId - Check friendship status
router.get('/check/:userId', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const friendUserId = parseInt(req.params.userId);
    
    if (!friendUserId || isNaN(friendUserId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم غير صحيح'
      });
    }
    
    const friendship = await Friend.findOne({
      where: {
        [Op.or]: [
          { user_id: userId, friend_user_id: friendUserId },
          { user_id: friendUserId, friend_user_id: userId }
        ]
      }
    });
    
    if (!friendship) {
      return res.json({
        success: true,
        isFriend: false,
        status: null
      });
    }
    
    return res.json({
      success: true,
      isFriend: true,
      status: friendship.status
    });
    
  } catch (error) {
    console.error('خطأ في التحقق من علاقة الصداقة:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في التحقق من علاقة الصداقة'
    });
  }
});

// GET /api/friends/dashboard - Get friends for dashboard
router.get('/dashboard', getMyFriendsForDashboard);

export default router; 