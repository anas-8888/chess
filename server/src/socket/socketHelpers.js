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

// متغير لتخزين بيانات المؤقت في الذاكرة
const gameTimerData = new Map(); // { gameId: { whiteTimeLeft, blackTimeLeft, currentTurn, game } }

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
    
    // إنشاء المباراة مع الحقول الصحيحة حسب نموذج Game الجديد
    const game = await Game.create({
      white_player_id: whiteUserId,
      black_player_id: blackUserId,
      started_by_user_id: invite.from_user_id,
      game_type: invite.game_type,
      initial_time: 600, // 10 minutes in seconds
      white_time_left: 600,
      black_time_left: 600,
      white_play_method: invite.play_method,
      black_play_method: invite.play_method,
      current_fen: 'startpos',
      status: 'active',
      current_turn: 'white'
    });
    
    logger.info('تم إنشاء مباراة جديدة:', {
      gameId: game.id,
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      playMethod: invite.play_method,
      gameType: invite.game_type,
      initialTime: game.initial_time,
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn
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
    
    // إنشاء المباراة مع الحقول الصحيحة حسب نموذج Game الجديد
    const game = await Game.create({
      white_player_id: whiteUserId,
      black_player_id: blackUserId,
      started_by_user_id: invite.from_user_id,
      game_type: invite.game_type,
      initial_time: 600, // 10 minutes in seconds
      white_time_left: 600,
      black_time_left: 600,
      white_play_method: whitePlayMethod,
      black_play_method: blackPlayMethod,
      current_fen: 'startpos',
      status: 'active',
      current_turn: 'white'
    });
    
    logger.info('تم إنشاء مباراة جديدة مع طريقتي اللعب:', {
      gameId: game.id,
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: whitePlayMethod,
      blackPlayMethod: blackPlayMethod,
      gameType: invite.game_type,
      initialTime: game.initial_time,
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn
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
      
      // Create the game
      const game = await createGame(invite);
      
      logger.info(`Game created with ID: ${game.id}, starting clock...`);
      
      // Start the clock for the game
      logger.info(`=== HANDLE INVITE RESPONSE: Starting clock for game ${game.id} ===`);
      await startClock(nsp, game.id);
      logger.info(`=== HANDLE INVITE RESPONSE: Clock started for game ${game.id} ===`);
      
      // إرسال إشعار للطرفين بقبول الدعوة مع معرف اللعبة
      nsp.to(`user::${invite.from_user_id}`).emit('gameInviteAccepted', {
        inviteId: invite.id,
        gameId: game.id,
        fromUserId: invite.from_user_id,
        toUserId: invite.to_user_id,
        playMethod: invite.play_method,
        gameType: invite.game_type
      });
      
      nsp.to(`user::${invite.to_user_id}`).emit('gameInviteAccepted', {
        inviteId: invite.id,
        gameId: game.id,
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
export async function startClock(nsp, gameId) {
  try {
    logger.info(`=== STARTCLOCK CALLED for game ${gameId} ===`);
    logger.info(`startClock called for game ${gameId} - checking if already running`);
    
    // التحقق من وجود مؤقت نشط بالفعل
    if (gameTimers[gameId]) {
      logger.info(`Clock already running for game ${gameId}, not starting again`);
      return;
    }

    // قراءة بيانات اللعبة من قاعدة البيانات مرة واحدة فقط
    const game = await Game.findByPk(gameId);
    if (!game) {
      logger.error(`Game ${gameId} not found when starting clock`);
      return;
    }

    logger.info(`Game ${gameId} found - status: ${game.status}, white_time_left: ${game.white_time_left}, black_time_left: ${game.black_time_left}, current_turn: ${game.current_turn}`);

    // تخزين بيانات المؤقت في الذاكرة
    gameTimerData.set(gameId, {
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn,
      game: game
    });

    logger.info(`Timer data stored in memory for game ${gameId}:`, {
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn
    });

    logger.info(`Setting up setInterval for game ${gameId} - will run every 1000ms`);
    
    // إرسال تحديث فوري للمؤقت
    logger.info(`=== EMITTING IMMEDIATE CLOCK UPDATE for game ${gameId} ===`);
    nsp.to(`game::${gameId}`).emit('clockUpdate', {
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn
    });
    logger.info(`=== IMMEDIATE CLOCK UPDATE EMITTED for game ${gameId} ===`);

    // إنشاء المؤقت
    const timer = setInterval(async () => {
      try {
        logger.info(`=== CLOCK TICK STARTED for game ${gameId} ===`);
        logger.info(`Timer ID: ${timer}, Interval running for game ${gameId}`);
        
        // الحصول على بيانات المؤقت من الذاكرة
        const timerData = gameTimerData.get(gameId);
        if (!timerData) {
          logger.error(`Timer data not found for game ${gameId}, stopping clock`);
          clearInterval(timer);
          delete gameTimers[gameId];
          return;
        }

        const { whiteTimeLeft, blackTimeLeft, currentTurn } = timerData;
        
        logger.info(`Clock tick for game ${gameId} - current turn: ${currentTurn}`);
        logger.info(`Game ${gameId} current state:`, { whiteTimeLeft, blackTimeLeft, currentTurn });
        logger.info(`Room name: game::${gameId}`);
        logger.info(`Active timers:`, Object.keys(gameTimers));
        logger.info(`Timer data keys:`, Array.from(gameTimerData.keys()));
        
        // تخفيض وقت اللاعب الحالي
        let newWhiteTime = whiteTimeLeft;
        let newBlackTime = blackTimeLeft;
        let newCurrentTurn = currentTurn;
        
        if (currentTurn === 'white') {
          newWhiteTime = Math.max(0, whiteTimeLeft - 1);
          logger.info(`Decreased white time from ${whiteTimeLeft} to ${newWhiteTime}`);
          
          // التحقق من انتهاء الوقت
          if (newWhiteTime === 0) {
            logger.info(`White player ran out of time in game ${gameId}`);
            await handleGameTimeout(nsp, gameId, 'white');
            return;
          }
        } else if (currentTurn === 'black') {
          newBlackTime = Math.max(0, blackTimeLeft - 1);
          logger.info(`Decreased black time from ${blackTimeLeft} to ${newBlackTime}`);
          
          // التحقق من انتهاء الوقت
          if (newBlackTime === 0) {
            logger.info(`Black player ran out of time in game ${gameId}`);
            await handleGameTimeout(nsp, gameId, 'black');
            return;
          }
        }
        
        // تحديث البيانات في الذاكرة
        gameTimerData.set(gameId, {
          ...timerData,
          whiteTimeLeft: newWhiteTime,
          blackTimeLeft: newBlackTime
        });
        
        logger.info(`Updated timer data in memory for game ${gameId}:`, {
          whiteTimeLeft: newWhiteTime,
          blackTimeLeft: newBlackTime,
          currentTurn: currentTurn
        });
        
        // تحديث قاعدة البيانات مع retry mechanism
        let dbUpdateSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!dbUpdateSuccess && retryCount < maxRetries) {
          try {
            const { updateGameTimeService } = await import('../services/gameService.js');
            const updateResult = await updateGameTimeService(gameId, {
              whiteTimeLeft: newWhiteTime,
              blackTimeLeft: newBlackTime,
              currentTurn: currentTurn
            });
            
            if (updateResult.success) {
              logger.info(`Database updated successfully for game ${gameId}:`, {
                whiteTimeLeft: newWhiteTime,
                blackTimeLeft: newBlackTime,
                currentTurn: currentTurn
              });
              dbUpdateSuccess = true;
            } else {
              logger.error(`Failed to update database for game ${gameId}:`, updateResult.message);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // انتظار ثانية قبل المحاولة مرة أخرى
              }
            }
          } catch (dbError) {
            logger.error(`Error updating database for game ${gameId} (attempt ${retryCount + 1}):`, dbError);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // انتظار ثانية قبل المحاولة مرة أخرى
            }
          }
        }
        
        // إرسال التحديث للعملاء حتى لو فشل تحديث قاعدة البيانات
        logger.info(`=== EMITTING CLOCK UPDATE for game ${gameId} ===`);
        logger.info(`Emitting to room: game::${gameId}`);
        logger.info(`Data being emitted:`, {
          whiteTimeLeft: newWhiteTime,
          blackTimeLeft: newBlackTime,
          currentTurn: currentTurn
        });
        
        nsp.to(`game::${gameId}`).emit('clockUpdate', {
          whiteTimeLeft: newWhiteTime,
          blackTimeLeft: newBlackTime,
          currentTurn: currentTurn
        });
        
        // Also emit to individual players to ensure delivery
        const game = await Game.findByPk(gameId);
        if (game && game.white_player_id) {
          logger.info(`=== EMITTING CLOCK UPDATE to white player ${game.white_player_id} ===`);
          nsp.to(`user::${game.white_player_id}`).emit('clockUpdate', {
            whiteTimeLeft: newWhiteTime,
            blackTimeLeft: newBlackTime,
            currentTurn: currentTurn
          });
        }
        if (game && game.black_player_id) {
          logger.info(`=== EMITTING CLOCK UPDATE to black player ${game.black_player_id} ===`);
          nsp.to(`user::${game.black_player_id}`).emit('clockUpdate', {
            whiteTimeLeft: newWhiteTime,
            blackTimeLeft: newBlackTime,
            currentTurn: currentTurn
          });
        }
        
        logger.info(`=== CLOCK UPDATE EMITTED for game ${gameId} ===`);
        logger.info(`=== CLOCK TICK COMPLETED for game ${gameId} ===`);
        
      } catch (error) {
        logger.error(`Error in clock tick for game ${gameId}:`, error);
        logger.info(`=== CLOCK TICK FAILED for game ${gameId} ===`);
        
        // إعادة تشغيل المؤقت في حالة الخطأ
        logger.info(`Restarting clock for game ${gameId} due to error`);
        clearInterval(timer);
        delete gameTimers[gameId];
        setTimeout(() => {
          startClock(nsp, gameId).catch(err => {
            logger.error(`Failed to restart clock for game ${gameId}:`, err);
          });
        }, 5000); // انتظار 5 ثوان قبل إعادة التشغيل
      }
    }, 1000);
    
    // حفظ المؤقت
    gameTimers[gameId] = timer;
    logger.info(`Clock started for game ${gameId} - timer ID: ${timer}`);
    
  } catch (error) {
    logger.error(`Error starting clock for game ${gameId}:`, error);
  }
}

export async function stopClock(gameId) {
  try {
    logger.info(`stopClock called for game ${gameId} - checking if timer exists`);
    
    if (gameTimers[gameId]) {
      clearInterval(gameTimers[gameId]);
      delete gameTimers[gameId];
      logger.info(`Clock stopped for game ${gameId}`);
    } else {
      logger.info(`No active timer found for game ${gameId}`);
    }
    
    // إزالة بيانات المؤقت من الذاكرة
    gameTimerData.delete(gameId);
    
  } catch (error) {
    logger.error(`Error stopping clock for game ${gameId}:`, error);
  }
}

export async function handleGameTimeout(nsp, gameId, timeoutPlayer) {
  try {
    logger.info(`=== HANDLE GAME TIMEOUT: Handling timeout for game ${gameId} ===`);
    
    // الحصول على بيانات اللعبة
    const game = await Game.findByPk(gameId);
    if (!game) {
      logger.error(`Game ${gameId} not found when handling timeout`);
      return;
    }
    
    // تحديد الفائز
    const winner = timeoutPlayer === 'white' ? 'black' : 'white';
    
    // تحديث حالة اللعبة
    await game.update({
      status: 'completed',
      winner: winner,
      end_reason: 'timeout'
    });
    
    // تحديث قاعدة البيانات بالوقت النهائي
    try {
      const { updateGameTimeService } = await import('../services/gameService.js');
      const timerData = gameTimerData.get(gameId);
      if (timerData) {
        const updateResult = await updateGameTimeService(gameId, {
          whiteTimeLeft: timerData.whiteTimeLeft,
          blackTimeLeft: timerData.blackTimeLeft,
          currentTurn: timerData.currentTurn
        });
        
        if (updateResult.success) {
          logger.info(`Final time state saved to database for game ${gameId}:`, {
            whiteTimeLeft: timerData.whiteTimeLeft,
            blackTimeLeft: timerData.blackTimeLeft,
            currentTurn: timerData.currentTurn
          });
        } else {
          logger.error(`Failed to save final time state to database for game ${gameId}:`, updateResult.message);
        }
      }
    } catch (dbError) {
      logger.error(`Error saving final time state to database for game ${gameId}:`, dbError);
    }
    
    // إيقاف المؤقت
    await stopClock(gameId);
    
    // إرسال حدث انتهاء اللعبة
    nsp.to(`game::${gameId}`).emit('gameTimeout', {
      gameId: gameId,
      timeoutPlayer: timeoutPlayer,
      winner: winner
    });
    
    // تحديث حالة اللاعبين
    const whiteUser = await User.findByPk(game.white_player_id);
    const blackUser = await User.findByPk(game.black_player_id);
    
    if (whiteUser) await whiteUser.update({ state: 'online' });
    if (blackUser) await blackUser.update({ state: 'online' });
    
    logger.info(`Game ${gameId} ended due to timeout - ${timeoutPlayer} player lost`);
    
  } catch (error) {
    logger.error(`Error handling game timeout for game ${gameId}:`, error);
  }
}

// Update current turn when a move is made
export async function updateGameTurn(nsp, gameId, newTurn) {
  try {
    // تحديث الدور في قاعدة البيانات
    const game = await Game.findByPk(gameId);
    if (game) {
      await game.update({ current_turn: newTurn });
    }
    
    // تحديث البيانات في الذاكرة
    const timerData = gameTimerData.get(gameId);
    if (timerData) {
      gameTimerData.set(gameId, {
        ...timerData,
        currentTurn: newTurn
      });
    }
    
    // تحديث قاعدة البيانات عبر updateGameTimeService أيضاً
    try {
      const { updateGameTimeService } = await import('../services/gameService.js');
      const updateResult = await updateGameTimeService(gameId, {
        whiteTimeLeft: timerData?.whiteTimeLeft || 0,
        blackTimeLeft: timerData?.blackTimeLeft || 0,
        currentTurn: newTurn
      });
      
      if (updateResult.success) {
        logger.info(`Database updated successfully for turn change in game ${gameId}:`, {
          currentTurn: newTurn
        });
      } else {
        logger.error(`Failed to update database for turn change in game ${gameId}:`, updateResult.message);
      }
    } catch (dbError) {
      logger.error(`Error updating database for turn change in game ${gameId}:`, dbError);
    }
    
    // إرسال حدث تغيير الدور
    nsp.to(`game::${gameId}`).emit('turnUpdate', {
      gameId: gameId,
      currentTurn: newTurn
    });
    
    logger.info(`Turn updated for game ${gameId} to ${newTurn}`);
    
  } catch (error) {
    logger.error(`Error updating game turn for game ${gameId}:`, error);
  }
}

// Handle game move and update turn
export async function handleGameMove(nsp, gameId, moveData) {
  try {
    logger.info(`Processing move for game ${gameId}:`, moveData);
    
    // الحصول على بيانات اللعبة
    const game = await Game.findByPk(gameId);
    if (!game) {
      logger.error(`Game ${gameId} not found when processing move`);
      return;
    }
    
    // تحديث FEN والدور في قاعدة البيانات
    const newTurn = moveData.currentTurn || (game.current_turn === 'white' ? 'black' : 'white');
    await game.update({
      current_fen: moveData.fen,
      current_turn: newTurn
    });
    
    // تحديث البيانات في الذاكرة
    const timerData = gameTimerData.get(gameId);
    if (timerData) {
      gameTimerData.set(gameId, {
        ...timerData,
        currentTurn: newTurn
      });
    }
    
    // Get room members before emitting
    const roomMembers = nsp.adapter.rooms.get(`game::${gameId}`);
    const memberCount = roomMembers ? roomMembers.size : 0;
    logger.info(`=== HANDLE GAME MOVE: Room members before emit: ${memberCount}`);
    logger.info(`=== HANDLE GAME MOVE: Room members details:`, roomMembers ? Array.from(roomMembers) : []);
    logger.info(`=== HANDLE GAME MOVE: All available rooms:`, Array.from(nsp.adapter.rooms.keys()));
    
    // إرسال حدث الحركة
    logger.info(`=== HANDLE GAME MOVE: Emitting moveMade for game ${gameId} ===`);
    const moveMadeData = {
      gameId: gameId,
      move: moveData.san,
      fen: moveData.fen,
      movedBy: moveData.movedBy,
      currentTurn: newTurn,
      timestamp: Date.now()
    };
    logger.info(`=== HANDLE GAME MOVE: moveMade data:`, moveMadeData);
    
    // Always emit moveMade, even if room seems empty (players might be joining)
    logger.info(`=== HANDLE GAME MOVE: Emitting moveMade to room game::${gameId} ===`);
    nsp.to(`game::${gameId}`).emit('moveMade', moveMadeData);
    logger.info(`=== HANDLE GAME MOVE: moveMade emitted for game ${gameId} ===`);
    
    // Also emit to individual players to ensure delivery
    if (game.white_player_id) {
      logger.info(`=== HANDLE GAME MOVE: Emitting moveMade to white player ${game.white_player_id} ===`);
      nsp.to(`user::${game.white_player_id}`).emit('moveMade', moveMadeData);
      logger.info(`=== HANDLE GAME MOVE: moveMade sent to white player ${game.white_player_id} ===`);
    }
    if (game.black_player_id) {
      logger.info(`=== HANDLE GAME MOVE: Emitting moveMade to black player ${game.black_player_id} ===`);
      nsp.to(`user::${game.black_player_id}`).emit('moveMade', moveMadeData);
      logger.info(`=== HANDLE GAME MOVE: moveMade sent to black player ${game.black_player_id} ===`);
    }
    
    // إرسال حدث تغيير الدور
    logger.info(`=== HANDLE GAME MOVE: Emitting turnUpdate for game ${gameId} ===`);
    const turnUpdateData = {
      gameId: gameId,
      currentTurn: newTurn,
      timestamp: Date.now(),
      lastMove: moveData.san
    };
    logger.info(`=== HANDLE GAME MOVE: turnUpdate data:`, turnUpdateData);
    nsp.to(`game::${gameId}`).emit('turnUpdate', turnUpdateData);
    logger.info(`=== HANDLE GAME MOVE: turnUpdate emitted for game ${gameId} ===`);
    
    // إرسال حدث تأكيد الحركة للاعب الذي قام بالحركة
    logger.info(`=== HANDLE GAME MOVE: Emitting moveConfirmed for game ${gameId} ===`);
    const moveConfirmedData = {
      gameId: gameId,
      move: moveData.san,
      timestamp: Date.now()
    };
    logger.info(`=== HANDLE GAME MOVE: moveConfirmed data:`, moveConfirmedData);
    
    // Send moveConfirmed to the specific user who made the move
    if (moveData.movedBy === 'white' && game.white_player_id) {
      nsp.to(`user::${game.white_player_id}`).emit('moveConfirmed', moveConfirmedData);
      logger.info(`=== HANDLE GAME MOVE: moveConfirmed sent to white player ${game.white_player_id} ===`);
    } else if (moveData.movedBy === 'black' && game.black_player_id) {
      nsp.to(`user::${game.black_player_id}`).emit('moveConfirmed', moveConfirmedData);
      logger.info(`=== HANDLE GAME MOVE: moveConfirmed sent to black player ${game.black_player_id} ===`);
    }
    
    // بدء المؤقت إذا لم يكن يعمل
    logger.info(`Checking if clock is running for game ${gameId} - gameTimers keys:`, Object.keys(gameTimers));
    if (!gameTimers[gameId]) {
      logger.info(`Clock not running for game ${gameId}, starting it`);
      await startClock(nsp, gameId);
    }
    
    logger.info(`Move processed successfully for game ${gameId}`);
    
  } catch (error) {
    logger.error(`Error processing move for game ${gameId}:`, error);
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
      User.findByPk(game.white_player_id === resignedUserId ? game.black_player_id : game.white_player_id)
    ]);
    
    if (!resignedUser || !otherUser) {
      logger.error('أحد اللاعبين غير موجود:', { resignedUserId, otherUserId: game.white_player_id === resignedUserId ? game.black_player_id : game.white_player_id });
      return;
    }
    
    const otherUserId = game.white_player_id === resignedUserId ? game.black_player_id : game.white_player_id;
    const updatePromises = [];
    
    // تحديث حالة اللاعب المنسحب إلى online
    if (resignedUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب المنسحب
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { white_player_id: resignedUserId },
            { black_player_id: resignedUserId }
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
            { white_player_id: otherUserId },
            { black_player_id: otherUserId }
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
      User.findByPk(game.white_player_id),
      User.findByPk(game.black_player_id)
    ]);
    
    if (!whiteUser || !blackUser) {
      logger.error('أحد اللاعبين غير موجود:', { whiteUserId: game.white_player_id, blackUserId: game.black_player_id });
      return;
    }
    
    // تحديث حالة اللاعبين إلى online فقط إذا لم يكونوا في مباراة أخرى
    const updatePromises = [];
    
    if (whiteUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب الأبيض
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { white_player_id: game.white_player_id },
            { black_player_id: game.white_player_id }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(game.white_player_id, 'online'));
      }
    }
    
    if (blackUser.state === 'in-game') {
      // التحقق من عدم وجود مباراة نشطة أخرى للاعب الأسود
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [
            { white_player_id: game.black_player_id },
            { black_player_id: game.black_player_id }
          ],
          status: {
            [Op.in]: ['in-game', 'in_progress']
          },
          id: { [Op.ne]: gameId }
        }
      });
      
      if (!activeGame) {
        updatePromises.push(updateUserStatus(game.black_player_id, 'online'));
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
            { white_player_id: user.user_id },
            { black_player_id: user.user_id }
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

// Health check for timers
export async function checkTimerHealth() {
  try {
    logger.info('=== TIMER HEALTH CHECK STARTED ===');
    logger.info('Active timers:', Object.keys(gameTimers));
    logger.info('Timer data keys:', Array.from(gameTimerData.keys()));
    
    for (const [gameId, timer] of Object.entries(gameTimers)) {
      const timerData = gameTimerData.get(gameId);
      if (!timerData) {
        logger.error(`Timer data missing for game ${gameId}, cleaning up`);
        clearInterval(timer);
        delete gameTimers[gameId];
        continue;
      }
      
      // التحقق من أن اللعبة لا تزال نشطة
      const game = await Game.findByPk(gameId);
      if (!game || game.status !== 'active') {
        logger.info(`Game ${gameId} is no longer active, stopping timer`);
        clearInterval(timer);
        delete gameTimers[gameId];
        gameTimerData.delete(gameId);
        continue;
      }
      
      logger.info(`Timer for game ${gameId} is healthy`);
    }
    
    logger.info('=== TIMER HEALTH CHECK COMPLETED ===');
  } catch (error) {
    logger.error('Error in timer health check:', error);
  }
}

// Export shared data
export { activeUsers, activeGames, gameTimers };