import { formatResponse, formatError } from '../utils/helpers.js';
import * as historyService from '../services/historyService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// Get user's game history
export const getUserGameHistory = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);
  const { page, limit, status, gameMode, sortBy, sortOrder } = req.query;
  
  const history = await historyService.getUserGameHistory(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    gameMode,
    sortBy: sortBy || 'created_at',
    sortOrder: sortOrder || 'DESC'
  });
  
  res.status(200).json(
    formatResponse(history, 'Game history retrieved successfully')
  );
}); 