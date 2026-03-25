import Game from '../models/Game.js';
import Invite from '../models/Invite.js';
import { Op } from 'sequelize';
import {
  authenticateSocket,
  handleGameInvite,
  handleInviteResponse,
  addUserConnection,
  removeUserConnection,
  isUserOnline,
  updateUserStatus,
  enableMinimalLogging,
  sendFriendsStatusToUser,
  handleGameMove,
  startClock,
  stopClock,
  handleGameEnd,
} from './socketHelpers.js';
import logger from '../utils/logger.js';
import { startGame as startGameFromInviteService } from '../services/inviteService.js';

const activeConnections = new Map();

async function cleanupExpiredInvites() {
  try {
    const expiredInvites = await Invite.findAll({
      where: {
        status: 'pending',
        date_time: {
          [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      attributes: ['id'],
    });

    if (expiredInvites.length === 0) {
      return;
    }

    await Invite.update(
      { status: 'expired' },
      {
        where: {
          id: {
            [Op.in]: expiredInvites.map((invite) => invite.id),
          },
        },
      }
    );

    logger.info(`Cleaned ${expiredInvites.length} expired invites`);
  } catch (error) {
    logger.error('Failed to clean expired invites:', error);
  }
}

function logConnectionStats() {
  const totalConnections = activeConnections.size;
  if (totalConnections > 0) {
    logger.debug(`Connection stats: ${totalConnections} active connections`);
  }
}

export function initFriendSocket(io) {
  const nsp = io.of('/friends');

  enableMinimalLogging();

  setInterval(() => {
    cleanupExpiredInvites().catch((error) => {
      logger.error('Periodic invite cleanup failed:', error);
    });
  }, 5 * 60 * 1000);

  setInterval(() => {
    logConnectionStats();
  }, 5 * 60 * 1000);

  nsp.on('connection', async (socket) => {
    let userId = null;

    try {
      userId = authenticateSocket(socket);
      socket.userId = userId;
    } catch (error) {
      logger.error('Authentication error:', error.message);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    addUserConnection(userId, socket.id);
    activeConnections.set(socket.id, userId);

    try {
      const activeGame = await Game.findOne({
        where: {
          [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
          status: { [Op.in]: ['waiting', 'active'] },
        },
        order: [['created_at', 'DESC']],
      });

      if (activeGame) {
        socket.emit('rejoin_game', {
          gameId: activeGame.id,
          whiteUserId: activeGame.white_player_id,
          blackUserId: activeGame.black_player_id,
          whitePlayMethod: activeGame.white_play_method,
          blackPlayMethod: activeGame.black_play_method,
          gameType: activeGame.game_type,
          status: activeGame.status,
        });
      }
    } catch (_error) {
      // ignore rejoin bootstrap errors; main flow should continue
    }

    socket.join(`user::${userId}`);

    sendFriendsStatusToUser(socket, userId).catch((error) => {
      logger.error('Failed to send friends status on connect:', error);
    });

    socket.on('sendGameInvite', async (data) => {
      await handleGameInvite(socket, nsp, userId, data);
    });

    socket.on('respondToGameInvite', async (data) => {
      await handleInviteResponse(socket, nsp, userId, data);
    });

    socket.on('startGameWithMethod', async ({ inviteId, method }) => {
      try {
        if (!inviteId || !method) {
          return socket.emit('error', { message: 'بيانات بدء اللعبة غير مكتملة' });
        }

        const startResult = await startGameFromInviteService(inviteId, userId, method);
        const gameId = startResult?.gameId || startResult?.game?.id;

        if (!gameId) {
          return socket.emit('error', { message: 'تعذر بدء المباراة' });
        }

        await startClock(nsp, gameId);

        const gameData = {
          inviteId,
          gameId,
          ...(startResult?.game || {}),
        };

        nsp.to(`user::${userId}`).emit('gameStarted', gameData);
      } catch (error) {
        logger.error('Failed to start game:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('joinUserRoom', () => {
      socket.join(`user::${userId}`);
    });

    socket.on('disconnect', async () => {
      removeUserConnection(userId, socket.id);
      activeConnections.delete(socket.id);

      try {
        if (!isUserOnline(userId)) {
          await updateUserStatus(userId, 'offline');
        }
      } catch (error) {
        logger.error('Failed to update status on disconnect:', error);
      }
    });

    socket.on('joinGameRoom', async ({ gameId }) => {
      try {
        const normalizedGameId = String(gameId || '').trim();
        if (!normalizedGameId) {
          return;
        }

        socket.join(`game::${normalizedGameId}`);

        const game = await Game.findByPk(normalizedGameId, {
          attributes: ['id', 'status', 'white_player_id', 'black_player_id'],
        });

        if (!game) {
          logger.warn(`Game ${normalizedGameId} not found when player joined`);
          return;
        }

        const isParticipant =
          Number(game.white_player_id) === Number(userId) ||
          Number(game.black_player_id) === Number(userId);

        if (!isParticipant) {
          logger.warn(`User ${userId} is not a participant in game ${normalizedGameId}`);
          socket.leave(`game::${normalizedGameId}`);
          return;
        }

        if (game.status === 'active') {
          await startClock(nsp, normalizedGameId);
        }

        socket.to(`game::${normalizedGameId}`).emit('playerConnected', {
          userId,
          gameId: normalizedGameId,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Failed to join game room:', error);
      }
    });

    socket.on('leaveGameRoom', async ({ gameId }) => {
      try {
        const normalizedGameId = String(gameId || '').trim();
        if (!normalizedGameId) {
          return;
        }

        socket.leave(`game::${normalizedGameId}`);

        const roomName = `game::${normalizedGameId}`;
        const roomMembers = nsp.adapter.rooms.get(roomName);
        if (!roomMembers || roomMembers.size === 0) {
          await stopClock(normalizedGameId);
        }

        socket.to(roomName).emit('playerDisconnected', {
          userId,
          gameId: normalizedGameId,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Failed to leave game room:', error);
      }
    });

    socket.on('move', async (moveData) => {
      try {
        await handleGameMove(nsp, moveData.gameId, moveData);
      } catch (error) {
        logger.error('Error handling move:', error);
      }
    });

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

        if (typeof ack === 'function') {
          ack({ success: true });
        }
      } catch (error) {
        logger.error('Error handling resign:', error);
        if (typeof ack === 'function') {
          ack({ success: false, message: 'Failed to process resignation' });
        }
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: Date.now(),
        receivedAt: Date.now(),
        socketId: socket.id,
        rooms: Array.from(socket.rooms),
      });
    });
  });
}
