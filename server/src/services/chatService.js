import GameChat from '../models/GameChat.js';
import User from '../models/User.js';
import { Op } from 'sequelize';

/**
 * إرسال رسالة في الدردشة
 */
export async function sendMessage(gameId, userId, message, messageType = 'text') {
  try {
    const chatMessage = await GameChat.create({
      gameId,
      userId,
      message,
      messageType,
    });

    // جلب بيانات المستخدم
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'username', 'thumbnail']
    });

    return {
      id: chatMessage.id,
      message: chatMessage.message,
      messageType: chatMessage.messageType,
      createdAt: chatMessage.createdAt,
      user: {
        id: user.user_id,
        username: user.username,
        thumbnail: user.thumbnail
      }
    };
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw new Error('فشل في إرسال الرسالة');
  }
}

/**
 * جلب رسائل الدردشة للعبة
 */
export async function getGameMessages(gameId, limit = 50, offset = 0) {
  try {
    const messages = await GameChat.findAll({
      where: { gameId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'thumbnail']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return messages.reverse(); // إرجاع الرسائل بالترتيب الصحيح
  } catch (error) {
    console.error('Error getting game messages:', error);
    throw new Error('فشل في جلب رسائل الدردشة');
  }
}

/**
 * حذف رسالة من الدردشة
 */
export async function deleteMessage(messageId, userId) {
  try {
    const message = await GameChat.findByPk(messageId);
    if (!message) {
      throw new Error('الرسالة غير موجودة');
    }

    // التحقق من أن المستخدم هو من أرسل الرسالة
    if (message.userId !== userId) {
      throw new Error('غير مصرح بحذف هذه الرسالة');
    }

    await message.destroy();
    return { success: true };
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

/**
 * إرسال رسالة نظام
 */
export async function sendSystemMessage(gameId, message) {
  try {
    return await sendMessage(gameId, null, message, 'system');
  } catch (error) {
    console.error('Error sending system message:', error);
    throw error;
  }
} 