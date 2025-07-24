import { Op } from 'sequelize';
import Game from '../models/Game.js';
import GameMove from '../models/GameMove.js';
import User from '../models/User.js';
import { updateRatings as calculateEloRatings } from '../utils/elo.js';
import logger from '../utils/logger.js';

// In-memory storage for matchmaking
const matchmakingQueue = new Map();

// Helper function to get initial time based on game mode
function getInitialTime(timeControl) {
  const timeMap = {
    bullet: 60,
    blitz: 300,
    rapid: 900,
    classical: 1800,
  };
  return timeMap[timeControl] || 600;
}

// Join matchmaking queue
export async function joinMatchmaking(userId, preferences = {}) {
  const {
    timeControl = 'blitz',
    minRating = 0,
    maxRating = 3000,
    gameMode = 'friend',
  } = preferences;

  // Remove user from any existing queue
  matchmakingQueue.delete(userId);

  // Add to queue
  matchmakingQueue.set(userId, {
    userId,
    timeControl,
    minRating,
    maxRating,
    gameMode,
    joinedAt: new Date(),
  });

  // Try to find a match
  const match = await findMatch(userId, preferences);
  return match;
}

// Find match for user
async function findMatch(userId, preferences) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  for (const [queuedUserId, queuedUser] of matchmakingQueue.entries()) {
    if (queuedUserId === userId) continue;

    const queuedUserData = await User.findByPk(queuedUserId);
    if (!queuedUserData) {
      matchmakingQueue.delete(queuedUserId);
      continue;
    }

    // Check if users match preferences
    if (
      queuedUser.timeControl === preferences.timeControl &&
      queuedUser.gameMode === preferences.gameMode &&
      queuedUserData.rank >= preferences.minRating &&
      queuedUserData.rank <= preferences.maxRating &&
      user.rank >= queuedUser.minRating &&
      user.rank <= queuedUser.maxRating
    ) {
      // Remove both users from queue
      matchmakingQueue.delete(userId);
      matchmakingQueue.delete(queuedUserId);

      // Create game
      return await createGame(userId, queuedUserId, {
        ...preferences,
        gameMode: 'random' // تحويل gameMode إلى random في matchmaking
      });
    }
  }

  return null; // No match found
}

// Create a new game
export async function createGame(player1Id, player2Id, gameOptions = {}) {
  const {
    timeControl = 'blitz',
    gameMode = 'friend',
  } = gameOptions;

  // Get player data
  const [player1, player2] = await Promise.all([
    User.findByPk(player1Id),
    User.findByPk(player2Id),
  ]);

  if (!player1 || !player2) {
    throw new Error('One or both players not found');
  }

  // Create game
  const game = await Game.create({
    whiteUserId: player1Id,
    blackUserId: player2Id,
    whitePlayMethod: 'physical_board', // استخدام قيمة صحيحة من PlayMethod
    blackPlayMethod: 'physical_board', // استخدام قيمة صحيحة من PlayMethod
    gameTime: timeControl === 'blitz' ? '5' : timeControl === 'rapid' ? '10' : '15',
    mode: gameMode,
    status: 'waiting', // إضافة حالة افتراضية
    dateTime: new Date(),
    whiteTime: getInitialTime(timeControl), // إضافة الوقت الابتدائي
    blackTime: getInitialTime(timeControl),
    currentTurn: 'w', // إضافة الدور الابتدائي
  });

  // إرسال إشعار rejoin_game للاعبين
  try {
    const io = global.io;
    if (io) {
      const gameData = {
        gameId: game.id,
        whiteUserId: player1Id,
        blackUserId: player2Id,
        whitePlayMethod: 'local',
        blackPlayMethod: 'local',
        mode: gameMode
      };
      
      // إرسال إشعار للاعب الأبيض
      io.to(`user_${player1Id}`).emit('rejoin_game', gameData);
      
      // إرسال إشعار للاعب الأسود
      io.to(`user_${player2Id}`).emit('rejoin_game', gameData);
      
      console.log('تم إرسال إشعارات rejoin_game للاعبين');
    }
  } catch (error) {
    console.error('خطأ في إرسال إشعارات rejoin_game:', error);
  }

  return game;
}

// Create a game from an accepted invite
export async function createGameFromInvite(inviteId, playMethod, userId) {
  try {
    // Import Invite model
    const Invite = await import('../models/Invite.js');
    
    // Find the invite
          const invite = await Invite.default.findByPk(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // Verify the user is part of this invite
    if (invite.from_user_id !== userId && invite.to_user_id !== userId) {
      throw new Error('Not authorized to create game from this invite');
    }

    // Verify invite is accepted
    if (invite.status !== 'accepted') {
      throw new Error('Invite must be accepted before creating game');
    }

    // Determine who plays white/black (random)
    const isWhiteRandom = Math.random() < 0.5;
    const whiteUserId = isWhiteRandom ? invite.from_user_id : invite.to_user_id;
    const blackUserId = isWhiteRandom ? invite.to_user_id : invite.from_user_id;

    // Determine play methods for each player
    const whitePlayMethod = isWhiteRandom ? invite.play_method : playMethod;
    const blackPlayMethod = isWhiteRandom ? playMethod : invite.play_method;

    // Create the game with game_type from invite (always "friendly" for friend invites)
    const game = await Game.create({
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: whitePlayMethod,
      blackPlayMethod: blackPlayMethod,
      gameTime: 5, // Default game time in minutes
      mode: 'friend', // Default mode for friend invites
      status: 'in_progress',
      dateTime: new Date(),
    });

    // Update invite with game ID
    await invite.update({
      game_id: game.id,
      status: 'game_started'
    });

    // Update both players' status to 'in-game'
    const { updateUserStatus } = await import('../socket/socketHelpers.js');
    await Promise.all([
      updateUserStatus(invite.from_user_id, 'in-game'),
      updateUserStatus(invite.to_user_id, 'in-game')
    ]);

    console.log('Game created from invite:', {
      gameId: game.id,
      whiteUserId: whiteUserId,
      blackUserId: blackUserId,
      whitePlayMethod: whitePlayMethod,
      blackPlayMethod: blackPlayMethod,
      mode: invite.game_type
    });

    // إرسال إشعار rejoin_game للاعبين
    try {
      const io = global.io;
      if (io) {
        const gameData = {
          gameId: game.id,
          whiteUserId: whiteUserId,
          blackUserId: blackUserId,
          whitePlayMethod: whitePlayMethod,
          blackPlayMethod: blackPlayMethod,
          mode: invite.game_type
        };
        
        // إرسال إشعار للاعب الأبيض
        io.to(`user_${whiteUserId}`).emit('rejoin_game', gameData);
        
        // إرسال إشعار للاعب الأسود
        io.to(`user_${blackUserId}`).emit('rejoin_game', gameData);
        
        console.log('تم إرسال إشعارات rejoin_game للاعبين');
      }
    } catch (error) {
      console.error('خطأ في إرسال إشعارات rejoin_game:', error);
    }

    return game;
  } catch (error) {
    console.error('Error creating game from invite:', error);
    throw error;
  }
}

// Make a move in the game
export async function makeMove(gameId, userId, moveData) {
  const { from, to, promotion } = moveData;

  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Verify it's the user's turn
  const isPlayer1 = game.whiteUserId === userId;
  const isPlayer2 = game.blackUserId === userId;

  if (!isPlayer1 && !isPlayer2) {
    throw new Error('Not your turn');
  }

  // التحقق من أن اللعبة نشطة
  if (game.status !== 'in_progress') {
    throw new Error('Game is not active');
  }

  // التحقق من أن الدور صحيح
  const playerColor = isPlayer1 ? 'w' : 'b';
  if (game.currentTurn !== playerColor) {
    throw new Error('Not your turn');
  }

  // Record move
  const moveNumber = await GameMove.count({ where: { gameId } }) + 1;
  await GameMove.create({
    gameId: gameId,
    moveNum: moveNumber,
    san: `${from}${to}${promotion || ''}`,
    fen: '', // سيتم تحديثه لاحقاً
    movedBy: isPlayer1 ? 'white' : 'black',
    createdAt: new Date(),
  });

  // تحديث دور اللعبة
  await game.update({
    currentTurn: game.currentTurn === 'w' ? 'b' : 'w'
  });

  return { success: true };
}

// Get game by ID
export async function getGameById(gameId) {
  const game = await Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: 'whitePlayer',
        attributes: ['user_id', 'username', 'rank', 'thumbnail']
      },
      {
        model: User,
        as: 'blackPlayer',
        attributes: ['user_id', 'username', 'rank', 'thumbnail']
      }
    ]
  });

  if (!game) {
    throw new Error('Game not found');
  }

  return game;
}

// Get user's games
export async function getUserGames(userId, options = {}) {
  const { limit = 20, offset = 0, status } = options;

  let whereClause = {
    [Op.or]: [
      { whiteUserId: userId },
      { blackUserId: userId }
    ]
  };

  const games = await Game.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'whitePlayer',
        attributes: ['user_id', 'username', 'rank', 'thumbnail']
      },
      {
        model: User,
        as: 'blackPlayer',
        attributes: ['user_id', 'username', 'rank', 'thumbnail']
      }
    ],
    order: [['dateTime', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return games;
}

// Get matchmaking status
export async function getMatchmakingStatus(userId) {
  const userInQueue = matchmakingQueue.get(userId);
  return {
    inQueue: !!userInQueue,
    joinedAt: userInQueue?.joinedAt,
    queueSize: matchmakingQueue.size
  };
}

// Leave matchmaking
export async function leaveMatchmaking(userId) {
  matchmakingQueue.delete(userId);
  return { success: true };
}

// Handle player disconnect
export async function handlePlayerDisconnect(userId, _data) {
  matchmakingQueue.delete(userId);
  return { success: true };
}

// Get players for a game
export async function getGamePlayers(gameId, userId) {
  try {
    console.log('جلب اللاعبين للمباراة:', gameId);
    
    const game = await Game.findByPk(gameId, {
      include: [
        {
          model: User,
          as: 'whitePlayer',
          attributes: ['user_id', 'username', 'rank', 'thumbnail']
        },
        {
          model: User,
          as: 'blackPlayer',
          attributes: ['user_id', 'username', 'rank', 'thumbnail']
        }
      ]
    });
    
    if (!game) {
      console.log('المباراة غير موجودة:', gameId);
      return null;
    }
    
    console.log('تم جلب اللاعبين:', {
      white: game.whitePlayer?.username,
      black: game.blackPlayer?.username
    });
    
    return {
      white: game.whitePlayer,
      black: game.blackPlayer
    };
  } catch (error) {
    console.error('خطأ في جلب اللاعبين:', error);
    throw error;
  }
}

// Get active game for user
export async function getActiveGame(userId) {
  try {
    const activeGames = await Game.findAll({
      where: {
        [Op.or]: [
          { whiteUserId: userId },
          { blackUserId: userId }
        ],
        status: {
          [Op.in]: ['in-game', 'in_progress']
        }
      },
      include: [
        {
          model: User,
          as: 'whitePlayer',
          attributes: ['user_id', 'username', 'rank', 'thumbnail']
        },
        {
          model: User,
          as: 'blackPlayer',
          attributes: ['user_id', 'username', 'rank', 'thumbnail']
        }
      ],
      order: [['dateTime', 'DESC']]
    });
    
    if (activeGames.length === 0) {
      return null;
    }
    
    // إذا كان هناك أكثر من لعبة نشطة، إيقاف الألعاب القديمة
    if (activeGames.length > 1) {
      console.warn(`User ${userId} has ${activeGames.length} active games, stopping older ones`);
      for (let i = 1; i < activeGames.length; i++) {
        await activeGames[i].update({ status: 'abandoned' });
      }
    }
    
    const activeGame = activeGames[0];
    logger.debug('تم العثور على مباراة جارية:', {
      gameId: activeGame.id,
      white: activeGame.whitePlayer?.username,
      black: activeGame.blackPlayer?.username,
      status: activeGame.status
    });
    
    return {
      id: activeGame.id,
      whiteUserId: activeGame.whiteUserId,
      blackUserId: activeGame.blackUserId,
      whitePlayMethod: activeGame.whitePlayMethod,
      blackPlayMethod: activeGame.blackPlayMethod,
      mode: activeGame.mode,
      status: activeGame.status,
      dateTime: activeGame.dateTime,
      whitePlayer: activeGame.whitePlayer,
      blackPlayer: activeGame.blackPlayer
    };
  } catch (error) {
    logger.error('خطأ في البحث عن المباراة الجارية:', error);
    return null;
  }
}

// Handle draw offer
export async function offerDraw(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Check if game is still active
  if (game.status !== 'in_progress') {
    throw new Error('Game is not active');
  }

  // Update game with draw offer
  await game.update({
    drawOfferedBy: userId,
    drawOfferedAt: new Date()
  });

  return {
    success: true,
    message: 'Draw offer sent successfully'
  };
}

// Accept draw offer
export async function acceptDraw(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Check if there's an active draw offer
  if (!game.drawOfferedBy || game.drawOfferedBy === userId) {
    throw new Error('No active draw offer');
  }

  // End game as draw
  await game.update({
    status: 'draw',
    endedAt: new Date(),
    result: 'draw',
    drawOfferedBy: null,
    drawOfferedAt: null
  });

  // Update player ratings
  const [player1, player2] = await Promise.all([
    User.findByPk(game.whiteUserId),
    User.findByPk(game.blackUserId)
  ]);

  const { newRating1, newRating2 } = calculateEloRatings(
    player1.rank,
    player2.rank,
    0.5 // Draw result
  );

  await Promise.all([
    player1.update({ rank: newRating1 }),
    player2.update({ rank: newRating2 })
  ]);

  return {
    success: true,
    message: 'Draw accepted',
    game: game
  };
}

// Decline draw offer
export async function declineDraw(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Remove draw offer
  await game.update({
    drawOfferedBy: null,
    drawOfferedAt: null
  });

  return {
    success: true,
    message: 'Draw offer declined'
  };
}

// Pause game
export async function pauseGame(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Check if game is active
  if (game.status !== 'in_progress') {
    throw new Error('Game is not active');
  }

  // Update game status to paused
  await game.update({
    status: 'paused',
    pausedBy: userId,
    pausedAt: new Date()
  });

  return {
    success: true,
    message: 'Game paused successfully'
  };
}

// Resume game
export async function resumeGame(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Check if game is paused
  if (game.status !== 'paused') {
    throw new Error('Game is not paused');
  }

  // Resume game
  await game.update({
    status: 'in_progress',
    pausedBy: null,
    pausedAt: null
  });

  return {
    success: true,
    message: 'Game resumed successfully'
  };
}

// Sync game time with server
export async function syncGameTime(gameId, userId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // Get current time data from game
  const timeData = {
    serverTime: Date.now(),
    gameTime: game.dateTime,
    whiteTime: game.whiteTime || getInitialTime(game.gameTime),
    blackTime: game.blackTime || getInitialTime(game.gameTime),
    currentTurn: game.currentTurn || 'w',
    gameStatus: game.status
  };

  return timeData;
}

// Update game time
export async function updateGameTime(gameId, userId, timeData) {
  const { whiteTime, blackTime, currentTurn, timestamp } = timeData;
  
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Check if user is part of this game
  if (game.whiteUserId !== userId && game.blackUserId !== userId) {
    throw new Error('User not part of this game');
  }

  // التحقق من التزامن باستخدام timestamp
  if (game.lastTimeUpdate && timestamp < game.lastTimeUpdate.getTime()) {
    throw new Error('Time data is outdated');
  }

  // Update game time data
  await game.update({
    whiteTime: whiteTime,
    blackTime: blackTime,
    currentTurn: currentTurn,
    lastTimeUpdate: new Date(timestamp)
  });

  // Emit time update to other player via socket
  try {
    const io = global.io;
    if (io) {
      const otherUserId = game.whiteUserId === userId ? game.blackUserId : game.whiteUserId;
      
      io.to(`user_${otherUserId}`).emit('time_update', {
        whiteTime: whiteTime,
        blackTime: blackTime,
        currentTurn: currentTurn,
        gameId: gameId
      });
    }
  } catch (error) {
    console.error('Error emitting time update:', error);
  }

  return {
    success: true,
    message: 'Time updated successfully',
    timeData: {
      whiteTime,
      blackTime,
      currentTurn,
      timestamp
    }
  };
}
