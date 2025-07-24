import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import User from '../models/User.js';
import Invite from '../models/Invite.js';
import Game from '../models/Game.js';
import { Op } from 'sequelize';
import logger from '../utils/logger.js';

// Store active user connections - تحسين لتتبع جميع الاتصالات لكل مستخدم
const activeUsers = new Map(); // userId -> Set of socketIds
const activeGames = {};
const gameTimers = {};

// Store previous stats for comparison
let previousStats = { totalUsers: 0, totalConnections: 0 };

// Configuration for logging
const LOG_CONFIG = {
  showDetailedConnections: false, // تعطيل الرسائل التفصيلية للاتصالات
  showStatusUpdates: true,        // إظهار تحديثات الحالة
  showStats: true                // إظهار الإحصائيات
};

// Function to update logging configuration
export function updateLogConfig(newConfig) {
  Object.assign(LOG_CONFIG, newConfig);
  logger.info('تم تحديث إعدادات التسجيل', LOG_CONFIG);
}

// Function to get current log config
export function getLogConfig() {
  return { ...LOG_CONFIG };
}

// Function to disable all detailed logging
export function disableDetailedLogging() {
  updateLogConfig({
    showDetailedConnections: false,
    showStatusUpdates: false,
    showStats: false
  });
  logger.info('تم تعطيل جميع الرسائل التفصيلية');
}

// Function to enable minimal logging (only important events)
export function enableMinimalLogging() {
  updateLogConfig({
    showDetailedConnections: false,
    showStatusUpdates: true,  // إظهار فقط تحديثات الحالة المهمة
    showStats: false
  });
  logger.info('تم تفعيل التسجيل البسيط (الأحداث المهمة فقط)');
}

// Authentication helper
export function authenticateSocket(socket) {
  try {
    // Try JWT first
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded.user_id;
    }
    
    // Fallback to userId in query
    const userId = parseInt(socket.handshake.query.userId);
    if (!userId || isNaN(userId)) {
      throw new Error('Authentication required');
    }
    
    return userId;
  } catch (error) {
    throw new Error('Authentication failed');
  }
}

// User connection management
export function addUserConnection(userId, socketId) {
  if (!activeUsers.has(userId)) {
    activeUsers.set(userId, new Set());
  }
  activeUsers.get(userId).add(socketId);
  
  const totalConnections = activeUsers.get(userId).size;
  
  // تحديث حالة المستخدم إلى online عند أول اتصال
  if (totalConnections === 1) {
    updateUserStatus(userId, 'online').catch(error => {
      logger.error('خطأ في تحديث حالة المستخدم إلى online', error);
    });
  }
  
  // طباعة رسالة فقط عند أول اتصال أو عند تغيير عدد الاتصالات
  if (LOG_CONFIG.showDetailedConnections) {
    if (totalConnections === 1) {
      logger.debug(`اتصال جديد للمستخدم ${userId} (${socketId})`);
    } else {
      logger.debug(`اتصال إضافي للمستخدم ${userId} - إجمالي الاتصالات: ${totalConnections}`);
    }
  }
}

export function removeUserConnection(userId, socketId) {
  if (activeUsers.has(userId)) {
    activeUsers.get(userId).delete(socketId);
    
    const remainingConnections = activeUsers.get(userId).size;
    
    // إذا لم يتبق أي اتصالات، احذف المستخدم من القائمة وتحديث الحالة إلى offline
    if (remainingConnections === 0) {
      activeUsers.delete(userId);
      logger.debug(`❌ تم قطع جميع اتصالات المستخدم ${userId}`);
      
      // تحديث حالة المستخدم إلى offline عند قطع آخر اتصال
      updateUserStatus(userId, 'offline').catch(error => {
        logger.error('خطأ في تحديث حالة المستخدم إلى offline', error);
      });
    } else if (LOG_CONFIG.showDetailedConnections) {
      logger.debug(`➖ اتصال أقل للمستخدم ${userId} - الاتصالات المتبقية: ${remainingConnections}`);
    }
  }
}

export function getUserConnections(userId) {
  return activeUsers.get(userId) || new Set();
}

export function isUserOnline(userId) {
  return activeUsers.has(userId) && activeUsers.get(userId).size > 0;
}

// User status management
export async function updateUserStatus(userId, status) {
  try {
    if (!userId || !status) {
      logger.error('بيانات تحديث حالة المستخدم غير مكتملة:', { userId, status });
      return;
    }
    
    // التحقق من صحة الحالة حسب نموذج User
    const validStatuses = ['online', 'offline', 'in-game'];
    if (!validStatuses.includes(status)) {
      logger.error('حالة مستخدم غير صحيحة:', status);
      return;
    }
    
    // التحقق من وجود المستخدم أولاً
    const user = await User.findByPk(userId);
    if (!user) {
      logger.error('المستخدم غير موجود:', userId);
      return;
    }
    
    // التحقق من الحالة الحالية قبل التحديث
    if (user.state === status) {
      logger.debug(`المستخدم ${userId} حالته ${status} بالفعل، تخطي التحديث`);
      return;
    }
    
    // تحديث الحالة فقط إذا تغيرت فعلياً
    const oldStatus = user.state;
    await User.update(
      { state: status },
      { where: { user_id: userId } }
    );
    
    const connectionsCount = getUserConnections(userId).size;
    
    // طباعة رسائل محسنة فقط إذا كان مفعلاً
    if (LOG_CONFIG.showStatusUpdates) {
      if (status === 'online' && connectionsCount > 0) {
        logger.info(`🟢 المستخدم ${userId} متصل الآن (${connectionsCount} اتصال)`);
      } else if (status === 'offline') {
        logger.info(`🔴 المستخدم ${userId} غير متصل`);
      } else if (status === 'in-game') {
        logger.info(`🎮 المستخدم ${userId} في مباراة`);
      }
    }
    
    // إرسال تحديث الحالة لجميع أصدقاء المستخدم فقط إذا تغيرت الحالة
    await broadcastFriendStatusUpdate(userId, status);
    
    // تسجيل التحديث مرة واحدة فقط
    logger.debug(`تم تحديث حالة المستخدم ${userId} من ${oldStatus} إلى ${status}`);
  } catch (error) {
    logger.error('Error updating user status:', error);
  }
}

// دالة لإرسال حالة الأصدقاء للمستخدم الجديد
export async function sendFriendsStatusToUser(socket, userId) {
  try {
    // استيراد نموذج Friend
    const Friend = await import('../models/Friend.js');
    
    // البحث عن جميع أصدقاء المستخدم
    const friends = await Friend.default.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { friend_user_id: userId }
        ],
        status: 'accepted'
      }
    });
    
    // إرسال حالة كل صديق
    for (const friend of friends) {
      const friendUserId = friend.user_id === userId ? friend.friend_user_id : friend.user_id;
      
      // الحصول على حالة الصديق من قاعدة البيانات
      const friendUser = await User.findByPk(friendUserId);
      if (friendUser) {
        socket.emit('friendStatusChanged', {
          userId: friendUserId,
          status: friendUser.state,
          timestamp: new Date()
        });
      }
    }
    
    logger.debug(`📡 تم إرسال حالة ${friends.length} صديق للمستخدم ${userId}`);
  } catch (error) {
    logger.error('خطأ في إرسال حالة الأصدقاء:', error);
  }
}

// دالة لإرسال تحديث حالة المستخدم لجميع أصدقائه
async function broadcastFriendStatusUpdate(userId, status) {
  try {
    // استيراد نموذج Friend
    const Friend = await import('../models/Friend.js');
    
    // البحث عن جميع أصدقاء المستخدم
    const friends = await Friend.default.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { friend_user_id: userId }
        ],
        status: 'accepted'
      }
    });
    
    // التحقق من وجود أصدقاء قبل الإرسال
    if (friends.length === 0) {
      logger.debug(`المستخدم ${userId} ليس له أصدقاء، تخطي إرسال تحديث الحالة`);
      return;
    }
    
    // إرسال التحديث لكل صديق
    let sentCount = 0;
    for (const friend of friends) {
      const friendUserId = friend.user_id === userId ? friend.friend_user_id : friend.user_id;
      
      // إرسال التحديث عبر Socket.IO
      const io = global.io;
      if (io) {
        io.to(`user_${friendUserId}`).emit('friendStatusChanged', {
          userId: userId,
          status: status,
          timestamp: new Date()
        });
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      logger.debug(`📡 تم إرسال تحديث حالة المستخدم ${userId} (${status}) لـ ${sentCount} صديق`);
    } else {
      logger.debug(`لم يتم إرسال أي تحديثات للمستخدم ${userId} (${status})`);
    }
  } catch (error) {
    logger.error('خطأ في إرسال تحديث حالة الأصدقاء:', error);
  }
}

// Game creation helpers
export async function createGame(invite) {
  try {
    // تحديد من يلعب بالأبيض (عشوائياً)
    const isWhiteRandom = Math.random() < 0.5;
    const whiteUserId = isWhiteRandom ? invite.from_user_id : invite.to_user_id;
    const blackUserId = isWhiteRandom ? invite.to_user_id : invite.from_user_id;
    
    // إنشاء المباراة مع الحقول الصحيحة حسب نموذج Game
    const game = await Game.create({
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: invite.play_method,
      blackPlayMethod: invite.play_method,
      gameTime: '10', // القيمة الافتراضية حسب نموذج Game
      mode: invite.game_type,
      status: 'in_progress',
      dateTime: new Date(),
    });
    
    logger.info('تم إنشاء مباراة جديدة:', {
      gameId: game.id,
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      playMethod: invite.play_method,
      gameType: invite.game_type
    });
    
    return game;
  } catch (error) {
    logger.error('خطأ في إنشاء المباراة:', error);
    throw error;
  }
}

export async function createGameWithMethods(invite) {
  try {
    // تحديد من يلعب بالأبيض (عشوائياً)
    const isWhiteRandom = Math.random() < 0.5;
    const whiteUserId = isWhiteRandom ? invite.from_user_id : invite.to_user_id;
    const blackUserId = isWhiteRandom ? invite.to_user_id : invite.from_user_id;
    
    // تحديد طريقتي اللعب لكل لاعب
    const whitePlayMethod = isWhiteRandom ? invite.play_method : invite.play_method;
    const blackPlayMethod = isWhiteRandom ? invite.play_method : invite.play_method;
    
    // إنشاء المباراة مع الحقول الصحيحة حسب نموذج Game
    const game = await Game.create({
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: whitePlayMethod,
      blackPlayMethod: blackPlayMethod,
      gameTime: '10', // القيمة الافتراضية حسب نموذج Game
      mode: invite.game_type,
      status: 'in_progress',
      dateTime: new Date(),
    });
    
    logger.info('تم إنشاء مباراة جديدة مع طريقتي اللعب:', {
      gameId: game.id,
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: whitePlayMethod,
      blackPlayMethod: blackPlayMethod,
      gameType: invite.game_type
    });
    
    return game;
  } catch (error) {
    logger.error('خطأ في إنشاء المباراة مع طريقتي اللعب:', error);
    throw error;
  }
}

// Invite management helpers
export async function handleGameInvite(socket, nsp, userId, { toUserId, gameType, playMethod }) {
  try {
    logger.info('إرسال دعوة لعب:', { fromUserId: userId, toUserId, gameType, playMethod });

    // فحص البيانات المطلوبة
    if (!toUserId || !gameType || !playMethod) {
      return socket.emit('error', { message: 'بيانات الدعوة غير مكتملة' });
    }

    // Check if recipient exists and is online
    const recipient = await User.findByPk(toUserId);
    if (!recipient) {
      return socket.emit('error', { message: 'المستخدم غير موجود' });
    }

    // Check recipient's current status
    if (recipient.state === 'offline') {
      return socket.emit('error', { message: 'المستخدم غير متصل حالياً' });
    }

    if (recipient.state === 'in-game') {
      return socket.emit('error', { message: 'المستخدم مشغول في مباراة أخرى' });
    }

    // فحص حالة المرسل أيضاً
    const sender = await User.findByPk(userId);
    if (!sender) {
      return socket.emit('error', { message: 'خطأ في المصادقة' });
    }

    if (sender.state === 'offline') {
      return socket.emit('error', { message: 'يجب أن تكون متصلاً لإرسال دعوة' });
    }

    if (sender.state === 'in-game') {
      return socket.emit('error', { message: 'لا يمكن إرسال دعوة أثناء اللعب' });
    }

    // Check if there's already a pending invite
    const existingInvite = await Invite.findOne({
      where: {
        from_user_id: userId,
        to_user_id: toUserId,
        status: {
          [Op.or]: ['pending', null]
        },
      },
    });

    if (existingInvite) {
      return socket.emit('error', { message: 'يوجد دعوة معلقة بالفعل لهذا المستخدم' });
    }

    // Create invite in database with الحقول الصحيحة حسب نموذج Invite
    const invite = await Invite.create({
      from_user_id: userId,
      to_user_id: toUserId,
      status: 'pending', // استخدام القيمة الافتراضية بدلاً من null
      game_type: gameType,
      play_method: playMethod,
      date_time: new Date(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Broadcast to recipient
    nsp.to(`user::${toUserId}`).emit('inviteCreated', {
      invite: {
        id: invite.id,
        from_user_id: invite.from_user_id,
        to_user_id: invite.to_user_id,
        game_type: invite.game_type,
        play_method: invite.play_method,
        status: invite.status,
        date_time: invite.date_time,
        expires_at: invite.expires_at,
      },
    });

    // Confirm to sender
    socket.emit('gameInviteSent', { success: true, inviteId: invite.id });
    
    logger.info('تم إرسال دعوة بنجاح:', invite.id);
  } catch (error) {
    logger.error('خطأ في إرسال دعوة لعب:', error);
    socket.emit('error', { message: error.message || 'فشل في إرسال الدعوة' });
  }
}

export async function handleInviteResponse(socket, nsp, userId, { inviteId, response }) {
  try {
    logger.info('رد على دعوة لعب:', { inviteId, response, userId });
    
    // فحص البيانات المطلوبة
    if (!inviteId || !response) {
      return socket.emit('error', { message: 'بيانات الرد غير مكتملة' });
    }
    
    const invite = await Invite.findByPk(inviteId);
    if (!invite) {
      return socket.emit('error', { message: 'Invite not found' });
    }

    if (invite.to_user_id !== userId) {
      return socket.emit('error', { message: 'Not authorized' });
    }

    // فحص صلاحية الدعوة
    const now = new Date();
    const inviteDate = new Date(invite.date_time);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    if (inviteDate.getTime() < oneHourAgo.getTime()) {
      return socket.emit('error', { message: 'انتهت صلاحية الدعوة' });
    }

    // Update invite status
    await invite.update({ status: response });

    // Notify sender
    nsp.to(`user::${invite.from_user_id}`).emit('gameInviteResponse', {
      inviteId,
      response,
      fromUserId: invite.to_user_id,
    });

    // If accepted, create game and update player statuses
    if (response === 'accepted') {
      await invite.update({ status: 'accepted' });
      
      // إرسال إشعار للطرفين بقبول الدعوة
      nsp.to(`user::${invite.from_user_id}`).emit('gameInviteAccepted', {
        inviteId: invite.id,
        fromUserId: invite.from_user_id,
        toUserId: invite.to_user_id,
        playMethod: invite.play_method,
        gameType: invite.game_type
      });
      
      nsp.to(`user::${invite.to_user_id}`).emit('gameInviteAccepted', {
        inviteId: invite.id,
        fromUserId: invite.from_user_id,
        toUserId: invite.to_user_id,
        playMethod: invite.play_method,
        gameType: invite.game_type
      });
    } else if (response === 'rejected') {
      // تحديث حالة المستخدمين إلى offline عند الرفض
      await Promise.all([
        updateUserStatus(invite.from_user_id, 'offline'),
        updateUserStatus(invite.to_user_id, 'offline')
      ]);
      
      // Broadcast status updates
      nsp.emit('playerStatusChanged', {
        userId: invite.from_user_id,
        status: 'offline'
      });
      nsp.emit('playerStatusChanged', {
        userId: invite.to_user_id,
        status: 'offline'
      });
    }

    // Remove invite from recipient's list
    socket.emit('inviteRemoved', { inviteId });
  } catch (error) {
    logger.error('خطأ في الرد على دعوة لعب:', error);
    socket.emit('error', { message: error.message });
  }
}

// Game management helpers
export function startClock(nsp, gameId, game) {
  if (gameTimers[gameId]) return;
  
  let whiteTime = 300000; // 5 minutes in milliseconds
  let blackTime = 300000;
  let turn = 'white';

  gameTimers[gameId] = setInterval(() => {
    if (turn === 'white') {
      whiteTime -= 1000;
      if (whiteTime <= 0) {
        nsp
          .to(`game::${gameId}`)
          .emit('gameEnd', { result: 'black_win', reason: 'timeout' });
        stopClock(gameId);
      }
    } else {
      blackTime -= 1000;
      if (blackTime <= 0) {
        nsp
          .to(`game::${gameId}`)
          .emit('gameEnd', { result: 'white_win', reason: 'timeout' });
        stopClock(gameId);
      }
    }
    nsp.to(`game::${gameId}`).emit('clock', { whiteTime, blackTime });
  }, 1000);
}

export function stopClock(gameId) {
  if (gameTimers[gameId]) {
    clearInterval(gameTimers[gameId]);
    delete gameTimers[gameId];
  }
}

// Cleanup helpers
export async function cleanupExpiredInvites(nsp) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const expiredInvites = await Invite.findAll({
      where: {
        status: {
          [Op.or]: ['pending', null]
        },
        date_time: {
          [Op.lt]: oneHourAgo
        }
      }
    });
    
    if (expiredInvites.length > 0) {
      await Invite.update(
        { status: 'expired' },
        {
          where: {
            id: expiredInvites.map(invite => invite.id)
          }
        }
      );
      
      for (const invite of expiredInvites) {
        await updateUserStatus(invite.from_user_id, 'offline');
        await updateUserStatus(invite.to_user_id, 'offline');
        
        nsp.to(`user::${invite.from_user_id}`).emit('inviteExpired', { 
          inviteId: invite.id,
          fromUserId: invite.from_user_id,
          toUserId: invite.to_user_id
        });
        nsp.to(`user::${invite.to_user_id}`).emit('inviteExpired', { 
          inviteId: invite.id,
          fromUserId: invite.from_user_id,
          toUserId: invite.to_user_id
        });
      }
      
      logger.info(`تم تحديث ${expiredInvites.length} دعوة منتهية الصلاحية`);
    }
  } catch (error) {
    logger.error('خطأ في تنظيف الدعوات المنتهية:', error);
  }
}

// Monitoring and debugging functions
export function getConnectionStats() {
  const stats = {
    totalUsers: activeUsers.size,
    totalConnections: 0,
    userDetails: []
  };
  
  for (const [userId, connections] of activeUsers.entries()) {
    stats.totalConnections += connections.size;
    stats.userDetails.push({
      userId,
      connectionsCount: connections.size,
      socketIds: Array.from(connections)
    });
  }
  
  return stats;
}

export function logConnectionStats() {
  const stats = getConnectionStats();
  
  // طباعة الإحصائيات فقط إذا كان هناك تغيير ومفعّل
  const hasChanged = stats.totalUsers !== previousStats.totalUsers || 
                    stats.totalConnections !== previousStats.totalConnections;
  
  if (hasChanged && LOG_CONFIG.showStats) {
    if (stats.totalUsers > 0) {
      logger.info('📊 إحصائيات الاتصالات:', {
        مستخدمين: stats.totalUsers,
        اتصالات: stats.totalConnections
      });
      
      // طباعة تفاصيل المستخدمين فقط إذا كان هناك أكثر من مستخدم واحد
      if (stats.userDetails.length > 1) {
        logger.info('👥 تفاصيل المستخدمين:');
        stats.userDetails.forEach(user => {
          const icon = user.connectionsCount > 1 ? '📱' : '💻';
          logger.debug(`  ${icon} المستخدم ${user.userId}: ${user.connectionsCount} اتصال`);
        });
      }
    } else {
      logger.info('😴 لا يوجد مستخدمين متصلين حالياً');
    }
    
    // تحديث الإحصائيات السابقة
    previousStats = { totalUsers: stats.totalUsers, totalConnections: stats.totalConnections };
  }
}

// دالة لتحديث حالة المستخدم عند الانسحاب
export async function updateUserStatusAfterResign(gameId, resignedUserId) {
  try {
    // البحث عن المباراة
    const game = await Game.findByPk(gameId);
    if (!game) {
      logger.error('المباراة غير موجودة:', gameId);
      return;
    }
    
    // التحقق من حالة اللاعبين قبل التحديث
    const [resignedUser, otherUser] = await Promise.all([
      User.findByPk(resignedUserId),
      User.findByPk(game.whiteUserId === resignedUserId ? game.blackUserId : game.whiteUserId)
    ]);
    
    if (!resignedUser || !otherUser) {
      logger.error('أحد اللاعبين غير موجود:', { resignedUserId, otherUserId: game.whiteUserId === resignedUserId ? game.blackUserId : game.whiteUserId });
      return;
    }
    
    const otherUserId = game.whiteUserId === resignedUserId ? game.blackUserId : game.whiteUserId;
    const updatePromises = [];
    
    // تحديث حالة اللاعب المنسحب إلى online
    if (resignedUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب المنسحب
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { whiteUserId: resignedUserId },
            { blackUserId: resignedUserId }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(resignedUserId, 'online'));
      }
    }
    
    // تحديث حالة اللاعب الآخر إلى online أيضاً
    if (otherUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب الآخر
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { whiteUserId: otherUserId },
            { blackUserId: otherUserId }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(otherUserId, 'online'));
      }
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      logger.info(`🔄 تم تحديث حالة اللاعبين بعد الانسحاب من المباراة ${gameId}`);
    } else {
      logger.debug(`ℹ️ لا حاجة لتحديث حالة اللاعبين بعد الانسحاب من المباراة ${gameId} - لديهم مباريات أخرى نشطة`);
    }
  } catch (error) {
    logger.error('خطأ في تحديث حالة المستخدمين بعد الانسحاب:', error);
  }
}

// دالة لتحديث حالة المستخدم عند انتهاء المباراة
export async function updateUserStatusAfterGameEnd(gameId) {
  try {
    // البحث عن المباراة
    const game = await Game.findByPk(gameId);
    if (!game) {
      logger.error('المباراة غير موجودة:', gameId);
      return;
    }
    
    // التحقق من حالة اللاعبين قبل التحديث
    const [whiteUser, blackUser] = await Promise.all([
      User.findByPk(game.whiteUserId),
      User.findByPk(game.blackUserId)
    ]);
    
    if (!whiteUser || !blackUser) {
      logger.error('أحد اللاعبين غير موجود:', { whiteUserId: game.whiteUserId, blackUserId: game.blackUserId });
      return;
    }
    
    // تحديث حالة اللاعبين إلى online فقط إذا لم يكونوا في مباراة أخرى
    const updatePromises = [];
    
    if (whiteUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب الأبيض
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { whiteUserId: game.whiteUserId },
            { blackUserId: game.whiteUserId }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(game.whiteUserId, 'online'));
      }
    }
    
    if (blackUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب الأسود
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { whiteUserId: game.blackUserId },
            { blackUserId: game.blackUserId }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(game.blackUserId, 'online'));
      }
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      logger.info(`🔄 تم تحديث حالة اللاعبين بعد انتهاء المباراة ${gameId}`);
    } else {
      logger.debug(`ℹ️ لا حاجة لتحديث حالة اللاعبين بعد انتهاء المباراة ${gameId} - لديهم مباريات أخرى نشطة`);
    }
  } catch (error) {
    logger.error('خطأ في تحديث حالة المستخدمين بعد انتهاء المباراة:', error);
  }
}

// دالة لتنظيف حالات المستخدمين المتروكة
export async function cleanupOrphanedUserStates() {
  try {
    logger.info('🔍 بدء تنظيف حالات المستخدمين المتروكة...');
    
    // البحث عن المستخدمين الذين حالتهم in-game
    const inGameUsers = await User.findAll({
      where: { state: 'in-game' }
    });
    
    let cleanedCount = 0;
    
    for (const user of inGameUsers) {
      // البحث عن مباراة نشطة للمستخدم
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { whiteUserId: user.user_id },
            { blackUserId: user.user_id }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          }
        }
      });
      
      // إذا لم توجد مباراة نشطة، تحديث الحالة إلى online
      if (!activeGame) {
        await User.update(
          { state: 'online' },
          { where: { user_id: user.user_id } }
        );
        logger.info(`🧹 تم تنظيف حالة المستخدم ${user.user_id} من in-game إلى online`);
        cleanedCount++;
      }
    }
    
    logger.info(`✅ تم تنظيف ${cleanedCount} حالة مستخدم متروكة`);
    return cleanedCount;
  } catch (error) {
    logger.error('خطأ في تنظيف حالات المستخدمين المتروكة:', error);
    return 0;
  }
}

// دالة لتنظيف حالات المستخدمين الذين لديهم حالة online ولكنهم غير متصلين
export async function cleanupOrphanedOnlineStates() {
  try {
    logger.info('🔍 بدء تنظيف حالات المستخدمين المتصلين المتروكة...');
    
    // البحث عن المستخدمين الذين حالتهم online
    const onlineUsers = await User.findAll({
      where: { state: 'online' }
    });
    
    let cleanedCount = 0;
    
    for (const user of onlineUsers) {
      // التحقق من وجود اتصال socket فعلي
      if (!isUserOnline(user.user_id)) {
        await User.update(
          { state: 'offline' },
          { where: { user_id: user.user_id } }
        );
        logger.info(`🧹 تم تنظيف حالة المستخدم ${user.user_id} من online إلى offline`);
        cleanedCount++;
      }
    }
    
    logger.info(`✅ تم تنظيف ${cleanedCount} حالة مستخدم متصل متروكة`);
    return cleanedCount;
  } catch (error) {
    logger.error('خطأ في تنظيف حالات المستخدمين المتصلين المتروكة:', error);
    return 0;
  }
}

// دالة لإعداد ping/pong للتحقق من الاتصال
export function setupPingPong(socket, userId) {
  // إرسال ping كل 30 ثانية
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  // الاستماع للـ pong
  socket.on('pong', () => {
    // الاتصال نشط - لا حاجة لطباعة أي شيء
  });

  // تنظيف عند الانفصال
  socket.on('disconnect', () => {
    clearInterval(pingInterval);
  });

  return pingInterval;
}

// Export shared data
export { activeUsers, activeGames, gameTimers }; 