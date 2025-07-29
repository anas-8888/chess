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
  handleGameMove,
  startClock,
  handleGameEnd
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
      // تم إزالة health check للمؤقتات مؤقتاً
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
              { white_player_id: userId },
              { black_player_id: userId }
            ],
            status: 'active'
          },
          order: [['dateTime', 'DESC']]
        });

        if (activeGame) {
          logger.debug(`تم العثور على مباراة جارية للمستخدم ${userId}: ${activeGame.id}`);
          socket.emit('rejoin_game', {
            gameId: activeGame.id,
            whiteUserId: activeGame.white_player_id,
            blackUserId: activeGame.black_player_id,
            whitePlayMethod: activeGame.white_play_method,
            blackPlayMethod: activeGame.black_play_method,
            mode: activeGame.mode
          });
        }
      } catch (error) {
      }
    })();

    // Join user's personal room
    socket.join(`user::${userId}`);

    // إعداد ping/pong للتحقق من الاتصال
    // setupPingPong(socket, userId); // This line was removed from imports, so it's removed here.

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
          whiteUserId: game.white_player_id,
          blackUserId: game.black_player_id,
          whitePlayMethod: game.white_play_method,
          blackPlayMethod: game.black_play_method,
          gameType: invite.game_type,
          gameTime: game.initial_time
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
        logger.info(`Game ${gameId} status: ${game?.status}`);
        
        if (game && game.status === 'active') {
          // Start clock if not already running
          logger.info(`=== JOIN GAME ROOM: Starting clock for game ${gameId} ===`);
          await startClock(nsp, gameId);
          logger.info(`=== JOIN GAME ROOM: Clock started for game ${gameId} ===`);
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
        
        // Add a final verification after a short delay
        setTimeout(() => {
          const finalRoomMembers = nsp.adapter.rooms.get(`game::${gameId}`);
          const finalIsInRoom = socket.rooms.has(`game::${gameId}`);
          logger.info(`=== FRIEND SOCKET: Final room verification after delay ===`);
          logger.info(`=== FRIEND SOCKET: Socket still in room: ${finalIsInRoom}`);
          logger.info(`=== FRIEND SOCKET: Final room members:`, finalRoomMembers?.size || 0);
          logger.info(`=== FRIEND SOCKET: Final room members details:`, finalRoomMembers ? Array.from(finalRoomMembers) : []);
        }, 1000);
        
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

    // معالجة الحركة
    socket.on('move', async (moveData) => {
      console.log('=== FRIEND SOCKET: Received move ===');
      console.log('Move data:', moveData);
      
      try {
        await handleGameMove(nsp, moveData.gameId, moveData);
      } catch (error) {
        console.error('Error handling move:', error);
      }
    });

    // معالجة الاستسلام
    socket.on('resign', async (data) => {
      console.log('=== FRIEND SOCKET: Received resign ===');
      console.log('Resign data:', data);
      console.log('Socket userId:', socket.userId);
      
      try {
        const { gameId } = data;
        const game = await Game.findByPk(gameId);
        
        if (!game) {
          console.error(`Game ${gameId} not found for resign`);
          return;
        }
        
        console.log('Game found:', {
          gameId: game.id,
          whitePlayerId: game.white_player_id,
          blackPlayerId: game.black_player_id,
          socketUserId: socket.userId
        });
        
        // تحديد اللاعب الذي استسلم
        const resignedPlayer = socket.userId === game.white_player_id ? 'white' : 'black';
        const winner = resignedPlayer === 'white' ? 'black' : 'white';
        
        console.log('Resign analysis:', {
          resignedPlayer,
          winner,
          socketUserId: socket.userId,
          whitePlayerId: game.white_player_id,
          blackPlayerId: game.black_player_id
        });
        
        // معالجة انتهاء اللعبة
        await handleGameEnd(nsp, gameId, 'resign', winner);
        
        console.log('=== FRIEND SOCKET: Resign handled successfully ===');
        
      } catch (error) {
        console.error('Error handling resign:', error);
      }
    });

    // Handle ping for connection testing
    socket.on('ping', (data) => {
      logger.info('=== FRIEND SOCKET: Received ping from client ===');
      logger.info('Ping data:', data);
      
      // If this is a room membership test
      if (data.test === 'room_membership') {
        logger.info('=== FRIEND SOCKET: Room membership test ===');
        logger.info(`Game ID from ping: ${data.gameId}`);
        logger.info(`Socket ID: ${socket.id}`);
        logger.info(`Socket connected: ${socket.connected}`);
        logger.info(`Socket rooms:`, Array.from(socket.rooms));
        
        const roomName = `game::${data.gameId}`;
        const isInRoom = socket.rooms.has(roomName);
        const roomMembers = nsp.adapter.rooms.get(roomName);
        
        logger.info(`=== FRIEND SOCKET: Room membership test results ===`);
        logger.info(`Room name: ${roomName}`);
        logger.info(`Socket in room: ${isInRoom}`);
        logger.info(`Room members: ${roomMembers?.size || 0}`);
        logger.info(`Room members details:`, roomMembers ? Array.from(roomMembers) : []);
      }
      
      socket.emit('pong', { 
        timestamp: Date.now(),
        receivedAt: Date.now(),
        socketId: socket.id,
        rooms: Array.from(socket.rooms)
      });
    });
  });
} 