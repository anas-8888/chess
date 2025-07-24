import { Op } from 'sequelize';
import Game from '../models/Game.js';
import User from '../models/User.js';
import GameMove from '../models/GameMove.js';

// Get user's game history
export async function getUserGameHistory(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    gameMode,
    sortBy = 'dateTime',
    sortOrder = 'DESC'
  } = options;

  // Build where clause
  const whereClause = {
    [Op.or]: [
      { whiteUserId: userId },
      { blackUserId: userId }
    ]
  };

  if (gameMode) {
    whereClause.mode = gameMode;
  }

  // Get games with pagination
  const { count, rows: games } = await Game.findAndCountAll({
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
      },
      {
        model: GameMove,
        as: 'moves',
        attributes: ['id', 'move', 'movedBy', 'createdAt'],
        order: [['createdAt', 'ASC']]
      }
    ],
    order: [[sortBy, sortOrder]],
    limit: parseInt(limit),
    offset: (page - 1) * limit
  });

  // Process games to add user-specific data
  const processedGames = games.map(game => {
    const isPlayer1 = game.whiteUserId === userId;
    const opponent = isPlayer1 ? game.blackPlayer : game.whitePlayer;
    const playerSide = isPlayer1 ? 'white' : 'black';
    
    // Simplified result logic based on rating changes
    let result = 'ongoing';
    if (game.whiteRatingChange !== null && game.blackRatingChange !== null) {
      const playerRatingChange = isPlayer1 ? game.whiteRatingChange : game.blackRatingChange;
      if (playerRatingChange > 0) {
        result = 'win';
      } else if (playerRatingChange < 0) {
        result = 'loss';
      } else {
        result = 'draw';
      }
    }

    return {
      id: game.id,
      opponent: {
        user_id: opponent.user_id,
        username: opponent.username,
        rank: opponent.rank,
        thumbnail: opponent.thumbnail
      },
      player_side: playerSide,
      time_control: game.gameTime,
      game_mode: game.mode,
      status: 'completed', // Simplified
      result: result,
      moves_count: game.moves?.length || 0,
      created_at: game.dateTime,
      updated_at: game.dateTime,
      ended_at: game.dateTime,
      moves: game.moves?.slice(0, 10) || [] // Show only first 10 moves for performance
    };
  });

  return {
    games: processedGames,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    },
    stats: await getUserGameStats(userId, whereClause)
  };
}

// Get user's game statistics
async function getUserGameStats(userId, whereClause) {
  const games = await Game.findAll({
    where: whereClause,
    attributes: ['mode', 'gameTime', 'whiteRatingChange', 'blackRatingChange']
  });

  const stats = {
    total_games: games.length,
    completed_games: 0,
    ongoing_games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    win_rate: 0,
    rated_games: 0,
    casual_games: 0,
    time_controls: {
      '5': 0,
      '10': 0,
      '15': 0
    }
  };

  games.forEach(game => {
    // Consider games with rating changes as completed
    if (game.whiteRatingChange !== null && game.blackRatingChange !== null) {
      stats.completed_games++;
      
      const isPlayer1 = game.whiteUserId === userId;
      const playerRatingChange = isPlayer1 ? game.whiteRatingChange : game.blackRatingChange;
      
      if (playerRatingChange > 0) {
        stats.wins++;
      } else if (playerRatingChange < 0) {
        stats.losses++;
      } else {
        stats.draws++;
      }
    } else {
      stats.ongoing_games++;
    }

    if (game.mode === 'friend') {
      stats.rated_games++;
    } else {
      stats.casual_games++;
    }

    if (game.gameTime) {
      stats.time_controls[game.gameTime] = 
        (stats.time_controls[game.gameTime] || 0) + 1;
    }
  });

  if (stats.completed_games > 0) {
    stats.win_rate = Math.round((stats.wins / stats.completed_games) * 100);
  }

  return stats;
} 