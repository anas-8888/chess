/*
 * server/src/socket/gameSocket.js
 * ================================
 * مسؤول عن هندلة كل ما يتعلق باللعبة (Real‑Time): الانضمام، الحركات، التايمر، الشات، التعادل، الاستسلام، إعادة الإتصال...
 * يعتمد على Socket.IO namespace "/game" ويستخدم الـ DB كنقطة حقيقة (source of truth).
 */

import { Op, Sequelize } from 'sequelize';
import { Chess } from 'chess.js';

import Game from '../models/Game.js';
import GameMove from '../models/GameMove.js';
import GameChat from '../models/GameChat.js';
import User from '../models/User.js';

import {
  authenticateSocket,
  addUserConnection,
  removeUserConnection,
  isUserOnline,
  updateUserStatus,
  enableMinimalLogging,
  setupPingPong
} from './socketHelpers.js';

import logger from '../utils/logger.js';

// خريطة لحفظ حالات المؤقت في الذاكرة لتقليل ضربات الـ DB
const gameTimers = new Map(); // gameId -> intervalId
const gameCache  = new Map(); // gameId -> { chess, lastSyncAt }

// أداة مساعدة: حساب الوقت المتبقي للطرفين وتحديث الحقول داخل كائن اللعبة
function applyClockUpdate(gameInstance) {
  const now = Date.now();
  if (!gameInstance.lastTimeUpdate) {
    gameInstance.lastTimeUpdate = new Date(now);
    return;
  }
  if (gameInstance.status !== 'in_progress') return;

  const last = new Date(gameInstance.lastTimeUpdate).getTime();
  const diffMs = now - last; // الفارق منذ آخر تحديث

  if (diffMs <= 0) return;

  if (gameInstance.currentTurn === 'w') {
    gameInstance.whiteTime = Math.max(0, (gameInstance.whiteTime ?? 0) - Math.floor(diffMs / 1000));
  } else {
    gameInstance.blackTime = Math.max(0, (gameInstance.blackTime ?? 0) - Math.floor(diffMs / 1000));
  }

  gameInstance.lastTimeUpdate = new Date(now);
}

// بث إلى كل من في غرفة اللعبة
function broadcastToGame(io, gameId, event, payload, exceptSocketId = null) {
  if (exceptSocketId) {
    io.of('/game').to(`game::${gameId}`).except(exceptSocketId).emit(event, payload);
  } else {
    io.of('/game').to(`game::${gameId}`).emit(event, payload);
  }
}

// إرجاع حالة اللعبة كاملة للعميل
async function emitFullState(socket, gameInstance, includeChat = true) {
  const moves = await GameMove.findAll({
    where: { gameId: gameInstance.id },
    order: [['moveNum', 'ASC']]
  });

  let chat = [];
  if (includeChat) {
    chat = await GameChat.findAll({
      where: { gameId: gameInstance.id },
      order: [['createdAt', 'ASC']]
    });
  }

  const payload = {
    game: {
      id: gameInstance.id,
      whiteUserId: gameInstance.whiteUserId,
      blackUserId: gameInstance.blackUserId,
      status: gameInstance.status,
      fen: moves.length ? moves[moves.length - 1].fen : undefined,
      currentTurn: gameInstance.currentTurn,
      whiteTime: gameInstance.whiteTime,
      blackTime: gameInstance.blackTime,
      lastTimeUpdate: gameInstance.lastTimeUpdate,
      drawOfferedBy: gameInstance.drawOfferedBy,
      pausedBy: gameInstance.pausedBy,
      pausedAt: gameInstance.pausedAt,
      mode: gameInstance.mode,
      gameTime: gameInstance.gameTime
    },
    moves: moves.map(m => ({ id: m.id, san: m.san, fen: m.fen, moveNum: m.moveNum, movedBy: m.movedBy })),
    chat: chat.map(c => ({ id: c.id, userId: c.userId, message: c.message, type: c.messageType, createdAt: c.createdAt }))
  };

  socket.emit('state', payload);
}

// يبدأ تايمر إرسال تحديث الساعة للعملاء كل ثانية (يتم حساب الوقت من السيرفر)
function startClockTicker(io, gameInstance) {
  // أوقف القديم إن وجد
  stopClockTicker(gameInstance.id);

  const intervalId = setInterval(async () => {
    try {
      //読 من الذاكرة لتقليل الاستعلامات
      applyClockUpdate(gameInstance);

      // إذا انتهى وقت أي طرف
      if ((gameInstance.whiteTime ?? 0) <= 0 || (gameInstance.blackTime ?? 0) <= 0) {
        clearInterval(intervalId);
        gameTimers.delete(gameInstance.id);
        // احفظ بالـ DB وانهِ المباراة
        const winner = (gameInstance.whiteTime ?? 0) <= 0 ? 'black' : 'white';
        await endGame(io, gameInstance.id, winner.toUpperCase() + '_WIN', 'time');
        return;
      }

      broadcastToGame(io, gameInstance.id, 'clock', {
        whiteTime: gameInstance.whiteTime,
        blackTime: gameInstance.blackTime,
        currentTurn: gameInstance.currentTurn,
        serverTs: Date.now()
      });
    } catch (err) {
      logger.error('Clock ticker error:', err);
    }
  }, 1000);

  gameTimers.set(gameInstance.id, intervalId);
}

function stopClockTicker(gameId) {
  const id = gameTimers.get(gameId);
  if (id) {
    clearInterval(id);
    gameTimers.delete(gameId);
  }
}

// إنهاء اللعبة وتحديث الحالة
async function endGame(io, gameId, result, reason = 'normal') {
  const t = await Game.sequelize.transaction();
  try {
    const game = await Game.findByPk(gameId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!game) throw new Error('Game not found');

    if (game.status === 'completed' || game.status === 'abandoned') {
      await t.commit();
      return;
    }

    game.status = 'completed';
    // تحديث النقاط / الرتبة إذا لديك منطق لذلك
    await game.save({ transaction: t });

    await t.commit();

    stopClockTicker(gameId);

    broadcastToGame(io, gameId, 'gameEnded', { gameId, result, reason });

    // إعادة حالة اللاعبين إلى online
    await Promise.all([
      updateUserStatus(game.whiteUserId, 'online'),
      updateUserStatus(game.blackUserId, 'online')
    ]);

    logger.info(`Game ${gameId} ended. Result: ${result}`);
  } catch (err) {
    await t.rollback();
    logger.error('endGame error:', err);
  }
}

export function initGameSocket(io) {
  const nsp = io.of('/game');

  enableMinimalLogging();

  nsp.on('connection', async socket => {
    let userId = null;

    // 1) المصادقة
    try {
      userId = authenticateSocket(socket);
    } catch (error) {
      logger.error('Socket authentication error:', error);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect(true);
      return;
    }

    addUserConnection(userId, socket.id);

    // حالة المستخدم Online
    await updateUserStatus(userId, 'online');

    // Ping/Pong
    setupPingPong(socket, userId);

    // انضم لغرفة المستخدم الخاصة
    socket.join(`user::${userId}`);

    /**
     * EVENTS LIST
     * -----------
     * join_game          { gameId }
     * move               { gameId, from, to, promotion? }
     * chat               { gameId, message, type?: 'text'|'sticker' }
     * offer_draw         { gameId }
     * respond_draw       { gameId, accept: boolean }
     * resign             { gameId }
     * request_state      { gameId }
     * pause              { gameId }
     * resume             { gameId }
     */

    socket.on('join_game', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        if (![game.whiteUserId, game.blackUserId].includes(userId)) {
          return socket.emit('error', { message: 'Not part of this game' });
        }

        socket.join(`game::${gameId}`);

        // حمّل / حافظ على كائن chess في الكاش
        let cached = gameCache.get(gameId);
        if (!cached) {
          const lastMove = await GameMove.findOne({ where: { gameId }, order: [['moveNum', 'DESC']] });
          const chess = new Chess(lastMove ? lastMove.fen : undefined);
          cached = { chess, lastSyncAt: Date.now() };
          gameCache.set(gameId, cached);
        }

        // أرسل الحالة كاملة للعميل
        await emitFullState(socket, game, true);

        // ابدأ ساعة اللعبة إذا كانت في حالة in_progress
        if (game.status === 'in_progress') startClockTicker(io, game);

        socket.emit('joined', { gameId });
        socket.to(`game::${gameId}`).emit('playerJoined', { userId, gameId });
      } catch (err) {
        logger.error('join_game error:', err);
        socket.emit('error', { message: 'join_game failed' });
      }
    });

    socket.on('request_state', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });
        if (![game.whiteUserId, game.blackUserId].includes(userId)) {
          return socket.emit('error', { message: 'Not part of this game' });
        }
        await emitFullState(socket, game, true);
      } catch (err) {
        logger.error('request_state error:', err);
      }
    });

    socket.on('move', async ({ gameId, from, to, promotion = 'q' }) => {
      const t = await Game.sequelize.transaction();
      try {
        const game = await Game.findByPk(gameId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!game) {
          await t.rollback();
          return socket.emit('error', { message: 'Game not found' });
        }
        if (game.status !== 'in_progress') {
          await t.rollback();
          return socket.emit('error', { message: 'Game is not running' });
        }
        if (![game.whiteUserId, game.blackUserId].includes(userId)) {
          await t.rollback();
          return socket.emit('error', { message: 'Not part of this game' });
        }

        // تحقق من الدور
        const playerColor = (game.whiteUserId === userId) ? 'w' : 'b';
        if (game.currentTurn !== playerColor) {
          await t.rollback();
          return socket.emit('error', { message: 'Not your turn' });
        }

        // جلب/تهيئة chess من الكاش
        let cache = gameCache.get(gameId);
        if (!cache) {
          const lastMove = await GameMove.findOne({ where: { gameId }, order: [['moveNum', 'DESC']] });
          cache = { chess: new Chess(lastMove ? lastMove.fen : undefined), lastSyncAt: Date.now() };
          gameCache.set(gameId, cache);
        }

        const { chess } = cache;

        const moveObj = chess.move({ from, to, promotion });
        if (!moveObj) {
          await t.rollback();
          return socket.emit('invalid_move', { from, to });
        }

        // حدث الساعة قبل تبديل الدور
        applyClockUpdate(game);

        // حفظ الحركة
        const moveCount = await GameMove.count({ where: { gameId }, transaction: t });
        await GameMove.create({
          gameId,
          moveNum: moveCount + 1,
          san: moveObj.san,
          fen: chess.fen(),
          movedBy: playerColor === 'w' ? 'white' : 'black'
        }, { transaction: t });

        // تحديث الدور ووقت آخر تحديث
        game.currentTurn = chess.turn();
        game.lastTimeUpdate = new Date();

        // إذا انتهت اللعبة بحسب chess.js
        if (chess.isGameOver()) {
          game.status = 'completed';
          await game.save({ transaction: t });
          await t.commit();

          stopClockTicker(gameId);
          broadcastToGame(io, gameId, 'move_made', {
            from,
            to,
            san: moveObj.san,
            fen: chess.fen(),
            currentTurn: game.currentTurn,
            whiteTime: game.whiteTime,
            blackTime: game.blackTime
          });

          broadcastToGame(io, gameId, 'gameEnded', {
            gameId,
            result: chess.in_draw() ? 'DRAW' : (playerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN'),
            reason: 'mate_or_draw'
          });

          // تحديث اللاعبين online
          await Promise.all([
            updateUserStatus(game.whiteUserId, 'online'),
            updateUserStatus(game.blackUserId, 'online')
          ]);
          return;
        }

        await game.save({ transaction: t });
        await t.commit();

        // أعد تشغيل الساعة (أو استمر)
        startClockTicker(io, game);

        broadcastToGame(io, gameId, 'move_made', {
          from,
          to,
          san: moveObj.san,
          fen: chess.fen(),
          currentTurn: game.currentTurn,
          whiteTime: game.whiteTime,
          blackTime: game.blackTime
        }, socket.id);

        socket.emit('move_ack');
      } catch (err) {
        await t.rollback();
        logger.error('move error:', err);
        socket.emit('error', { message: 'move failed' });
      }
    });

    socket.on('chat', async ({ gameId, message, type = 'text' }) => {
      try {
        if (!message || typeof message !== 'string') return;
        const game = await Game.findByPk(gameId);
        if (!game) return;
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;

        const chat = await GameChat.create({
          gameId,
          userId,
          message,
          messageType: type
        });

        broadcastToGame(io, gameId, 'chat_message', {
          id: chat.id,
          userId,
          message,
          type,
          createdAt: chat.createdAt
        });
      } catch (err) {
        logger.error('chat error:', err);
      }
    });

    socket.on('offer_draw', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;
        if (game.status !== 'in_progress') return;

        game.drawOfferedBy = userId;
        game.drawOfferedAt = new Date();
        await game.save();

        broadcastToGame(io, gameId, 'draw_offered', { userId, gameId });
      } catch (err) {
        logger.error('offer_draw error:', err);
      }
    });

    socket.on('respond_draw', async ({ gameId, accept }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;
        if (game.drawOfferedBy == null) return;

        if (accept) {
          await endGame(io, gameId, 'DRAW', 'draw_agreed');
        } else {
          game.drawOfferedBy = null;
          game.drawOfferedAt = null;
          await game.save();
          broadcastToGame(io, gameId, 'draw_declined', { userId, gameId });
        }
      } catch (err) {
        logger.error('respond_draw error:', err);
      }
    });

    socket.on('resign', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;
        if (game.status !== 'in_progress') return;

        const winner = game.whiteUserId === userId ? 'BLACK_WIN' : 'WHITE_WIN';
        await endGame(io, gameId, winner, 'resign');
      } catch (err) {
        logger.error('resign error:', err);
      }
    });

    socket.on('pause', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return;
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;
        if (game.status !== 'in_progress') return;

        applyClockUpdate(game);
        game.pausedBy = userId;
        game.pausedAt = new Date();
        game.status = 'waiting';
        await game.save();

        stopClockTicker(gameId);
        broadcastToGame(io, gameId, 'paused', { userId, gameId });
      } catch (err) {
        logger.error('pause error:', err);
      }
    });

    socket.on('resume', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return;
        if (![game.whiteUserId, game.blackUserId].includes(userId)) return;
        if (game.status !== 'waiting') return;

        game.pausedBy = null;
        game.pausedAt = null;
        game.status = 'in_progress';
        game.lastTimeUpdate = new Date();
        await game.save();

        startClockTicker(io, game);
        broadcastToGame(io, gameId, 'resumed', { userId, gameId });
      } catch (err) {
        logger.error('resume error:', err);
      }
    });

    socket.on('leave_game', async ({ gameId }) => {
      try {
        socket.leave(`game::${gameId}`);
        socket.to(`game::${gameId}`).emit('playerLeft', { userId, gameId });
      } catch (err) {
        logger.error('leave_game error:', err);
      }
    });

    // قطع الاتصال
    socket.on('disconnect', async () => {
      removeUserConnection(userId, socket.id);
      logger.debug(`User ${userId} disconnected from game namespace`);

      try {
        const activeGame = await Game.findOne({
          where: {
            [Op.or]: [
              { whiteUserId: userId },
              { blackUserId: userId }
            ],
            status: 'in_progress'
          }
        });

        if (activeGame) {
          // لا تغيّر الحالة إن كان لديه مباراة نشطة
          logger.debug(`User ${userId} still in active game ${activeGame.id}, keep status`);
        } else {
          if (!isUserOnline(userId)) {
            await updateUserStatus(userId, 'offline');
          } else {
            logger.debug(`User ${userId} remains online from other sockets`);
          }
        }
      } catch (err) {
        logger.error('disconnect status update error:', err);
      }
    });
  });
}
