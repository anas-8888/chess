import { formatResponse } from '../utils/helpers.js';
import * as userBoardService from '../services/userBoardService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all user boards with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const list = asyncHandler(async (req, res) => {
  const { page, limit, user_id, connected, name } = req.query;
  const result = await userBoardService.listUserBoards({
    page,
    limit,
    user_id,
    connected,
    name,
  });

  res.status(200).json(
    formatResponse(result, 'User boards retrieved successfully')
  );
});

/**
 * Get user board by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const board = await userBoardService.getUserBoardById(id);

  res.status(200).json(
    formatResponse(board, 'User board retrieved successfully')
  );
});

/**
 * Create a new user board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const create = asyncHandler(async (req, res) => {
  const boardData = req.body;
  const board = await userBoardService.createUserBoard(boardData);

  res.status(201).json(
    formatResponse(board, 'User board created successfully')
  );
});

/**
 * Update a user board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const board = await userBoardService.updateUserBoard(id, updateData);

  res.status(200).json(
    formatResponse(board, 'User board updated successfully')
  );
});

/**
 * Delete a user board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteUserBoard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await userBoardService.deleteUserBoard(id);

  res.status(200).json(
    formatResponse(null, 'User board deleted successfully')
  );
});

/**
 * Get boards by current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMyBoards = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { page, limit, connected, name } = req.query;
  const result = await userBoardService.getBoardsByUserId(userId, {
    page,
    limit,
    connected,
    name,
  });

  res.status(200).json(
    formatResponse(result, 'User boards retrieved successfully')
  );
});

/**
 * Update board connection status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateConnectionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { connected } = req.body;
  const board = await userBoardService.updateConnectionStatus(id, connected);

  res.status(200).json(
    formatResponse(board, `Board connection status updated to ${connected}`)
  );
});

/**
 * Get connected boards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getConnectedBoards = asyncHandler(async (req, res) => {
  const { page, limit, user_id, name } = req.query;
  const result = await userBoardService.getConnectedBoards({
    page,
    limit,
    user_id,
    name,
  });

  res.status(200).json(
    formatResponse(result, 'Connected boards retrieved successfully')
  );
});

/**
 * Get disconnected boards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDisconnectedBoards = asyncHandler(async (req, res) => {
  const { page, limit, user_id, name } = req.query;
  const result = await userBoardService.getDisconnectedBoards({
    page,
    limit,
    user_id,
    name,
  });

  res.status(200).json(
    formatResponse(result, 'Disconnected boards retrieved successfully')
  );
});
