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
  stopClock,
  handleGameEnd
} from './socketHelpers.js';
import logger from '../utils/logger.js';

// متغير لتتبع الاتصالات النشطة
const activeConnections = new Map();

// دالة موحدة لتحديث حالة المستخدم
async function updateUserStatus(userId, status) {
  try {
    const user = await User.findByPk(userId);
    if (user && user.state === 'in-game' && (status === 'online' || status === 'offline')) {
      return false;
    }
    if (user && user.state !== status) {
      await user.update({ state: status });
      return true;
    } else if (user && user.state === status) {
      return false;
    } else {
      logger.error(`User not found: ${userId}`);
      return false;
    }
  } catch (error) {
    logger.error('Failed to update user status:', error);
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
      logger.info(`Cleaned ${expiredInvites.length} expired invites`);
    }
  } catch (error) {
    logger.error('Failed to clean expired invites:', error);
  }
}

// دالة لتسجيل إحصائيات الاتصالات
function logConnectionStats() {
  const totalConnections = activeConnections.size;
  logger.info(`Connection stats: ${totalConnections} active connections`);
}

export function initFriendSocket(io) {
  const nsp = io.of('/friends');

  // تفعيل التسجيل البسيط لتقليل التكرار
  enableMinimalLogging();

  // Cleanup expired invites every 5 minutes
  setInterval(() => {
    cleanupExpiredInvites(nsp).catch(error => {
      logger.error('Periodic invite cleanup failed:', error);
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
      socket.userId = userId;
    } catch (error) {
      logger.error('Authentication error:', error.message);
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
          order: [['created_at', 'DESC']]
        });

        if (activeGame) {
          logger.debug(`${userId}: ${activeGame.id}`);
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

    // إرسال حالة الأصدقاء للمستخدم الجديد
    sendFriendsStatusToUser(socket, userId).catch(error => {
      logger.error('Failed to send friends status on connect:', error);
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
        logger.info('Starting game with method:', { inviteId, method, userId });
        
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
        logger.error('Failed to start game:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Join user room for receiving invites
    socket.on('joinUserRoom', () => {
      socket.join(`user::${userId}`);
      logger.debug('User joined personal room:', userId);
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
          logger.error('User not found on disconnect:', userId);
          return;
        }
        
        // تحديث الحالة إلى offline فقط إذا لم يتبق أي اتصالات
        if (!isUserOnline(userId)) {
          // لا تحديث الحالة إذا كان المستخدم في مباراة
          if (user.state !== 'in-game') {
            logger.debug(`User ${userId} has no active sockets; updating to offline`);
            await updateUserStatus(userId, 'offline');
          } else {
            logger.debug(`User ${userId} is in-game; keeping status as in-game`);
          }
        } else {
          logger.debug(`User ${userId} is still connected from another socket`);
        }
      } catch (error) {
        logger.error('Failed to update status on disconnect:', error);
      }
    });
    
    // Handle player connection to game room
    socket.on('joinGameRoom', async ({ gameId }) => {
      try {
        socket.join(`game::${gameId}`);
        
        // Check if game exists and is active
        const game = await Game.findByPk(gameId);
        
        if (game && game.status === 'active') {
          // Start clock if not already running
          await startClock(nsp, gameId);
        } else if (!game) {
          logger.error(`Game ${gameId} not found when player joined`);
        }
        
        socket.to(`game::${gameId}`).emit('playerConnected', { 
          userId, 
          gameId,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to join game room:', error);
      }
    });
    
    // Handle player disconnection from game room
    socket.on('leaveGameRoom', async ({ gameId }) => {
      try {
        logger.debug('Player left game room:', { userId, gameId });
        
        socket.leave(`game::${gameId}`);

        const roomName = `game::${gameId}`;
        const roomMembers = nsp.adapter.rooms.get(roomName);
        if (!roomMembers || roomMembers.size === 0) {
          await stopClock(gameId);
        }
        
        socket.to(`game::${gameId}`).emit('playerDisconnected', { 
          userId, 
          gameId,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to leave game room:', error);
      }
    });

    // معالجة الحركة
    socket.on('move', async (moveData) => {
      logger.debug('Received move event', moveData);
      
      try {
        await handleGameMove(nsp, moveData.gameId, moveData);
      } catch (error) {
        logger.error('Error handling move:', error);
      }
    });

    // معالجة الاستسلام
    socket.on('resign', async (data, ack) => {
      try {
        const gameId = String(data?.gameId || '').trim();
        if (!gameId) {
          const response = { success: false, message: 'Game ID is required' };
          if (typeof ack === 'function') ack(response);
          return;
        }

        const game = await Game.findByPk(gameId);
        if (!game) {
          const response = { success: false, message: 'Game not found' };
          if (typeof ack === 'function') ack(response);
          return;
        }

        if (game.status !== 'active') {
          const response = { success: false, message: 'Game is not active' };
          if (typeof ack === 'function') ack(response);
          return;
        }

        const isParticipant =
          Number(game.white_player_id) === Number(userId) ||
          Number(game.black_player_id) === Number(userId);

        if (!isParticipant) {
          const response = { success: false, message: 'Not authorized to resign this game' };
          if (typeof ack === 'function') ack(response);
          return;
        }

        const resignedPlayer = Number(userId) === Number(game.white_player_id) ? 'white' : 'black';
        const winner = resignedPlayer === 'white' ? 'black' : 'white';

        await handleGameEnd(nsp, gameId, 'resign', winner);

        const response = { success: true };
        if (typeof ack === 'function') ack(response);
      } catch (error) {
        logger.error('Error handling resign:', error);
        if (typeof ack === 'function') {
          ack({ success: false, message: 'Failed to process resignation' });
        }
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
