import User from '../models/User.js';
import Friend from '../models/Friend.js';
import { Op } from 'sequelize';
import logger from '../utils/logger.js';

export async function getFriends(userId) {
  try {
    logger.debug('=== بدء جلب الأصدقاء للمستخدم ===');
    logger.debug('user_id:', userId, 'type:', typeof userId);

    // التحقق من وجود المستخدم
    const user = await User.findByPk(userId);
    if (!user) {
      logger.debug('المستخدم غير موجود:', userId);
      return [];
    }
    logger.debug('المستخدم موجود:', user.username);

    // جلب علاقات الصداقة
    const friends = await Friend.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { friend_user_id: userId }
        ],
        status: 'accepted'
      }
    });

    // جلب بيانات المستخدمين بشكل منفصل
    const friendData = await Promise.all(
      friends.map(async (friendship) => {
        const isUserInitiator = friendship.user_id === userId;
        const friendUserId = isUserInitiator ? friendship.friend_user_id : friendship.user_id;
        
        const friendUser = await User.findByPk(friendUserId, {
          attributes: ['user_id', 'username', 'rank', 'thumbnail', 'state']
        });
        
        return {
          friendship,
          friendUser,
          isUserInitiator
        };
      })
    );

    logger.debug('عدد علاقات الصداقة الموجودة:', friends.length);
    logger.debug('تفاصيل علاقات الصداقة:', friends.map(f => ({
      id: f.id,
      user_id: f.user_id,
      friend_user_id: f.friend_user_id,
      status: f.status
    })));

    // معالجة النتائج
    const mappedFriends = friendData.map(({ friendship, friendUser, isUserInitiator }) => {
      logger.debug('معالجة صديق:', {
        friendId: friendUser.user_id,
        username: friendUser.username,
        isInitiator: isUserInitiator
      });

      return {
        id: friendship.id,
        user_id: friendUser.user_id,
        username: friendUser.username,
        rank: friendUser.rank,
        thumbnail: friendUser.thumbnail,
        state: friendUser.state,
        is_online: friendUser.state === 'online',
        friendship_id: friendship.id,
        is_initiator: isUserInitiator
      };
    });

    logger.debug('الأصدقاء المعالجون:', mappedFriends);
    logger.debug('=== انتهاء جلب الأصدقاء ===');

    return mappedFriends;
  } catch (error) {
    logger.error('خطأ في جلب الأصدقاء:', error);
    throw error;
  }
}

// دالة بديلة لـ getUserFriends (نفس الدالة السابقة)
export async function getUserFriends(userId) {
  return await getFriends(userId);
}

export async function sendFriendRequest(fromUserId, toUserId) {
  try {
    logger.debug('sendFriendRequest called with:', { fromUserId, toUserId, types: { fromUserId: typeof fromUserId, toUserId: typeof toUserId } });

    // التحقق من وجود المستخدمين
    const [fromUser, toUser] = await Promise.all([
      User.findByPk(fromUserId),
      User.findByPk(toUserId)
    ]);

    if (!fromUser || !toUser) {
      throw new Error('One or both users not found');
    }

    // التحقق من عدم وجود طلب صداقة مسبق
    const existingFriendship = await Friend.findOne({
      where: {
        [Op.or]: [
          { user_id: fromUserId, friend_user_id: toUserId },
          { user_id: toUserId, friend_user_id: fromUserId }
        ]
      }
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        throw new Error('Users are already friends');
      } else if (existingFriendship.status === 'pending') {
        throw new Error('Friend request already pending');
      }
    }

    // إنشاء طلب صداقة جديد
    const friendship = await Friend.create({
      user_id: fromUserId,
      friend_user_id: toUserId,
      status: 'pending'
    });

    return {
      success: true,
      friendship_id: friendship.id,
      message: 'Friend request sent successfully'
    };
  } catch (error) {
    logger.error('Error sending friend request:', error);
    throw error;
  }
}

export async function acceptFriendRequest(friendshipId, userId) {
  try {
    const friendship = await Friend.findByPk(friendshipId);
    
    if (!friendship) {
      throw new Error('Friendship request not found');
    }

    if (friendship.friend_user_id !== userId) {
      throw new Error('Unauthorized to accept this request');
    }

    if (friendship.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    await friendship.update({ status: 'accepted' });

    return {
      success: true,
      message: 'Friend request accepted'
    };
  } catch (error) {
    logger.error('Error accepting friend request:', error);
    throw error;
  }
}

export async function rejectFriendRequest(friendshipId, userId) {
  try {
    const friendship = await Friend.findByPk(friendshipId);
    
    if (!friendship) {
      throw new Error('Friendship request not found');
    }

    if (friendship.friend_user_id !== userId) {
      throw new Error('Unauthorized to reject this request');
    }

    await friendship.destroy();

    return {
      success: true,
      message: 'Friend request rejected'
    };
  } catch (error) {
    logger.error('Error rejecting friend request:', error);
    throw error;
  }
}

export async function deleteFriend(userId, friendUserId) {
  try {
    logger.debug('بدء حذف الصديق:', { userId, friendUserId });

    // التحقق من وجود المستخدمين
    const [user, friend] = await Promise.all([
      User.findByPk(userId),
      User.findByPk(friendUserId)
    ]);

    if (!user || !friend) {
      throw new Error('One or both users not found');
    }

    logger.debug('نتائج البحث عن المستخدمين:', {
      userExists: !!user,
      friendExists: !!friend,
      userUsername: user?.username,
      friendUsername: friend?.username
    });

    // البحث عن علاقة الصداقة
    const friendship = await Friend.findOne({
      where: {
        [Op.or]: [
          { user_id: userId, friend_user_id: friendUserId },
          { user_id: friendUserId, friend_user_id: userId }
        ],
        status: 'accepted'
      }
    });

    if (!friendship) {
      throw new Error('Friendship not found or not accepted');
    }

    logger.debug('نتيجة البحث عن الصداقة:', friendship ? {
      id: friendship.id,
      user_id: friendship.user_id,
      friend_user_id: friendship.friend_user_id,
      status: friendship.status
    } : 'not found');

    // حذف علاقة الصداقة
    await friendship.destroy();

    logger.debug('تم حذف الصداقة بنجاح');

    return {
      success: true,
      message: 'Friend deleted successfully'
    };
  } catch (error) {
    logger.error('Error deleting friend:', error);
    throw error;
  }
} 