import { Server } from 'socket.io';
import Game from '../models/Game.js';
import GameMove from '../models/GameMove.js';
import User from '../models/User.js';
import { authenticateSocket } from './socketHelpers.js';
import logger from '../utils/logger.js';

// متغير لتخزين بيانات المؤقت في الذاكرة
const gameTimerData = new Map(); // { gameId: { whiteTimeLeft, blackTimeLeft, currentTurn, game } }

// دالة لبدء المؤقت للمباراة
async function startClock(nsp, gameId) {
  try {
    const game = await Game.findByPk(gameId);
    if (!game || game.status !== 'active') {
      logger.warn(`Game ${gameId} not found or not active for clock start`);
      return;
    }

    // تخزين بيانات المؤقت في الذاكرة
    gameTimerData.set(gameId, {
      whiteTimeLeft: game.white_time_left,
      blackTimeLeft: game.black_time_left,
      currentTurn: game.current_turn,
      game: game
    });

    // بدء المؤقت
    const timer = setInterval(async () => {
      try {
        const timerData = gameTimerData.get(gameId);
        if (!timerData) {
          clearInterval(timer);
          return;
        }

        const { whiteTimeLeft, blackTimeLeft, currentTurn } = timerData;

        // تحديث الوقت للاعب الحالي
        if (currentTurn === 'white' && whiteTimeLeft > 0) {
          timerData.whiteTimeLeft--;
        } else if (currentTurn === 'black' && blackTimeLeft > 0) {
          timerData.blackTimeLeft--;
        }

        // التحقق من انتهاء الوقت
        if (whiteTimeLeft <= 0) {
          await handleGameTimeout(nsp, gameId, 'white');
          clearInterval(timer);
          return;
        }

        if (blackTimeLeft <= 0) {
          await handleGameTimeout(nsp, gameId, 'black');
          clearInterval(timer);
          return;
        }

        // إرسال تحديث المؤقت للاعبين
        nsp.to(`game::${gameId}`).emit('clockUpdate', {
          whiteTimeLeft: timerData.whiteTimeLeft,
          blackTimeLeft: timerData.blackTimeLeft,
          currentTurn: timerData.currentTurn
        });

      } catch (error) {
        logger.error(`Error in clock timer for game ${gameId}:`, error);
        clearInterval(timer);
      }
    }, 1000); // تحديث كل ثانية

    logger.info(`Clock started for game ${gameId}`);
  } catch (error) {
    logger.error(`Error starting clock for game ${gameId}:`, error);
  }
}

// دالة لمعالجة انتهاء الوقت
async function handleGameTimeout(nsp, gameId, timeoutPlayer) {
  try {
    const game = await Game.findByPk(gameId);
    if (!game || game.status !== 'active') {
      return;
    }

    // تحديد الفائز
    const winnerId = timeoutPlayer === 'white' ? game.black_player_id : game.white_player_id;
    const loserId = timeoutPlayer === 'white' ? game.white_player_id : game.black_player_id;

    // تحديث حالة المباراة
    await game.update({
      status: 'ended',
      winner_id: winnerId,
      ended_at: new Date()
    });

    // تحديث حالة اللاعبين
    await Promise.all([
      User.update({ state: 'online' }, { where: { user_id: winnerId } }),
      User.update({ state: 'online' }, { where: { user_id: loserId } })
    ]);

    // إرسال حدث انتهاء المباراة
    nsp.to(`game::${gameId}`).emit('gameTimeout', {
      gameId,
      timeoutPlayer,
      winnerId,
      loserId
    });

    // إرسال حدث انتهاء المباراة العام
    nsp.to(`game::${gameId}`).emit('gameEnded', {
      gameId,
      reason: 'timeout',
      winnerId,
      loserId
    });

    // إزالة بيانات المؤقت
    gameTimerData.delete(gameId);

    logger.info(`Game ${gameId} ended due to timeout for ${timeoutPlayer}`);
  } catch (error) {
    logger.error(`Error handling timeout for game ${gameId}:`, error);
  }
}

// دالة لمعالجة الحركة
async function handleGameMove(nsp, gameId, moveData) {
  try {
    const { san, fen, movedBy } = moveData;

    // التحقق من وجود المباراة
    const game = await Game.findByPk(gameId);
    if (!game || game.status !== 'active') {
      throw new Error('Game not found or not active');
    }

    // التحقق من أن اللاعب هو من دوره
    const isWhiteTurn = game.current_turn === 'white';
    const isWhitePlayer = game.white_player_id === movedBy;
    
    if ((isWhiteTurn && !isWhitePlayer) || (!isWhiteTurn && isWhitePlayer)) {
      throw new Error('Not your turn');
    }

    // حساب رقم الحركة
    const moveCount = await GameMove.count({ where: { game_id: gameId } });
    const moveNumber = moveCount + 1;

    // تسجيل الحركة في قاعدة البيانات
    await GameMove.create({
      game_id: gameId,
      move_number: moveNumber,
      player_id: movedBy,
      uci: moveData.uci || '',
      san: san,
      fen_after: fen
    });

    // تحديث FEN وتبديل الدور
    const newTurn = game.current_turn === 'white' ? 'black' : 'white';
    await game.update({
      current_fen: fen,
      current_turn: newTurn
    });

    // تحديث بيانات المؤقت في الذاكرة
    const timerData = gameTimerData.get(gameId);
    if (timerData) {
      timerData.currentTurn = newTurn;
    }

    // إرسال حدث الحركة للاعبين
    nsp.to(`game::${gameId}`).emit('moveMade', {
      gameId,
      move: san,
      fen: fen,
      movedBy,
      moveNumber
    });

    // إرسال تحديث المؤقت
    if (timerData) {
      nsp.to(`game::${gameId}`).emit('clockUpdate', {
        whiteTimeLeft: timerData.whiteTimeLeft,
        blackTimeLeft: timerData.blackTimeLeft,
        currentTurn: timerData.currentTurn
      });
    }

    // إرسال تحديث الدور
    nsp.to(`game::${gameId}`).emit('turnUpdate', {
      gameId,
      currentTurn: newTurn
    });

    // فحص نهاية المباراة (checkmate, draw)
    await checkGameEnd(nsp, gameId, fen, newTurn);

    logger.info(`Move processed for game ${gameId}: ${san} by user ${movedBy}`);
  } catch (error) {
    logger.error(`Error handling move for game ${gameId}:`, error);
    throw error;
  }
}

// دالة لفحص نهاية المباراة
async function checkGameEnd(nsp, gameId, fen, currentTurn) {
  try {
    // تحليل FEN للتحقق من نهاية المباراة
    const fenParts = fen.split(' ');
    const board = fenParts[0];
    const activeColor = fenParts[1];
    const castling = fenParts[2];
    const enPassant = fenParts[3];
    const halfMoveClock = fenParts[4];
    const fullMoveNumber = fenParts[5];

    // فحص checkmate
    if (fen.includes('#')) {
      const winnerId = currentTurn === 'white' ? 
        (await Game.findByPk(gameId)).black_player_id : 
        (await Game.findByPk(gameId)).white_player_id;
      
      await endGame(nsp, gameId, 'checkmate', winnerId);
      return;
    }

    // فحص draw
    if (fen.includes('=') || halfMoveClock >= 50) {
      await endGame(nsp, gameId, 'draw', null);
      return;
    }

    // فحص stalemate (يمكن إضافة منطق إضافي هنا)
    // ...

  } catch (error) {
    logger.error(`Error checking game end for game ${gameId}:`, error);
  }
}

// دالة لإنهاء المباراة
async function endGame(nsp, gameId, reason, winnerId) {
  try {
    const game = await Game.findByPk(gameId);
    if (!game || game.status !== 'active') {
      return;
    }

    // تحديث حالة المباراة
    await game.update({
      status: 'ended',
      winner_id: winnerId,
      ended_at: new Date()
    });

    // تحديث حالة اللاعبين
    const players = [game.white_player_id, game.black_player_id];
    await Promise.all(
      players.map(playerId => 
        User.update({ state: 'online' }, { where: { user_id: playerId } })
      )
    );

    // إرسال حدث انتهاء المباراة
    nsp.to(`game::${gameId}`).emit('gameEnded', {
      gameId,
      reason,
      winnerId,
      loserId: winnerId ? 
        (winnerId === game.white_player_id ? game.black_player_id : game.white_player_id) : 
        null
    });

    // إزالة بيانات المؤقت
    gameTimerData.delete(gameId);

    logger.info(`Game ${gameId} ended: ${reason}`);
  } catch (error) {
    logger.error(`Error ending game ${gameId}:`, error);
  }
}

// دالة لتهيئة gameSocket
export function initGameSocket(io) {
  const nsp = io.of('/friends');

  nsp.on('connection', async socket => {
    let userId = null;

    // مصادقة المستخدم
    try {
      userId = authenticateSocket(socket);
    } catch (error) {
      logger.error('Authentication error in gameSocket:', error.message);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    logger.info(`User ${userId} connected to gameSocket`);

    // الانضمام لغرفة المباراة
    socket.on('joinGameRoom', async ({ gameId }) => {
      try {
        logger.info(`User ${userId} joining game room: game::${gameId}`);
        
        // الانضمام للغرفة
        socket.join(`game::${gameId}`);
        
        // التحقق من وجود المباراة
        const game = await Game.findByPk(gameId);
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // التحقق من أن المستخدم هو أحد اللاعبين
        if (game.white_player_id !== userId && game.black_player_id !== userId) {
          socket.emit('error', { message: 'Not authorized to join this game' });
          return;
        }

        // بدء المؤقت إذا لم يكن يعمل
        if (!gameTimerData.has(gameId) && game.status === 'active') {
          await startClock(nsp, gameId);
        }

        // إرسال بيانات المؤقت الحالية
        const timerData = gameTimerData.get(gameId);
        if (timerData) {
          socket.emit('clockUpdate', {
            whiteTimeLeft: timerData.whiteTimeLeft,
            blackTimeLeft: timerData.blackTimeLeft,
            currentTurn: timerData.currentTurn
          });
        }

        // إرسال تحديث الدور
        socket.emit('turnUpdate', {
          gameId,
          currentTurn: game.current_turn
        });

        // إشعار اللاعب الآخر
        socket.to(`game::${gameId}`).emit('playerConnected', {
          userId,
          gameId,
          timestamp: new Date()
        });

        logger.info(`User ${userId} successfully joined game room ${gameId}`);
      } catch (error) {
        logger.error(`Error joining game room for user ${userId}:`, error);
        socket.emit('error', { message: 'Failed to join game room' });
      }
    });

    // معالجة الحركة
    socket.on('move', async (moveData) => {
      try {
        logger.info(`Received move from user ${userId} for game ${moveData.gameId}`);
        
        // إضافة معرف اللاعب للبيانات
        moveData.movedBy = userId;
        
        // معالجة الحركة
        await handleGameMove(nsp, moveData.gameId, moveData);
        
        logger.info(`Move processed successfully for game ${moveData.gameId}`);
      } catch (error) {
        logger.error(`Error processing move for user ${userId}:`, error);
        socket.emit('error', { message: error.message || 'Failed to process move' });
      }
    });

    // مغادرة غرفة المباراة
    socket.on('leaveGameRoom', async ({ gameId }) => {
      try {
        logger.info(`User ${userId} leaving game room: game::${gameId}`);
        
        socket.leave(`game::${gameId}`);
        
        // إشعار اللاعب الآخر
        socket.to(`game::${gameId}`).emit('playerDisconnected', {
          userId,
          gameId,
          timestamp: new Date()
        });
        
        logger.info(`User ${userId} left game room ${gameId}`);
      } catch (error) {
        logger.error(`Error leaving game room for user ${userId}:`, error);
      }
    });

    // قطع الاتصال
    socket.on('disconnect', () => {
      logger.info(`User ${userId} disconnected from gameSocket`);
    });
  });
} 