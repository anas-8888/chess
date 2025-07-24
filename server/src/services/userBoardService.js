import UserBoard from '../models/UserBoard.js';
import User from '../models/User.js';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler.js';
import { Op } from 'sequelize';

/**
 * Get all user boards with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {number} options.user_id - Filter by user ID
 * @param {boolean} options.connected - Filter by connection status
 * @param {string} options.name - Filter by name
 * @returns {Object} Paginated user boards
 */
export const listUserBoards = async (options = {}) => {
  const { page = 1, limit = 10, user_id, connected, name } = options;

  const offset = (page - 1) * limit;
  const where = {};

  if (user_id) {
    where.user_id = user_id;
  }
  if (connected !== undefined) {
    where.connected = connected;
  }
  if (name) {
    where.name = {
      [Op.like]: `%${name}%`,
    };
  }

  const { count, rows } = await UserBoard.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['user_id', 'username', 'email'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const totalPages = Math.ceil(count / limit);

  return {
    boards: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/**
 * Get user board by ID
 * @param {number} id - User board ID
 * @returns {Object} User board object
 */
export const getUserBoardById = async id => {
  const board = await UserBoard.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['user_id', 'username', 'email'],
      },
    ],
  });

  if (!board) {
    throw new NotFoundError('User board not found');
  }

  return board;
};

/**
 * Create a new user board
 * @param {Object} boardData - User board data
 * @returns {Object} Created user board
 */
export const createUserBoard = async boardData => {
  const { user_id, serial_number, name, connected = false } = boardData;

  // Check if user exists
  const user = await User.findByPk(user_id);
  if (!user) {
    throw new ValidationError('user_id does not exist');
  }

  // Check if serial number is unique
  const existingBoard = await UserBoard.findOne({
    where: { serial_number },
  });

  if (existingBoard) {
    throw new ValidationError('Serial number must be unique');
  }

  const board = await UserBoard.create({
    user_id,
    serial_number,
    name,
    connected,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return board;
};

/**
 * Update a user board
 * @param {number} id - User board ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated user board
 */
export const updateUserBoard = async (id, updateData) => {
  const board = await UserBoard.findByPk(id);
  if (!board) {
    throw new NotFoundError('User board not found');
  }

  const { serial_number, name, connected } = updateData;

  // Check if serial number is unique (if being updated)
  if (serial_number && serial_number !== board.serial_number) {
    const existingBoard = await UserBoard.findOne({
      where: { serial_number },
    });

    if (existingBoard) {
      throw new ValidationError('Serial number must be unique');
    }
  }

  const updateFields = {};
  if (serial_number !== undefined) updateFields.serial_number = serial_number;
  if (name !== undefined) updateFields.name = name;
  if (connected !== undefined) updateFields.connected = connected;

  updateFields.updated_at = new Date();

  await board.update(updateFields);
  return board;
};

/**
 * Delete a user board
 * @param {number} id - User board ID
 * @returns {boolean} Success status
 */
export const deleteUserBoard = async id => {
  const board = await UserBoard.findByPk(id);
  if (!board) {
    throw new NotFoundError('User board not found');
  }

  await board.destroy();
  return true;
};

/**
 * Get boards by user ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated user boards
 */
export const getBoardsByUserId = async (userId, options = {}) => {
  return listUserBoards({
    ...options,
    user_id: userId,
  });
};

/**
 * Update board connection status
 * @param {number} id - User board ID
 * @param {boolean} connected - Connection status
 * @returns {Object} Updated user board
 */
export const updateConnectionStatus = async (id, connected) => {
  const board = await UserBoard.findByPk(id);
  if (!board) {
    throw new NotFoundError('User board not found');
  }

  await board.update({
    connected,
    updated_at: new Date(),
  });

  return board;
};

/**
 * Get connected boards
 * @param {Object} options - Query options
 * @returns {Object} Paginated connected boards
 */
export const getConnectedBoards = async (options = {}) => {
  return listUserBoards({
    ...options,
    connected: true,
  });
};

/**
 * Get disconnected boards
 * @param {Object} options - Query options
 * @returns {Object} Paginated disconnected boards
 */
export const getDisconnectedBoards = async (options = {}) => {
  return listUserBoards({
    ...options,
    connected: false,
  });
};
