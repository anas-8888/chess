import { Op } from 'sequelize';
import User from '../models/User.js';
import Game from '../models/Game.js';

// Get leaderboard
export async function getLeaderboard(options = {}) {
  const { type = 'global', limit = 50, offset = 0 } = options;

  let whereClause = {};
  let orderClause = [['rank', 'DESC']];

  // Filter by time period
  if (type === 'monthly') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    whereClause.created_at = {
      [Op.gte]: startOfMonth
    };
  } else if (type === 'weekly') {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    whereClause.created_at = {
      [Op.gte]: startOfWeek
    };
  }

  // Get users with their stats
  const users = await User.findAll({
    where: whereClause,
    attributes: [
      'user_id',
      'username',
      'rank',
      'thumbnail',
      'created_at'
    ],
    order: orderClause,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  // Get additional stats for each user
  const leaderboard = await Promise.all(
    users.map(async (user) => {
      const stats = await getUserStatsForLeaderboard(user.user_id, type);
      
      return {
        rank: users.indexOf(user) + 1 + parseInt(offset),
        id: user.user_id,
        name: user.username,
        points: user.rank,
        games: stats.total_games,
        winRate: stats.win_rate,
        created_at: user.created_at
      };
    })
  );

  return {
    type: type,
    leaderboard: leaderboard,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: await User.count({ where: whereClause })
    }
  };
}

// Get user stats for leaderboard
async function getUserStatsForLeaderboard(userId, type) {
  let whereClause = {
    [Op.or]: [
      { whiteUserId: userId },
      { blackUserId: userId }
    ]
  };

  // Filter by time period
  if (type === 'monthly') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    whereClause.dateTime = {
      [Op.gte]: startOfMonth
    };
  } else if (type === 'weekly') {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    whereClause.dateTime = {
      [Op.gte]: startOfWeek
    };
  }

  const games = await Game.findAll({
    where: whereClause,
    attributes: ['mode', 'dateTime', 'whiteRatingChange', 'blackRatingChange']
  });

  const stats = {
    total_games: games.length,
    wins: 0,
    losses: 0,
    draws: 0,
    win_rate: 0,
    rated_games: 0,
    casual_games: 0
  };

  games.forEach(game => {
    const isPlayer1 = game.whiteUserId === userId;
    const ratingChange = isPlayer1 ? game.whiteRatingChange : game.blackRatingChange;
    
    // تحديد النتيجة بناءً على تغيير النقاط
    if (ratingChange > 0) {
      stats.wins++;
    } else if (ratingChange < 0) {
      stats.losses++;
    } else {
      stats.draws++;
    }

    // جميع الألعاب تعتبر casual في الوقت الحالي
    stats.casual_games++;
  });

  if (stats.total_games > 0) {
    stats.win_rate = Math.round((stats.wins / stats.total_games) * 100);
  }

  return stats;
} 