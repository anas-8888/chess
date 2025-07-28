import { Server } from 'socket.io';
import User from '../models/User.js';
import Game from '../models/Game.js';
import Invite from '../models/Invite.js';
import { Op } from 'sequelize';
import {
  authenticateSocket,
  createGameWithMethods,
  handleGameInvite,
  handleInviteResponse,
  addUserConnection,
  removeUserConnection,
  isUserOnline,
  enableMinimalLogging,
  sendFriendsStatusToUser,
  setupPingPong,
  handleGameMove,
  startClock,
  gameTimers,
  checkTimerHealth
} from './socketHelpers.js';
import logger from '../utils/logger.js';

// متغير لتتبع الاتصالات النشطة
const activeConnections = new Map();

// دالة موحدة لتحديث حالة المستخدم
async function updateUserStatus(userId, status) {
  try {
    const user = await User.findByPk(userId);
    if (user && user.state !== status) {
      await user.update({ state: status });
      logger.debug(`تم تحديث حالة المستخدم ${userId} إلى ${status}`);
      return true;
    } else if (user && user.state === status) {
      logger.debug(`المستخدم ${userId} في الحالة ${status} بالفعل`);
      return false;
    } else {
      logger.error(`المستخدم ${userId} غير موجود`);
      return false;
    }
  } catch (error) {
    logger.error('خطأ في تحديث حالة المستخدم', error);
    return false;
  }
}

// دالة موحدة لتنظيف الدعوات المنتهية
async function cleanupExpiredInvites(nsp) {
  try {
    const expiredInvites = await Invite.findAll({
      where: {
        status: 'pending',
        date_time: {
          [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 ساعة
        }
      }
    });

    if (expiredInvites.length > 0) {
      await Invite.update(
        { status: 'expired' },
        {
          where: {
            id: {
              [Op.in]: expiredInvites.map(invite => invite.id)
            }
          }
        }
      );
      logger.info(`تم تنظيف ${expiredInvites.length} دعوة منتهية`);
    }
  } catch (error) {
    logger.error('خطأ في تنظيف الدعوات المنتهية', error);
  }
}

// دالة لتسجيل إحصائيات الاتصالات
function logConnectionStats() {
  const totalConnections = activeConnections.size;
  logger.info(`إحصائيات الاتصالات: ${totalConnections} اتصال نشط`);
}

export function initFriendSocket(io) {
  const nsp = io.of('/friends');

  // تفعيل التسجيل البسيط لتقليل التكرار
  enableMinimalLogging();

  // Cleanup expired invites every 5 minutes
  setInterval(() => {
    cleanupExpiredInvites(nsp).catch(error => {
      logger.error('خطأ في تنظيف الدعوات المنتهية:', error);
    });
  }, 5 * 60 * 1000); // 5 minutes

  // مراقبة الاتصالات كل 5 دقائق بدلاً من كل دقيقة لتقليل التكرار
  setInterval(() => {
    logConnectionStats();
  }, 5 * 60 * 1000); // 5 minutes

  // Health check للمؤقتات كل 30 ثانية
  setInterval(() => {
    checkTimerHealth().catch(error => {
      logger.error('خطأ في health check للمؤقتات:', error);
    });
  }, 30 * 1000); // 30 seconds

  nsp.on('connection', async socket => {
    let userId = null;

    // Authenticate user
    try {
      userId = authenticateSocket(socket);
    } catch (error) {
      logger.error('خطأ في المصادقة:', error.message);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    // إضافة الاتصال الجديد للمستخدم
    addUserConnection(userId, socket.id);
    activeConnections.set(socket.id, userId);

    // Check for active games when user connects
    (async () => {
      try {
        const activeGame = await Game.findOne({
          where: {
            [Op.or]: [
              { whiteUserId: userId },
              { blackUserId: userId }
            ],
            status: 'active'
          },
          order: [['dateTime', 'DESC']]
        });

        if (activeGame) {
          logger.debug(`تم العثور على مباراة جارية للمستخدم ${userId}: ${activeGame.id}`);
          socket.emit('rejoin_game', {
            gameId: activeGame.id,
            whiteUserId: activeGame.whiteUserId,
            blackUserId: activeGame.blackUserId,
            whitePlayMethod: activeGame.whitePlayMethod,
            blackPlayMethod: activeGame.blackPlayMethod,
            mode: activeGame.mode
          });
        }
      } catch (error) {
        logger.error('Error checking active games:', error);
      }
    })();

    // Join user's personal room
    socket.join(`user::${userId}`);

    // إعداد ping/pong للتحقق من الاتصال
    setupPingPong(socket, userId);

    // تحديث حالة المستخدم إلى online
    await updateUserStatus(userId, 'online');
    
    // إرسال حالة الأصدقاء للمستخدم الجديد
    sendFriendsStatusToUser(socket, userId).catch(error => {
      logger.error('خطأ في إرسال حالة الأصدقاء:', error);
    });

    // Game invite events
    socket.on('sendGameInvite', async (data) => {
      await handleGameInvite(socket, nsp, userId, data);
    });

    // Handle invite responses
    socket.on('respondToGameInvite', async (data) => {
      await handleInviteResponse(socket, nsp, userId, data);
    });

    // Handle game start with method
    socket.on('startGameWithMethod', async ({ inviteId, method }) => {
      try {
        logger.info('بدء اللعبة بطريقة:', { inviteId, method, userId });
        
        if (!inviteId || !method) {
          return socket.emit('error', { message: 'بيانات بدء اللعبة غير مكتملة' });
        }
        
        const invite = await Invite.findByPk(inviteId);
        if (!invite) {
          return socket.emit('error', { message: 'Invite not found' });
        }

        if (invite.from_user_id !== userId && invite.to_user_id !== userId) {
          return socket.emit('error', { message: 'Not authorized to start this game' });
        }

        if (invite.status !== 'accepted') {
          return socket.emit('error', { message: 'Invite must be accepted before starting game' });
        }

        // التحقق من صحة طريقة اللعب حسب نموذج Game
        if (!['physical_board', 'phone'].includes(method)) {
          return socket.emit('error', { message: 'Invalid play method' });
        }

        // تحديث طريقة اللعب للطرف الثاني
        await invite.update({ 
          play_method: method,
          status: 'game_ready'
        });

        // إنشاء المباراة مع طريقتي اللعب
        const game = await createGameWithMethods(invite);
        
        logger.info(`Game created with ID: ${game.id}, starting clock...`);
        
        // بدء العدادات للمباراة
        logger.info(`=== START GAME WITH METHOD: Starting clock for game ${game.id} ===`);
        await startClock(nsp, game.id);
        logger.info(`=== START GAME WITH METHOD: Clock started for game ${game.id} ===`);
        
        // تحديث الدعوة برقم المباراة
        await invite.update({ 
          game_id: game.id,
          status: 'game_started'
        });

        // تحديث حالة اللاعبين إلى 'in-game'
        await Promise.all([
            updateUserStatus(invite.from_user_id, 'in-game'),
            updateUserStatus(invite.to_user_id, 'in-game')
        ]);

        // إرسال تحديث الحالة للأصدقاء
        const friendStatusData = {
            game_id: game.game_id,
            white_user_id: game.white_user_id,
            black_user_id: game.black_user_id,
            status: 'in-game'
        };

        // إرسال إشعار للأصدقاء
        socket.emit('friend_status_update', {
            status: 'in-game'
        });

        // إرسال حدث بدء المباراة للطرفين
        const gameData = {
          inviteId: invite.id,
          gameId: game.id,
          whiteUserId: game.whiteUserId,
          blackUserId: game.blackUserId,
          whitePlayMethod: game.whitePlayMethod,
          blackPlayMethod: game.blackPlayMethod,
          gameType: invite.game_type,
          gameTime: game.gameTime
        };

        nsp.to(`user::${invite.from_user_id}`).emit('gameStarted', gameData);
        nsp.to(`user::${invite.to_user_id}`).emit('gameStarted', gameData);

      } catch (error) {
        logger.error('خطأ في بدء اللعبة:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Join user room for receiving invites
    socket.on('joinUserRoom', () => {
      socket.join(`user::${userId}`);
      logger.debug('انضم المستخدم للغرفة الشخصية:', userId);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      logger.debug(`User ${userId} disconnected from friend socket`);
      
      // إزالة الاتصال من قائمة المستخدم
      removeUserConnection(userId, socket.id);
      
      // التحقق من حالة المستخدم قبل التحديث
      try {
        const user = await User.findByPk(userId);
        if (!user) {
          logger.error('المستخدم غير موجود عند قطع الاتصال:', userId);
          return;
        }
        
        // تحديث الحالة إلى offline فقط إذا لم يتبق أي اتصالات
        if (!isUserOnline(userId)) {
          // لا تحديث الحالة إذا كان المستخدم في مباراة
          if (user.state !== 'in-game') {
            logger.debug(`المستخدم ${userId} لم يتبق له اتصالات، تحديث الحالة إلى offline`);
            await updateUserStatus(userId, 'offline');
          } else {
            logger.debug(`المستخدم ${userId} في مباراة، الحفاظ على الحالة كـ in-game`);
          }
        } else {
          logger.debug(`المستخدم ${userId} لا يزال متصل من أماكن أخرى، عدم تحديث الحالة`);
        }
      } catch (error) {
        logger.error('خطأ في تحديث حالة المستخدم عند قطع الاتصال:', error);
      }
    });
    
    // Handle player connection to game room
    socket.on('joinGameRoom', async ({ gameId }) => {
      try {
        logger.info('=== FRIEND SOCKET: Received joinGameRoom request ===');
        logger.info('انضمام لاعب لغرفة المباراة:', { userId, gameId });
        
        // التحقق من أن socket.join يتم تنفيذه بنجاح
        logger.info(`Attempting to join room game::${gameId} for user ${userId}`);
        socket.join(`game::${gameId}`);
        logger.info(`Successfully joined room game::${gameId} for user ${userId}`);
        
        // التحقق من الغرف التي ينتمي إليها العميل
        logger.info(`User ${userId} is now in rooms:`, Array.from(socket.rooms));
        
        // Check if game exists and is active
        const game = await Game.findByPk(gameId);
        logger.info(`Game ${gameId} status: ${game?.status}, active timers:`, Object.keys(gameTimers));
        logger.info(`gameTimers[${gameId}] exists:`, !!gameTimers[gameId]);
        
        if (game && game.status === 'active') {
          // Start clock if not already running
          if (!gameTimers[gameId]) {
            logger.info(`=== JOIN GAME ROOM: Starting clock for game ${gameId} ===`);
            await startClock(nsp, gameId);
            logger.info(`=== JOIN GAME ROOM: Clock started for game ${gameId} ===`);
          } else {
            logger.info(`Clock already running for game ${gameId}, not starting again`);
          }
          
          // إرسال تحديث المؤقت بعد تأخير للتأكد من جاهزية الفرونت إند
          setTimeout(() => {
            logger.info(`=== FRIEND SOCKET: Sending delayed clock update ===`);
            logger.info(`Sending delayed clock update to player ${userId} for game ${gameId}`);
            const clockData = {
              whiteTimeLeft: game.white_time_left,
              blackTimeLeft: game.black_time_left,
              currentTurn: game.current_turn
            };
            logger.info(`Clock data being sent:`, clockData);
            socket.emit('clockUpdate', clockData);
            logger.info(`=== FRIEND SOCKET: Delayed clock update sent ===`);
          }, 2000); // تأخير ثانيتين للتأكد من جاهزية الفرونت إند
        } else if (!game) {
          logger.error(`Game ${gameId} not found when player joined`);
        } else if (game.status !== 'active') {
          logger.info(`Game ${gameId} is not active (status: ${game.status})`);
        }
        
        socket.to(`game::${gameId}`).emit('playerConnected', { 
          userId, 
          gameId,
          timestamp: new Date()
        });
        
        logger.info('=== FRIEND SOCKET: joinGameRoom completed successfully ===');
        
      } catch (error) {
        logger.error('خطأ في الانضمام لغرفة المباراة:', error);
      }
    });
    
    // Handle player disconnection from game room
    socket.on('leaveGameRoom', async ({ gameId }) => {
      try {
        logger.debug('مغادرة لاعب لغرفة المباراة:', { userId, gameId });
        
        socket.leave(`game::${gameId}`);
        
        socket.to(`game::${gameId}`).emit('playerDisconnected', { 
          userId, 
          gameId,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('خطأ في مغادرة غرفة المباراة:', error);
      }
    });

    // Handle game moves
    socket.on('move', async (moveData) => {
      try {
        logger.info('=== FRIEND SOCKET: Received move request ===');
        logger.info('حركة جديدة:', { userId, gameId: moveData.gameId, move: moveData.san });
        
        // Validate move data
        if (!moveData.gameId || !moveData.san || !moveData.fen) {
          logger.error('بيانات الحركة غير مكتملة:', moveData);
          return socket.emit('error', { message: 'بيانات الحركة غير مكتملة' });
        }

        // Add movedBy to moveData
        moveData.movedBy = userId;

        logger.info(`Processing move for game ${moveData.gameId} by user ${userId}`);
        
        // Handle the move
        logger.info(`=== FRIEND SOCKET: Processing move for game ${moveData.gameId} ===`);
        await handleGameMove(nsp, moveData.gameId, moveData);
        logger.info(`=== FRIEND SOCKET: Move processed successfully for game ${moveData.gameId} ===`);
        
        logger.info(`Move processed successfully for game ${moveData.gameId}`);
        
      } catch (error) {
        logger.error('خطأ في معالجة الحركة:', error);
        socket.emit('error', { message: 'خطأ في معالجة الحركة' });
      }
    });
  });
} 