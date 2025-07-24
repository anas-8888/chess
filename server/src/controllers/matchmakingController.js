import { formatResponse, formatError } from '../utils/helpers.js';
import * as matchmakingService from '../services/matchmakingService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// Join random matchmaking
export const joinRandomMatchmaking = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { timeControl, gameMode } = req.body;
  
  const result = await matchmakingService.joinRandomMatchmaking(userId, {
    timeControl: timeControl || 'blitz',
    gameMode: gameMode || 'rated'
  });
  
  res.status(200).json(
    formatResponse(result, 'Joined random matchmaking successfully')
  );
});

// Leave random matchmaking
export const leaveRandomMatchmaking = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  await matchmakingService.leaveRandomMatchmaking(userId);
  
  res.status(200).json(
    formatResponse(null, 'Left random matchmaking successfully')
  );
}); 