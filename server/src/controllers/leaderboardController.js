import { formatResponse, formatError } from '../utils/helpers.js';
import * as leaderboardService from '../services/leaderboardService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// Get leaderboard
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { type, limit, offset } = req.query;
  // type: 'global', 'monthly', 'weekly'
  // limit: number of players to return
  // offset: pagination offset
  
  const leaderboard = await leaderboardService.getLeaderboard({
    type: type || 'global',
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });
  
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(leaderboard.leaderboard);
}); 