import Puzzle from '../models/Puzzle.js';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler.js';
import { Op } from 'sequelize';

/**
 * Get all puzzles with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.level - Filter by level
 * @param {string} options.name - Filter by name
 * @returns {Object} Paginated puzzles
 */
export const listPuzzles = async (options = {}) => {
  const { page = 1, limit = 10, level, name } = options;

  const offset = (page - 1) * limit;
  const where = {};

  if (level) {
    where.level = level;
  }
  if (name) {
    where.name = {
      [Op.like]: `%${name}%`,
    };
  }

  const { count, rows } = await Puzzle.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const totalPages = Math.ceil(count / limit);

  return {
    puzzles: rows,
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
 * Get puzzle by ID
 * @param {number} id - Puzzle ID
 * @returns {Object} Puzzle object
 */
export const getPuzzleById = async id => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle) {
    throw new NotFoundError('Puzzle not found');
  }

  return puzzle;
};

/**
 * Create a new puzzle
 * @param {Object} puzzleData - Puzzle data
 * @returns {Object} Created puzzle
 */
export const createPuzzle = async puzzleData => {
  const { name, level = 'easy', fen, details, solution } = puzzleData;

  // Validate solution format
  if (!Array.isArray(solution) || solution.length === 0) {
    throw new ValidationError('Solution must be a non-empty array');
  }

  // Basic FEN validation
  if (!fen || typeof fen !== 'string') {
    throw new ValidationError('FEN is required and must be a string');
  }

  const puzzle = await Puzzle.create({
    name,
    level,
    fen,
    details,
    solution,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return puzzle;
};

/**
 * Update a puzzle
 * @param {number} id - Puzzle ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated puzzle
 */
export const updatePuzzle = async (id, updateData) => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle) {
    throw new NotFoundError('Puzzle not found');
  }

  const { name, level, fen, details, solution } = updateData;

  // Validate solution format if provided
  if (solution && (!Array.isArray(solution) || solution.length === 0)) {
    throw new ValidationError('Solution must be a non-empty array');
  }

  // Basic FEN validation if provided
  if (fen && typeof fen !== 'string') {
    throw new ValidationError('FEN must be a string');
  }

  const updateFields = {};
  if (name !== undefined) updateFields.name = name;
  if (level !== undefined) updateFields.level = level;
  if (fen !== undefined) updateFields.fen = fen;
  if (details !== undefined) updateFields.details = details;
  if (solution !== undefined) updateFields.solution = solution;

  updateFields.updated_at = new Date();

  await puzzle.update(updateFields);
  return puzzle;
};

/**
 * Delete a puzzle
 * @param {number} id - Puzzle ID
 * @returns {boolean} Success status
 */
export const deletePuzzle = async id => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle) {
    throw new NotFoundError('Puzzle not found');
  }

  await puzzle.destroy();
  return true;
};

/**
 * Get puzzles by level
 * @param {string} level - Puzzle level
 * @param {Object} options - Query options
 * @returns {Object} Paginated puzzles
 */
export const getPuzzlesByLevel = async (level, options = {}) => {
  return listPuzzles({
    ...options,
    level,
  });
};

/**
 * Get random puzzle
 * @param {string} level - Optional level filter
 * @returns {Object} Random puzzle
 */
export const getRandomPuzzle = async (level = null) => {
  const where = {};
  if (level) {
    where.level = level;
  }

  const puzzle = await Puzzle.findOne({
    where,
    order: Puzzle.sequelize.random(),
  });

  if (!puzzle) {
    throw new NotFoundError('No puzzles found');
  }

  return puzzle;
};

/**
 * Validate puzzle solution
 * @param {number} puzzleId - Puzzle ID
 * @param {Array} userSolution - User's solution moves
 * @returns {Object} Validation result
 */
export const validatePuzzleSolution = async (puzzleId, userSolution) => {
  const puzzle = await getPuzzleById(puzzleId);

  if (!Array.isArray(userSolution)) {
    throw new ValidationError('Solution must be an array');
  }

  const correctSolution = puzzle.solution;
  const isCorrect =
    JSON.stringify(userSolution) === JSON.stringify(correctSolution);

  return {
    isCorrect,
    correctSolution: isCorrect ? null : correctSolution,
    userSolution,
  };
};
