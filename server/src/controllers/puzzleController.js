import { formatResponse } from '../utils/helpers.js';
import * as puzzleService from '../services/puzzleService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all puzzles with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const list = asyncHandler(async (req, res) => {
  const { page, limit, level, name } = req.query;
  const result = await puzzleService.listPuzzles({
    page,
    limit,
    level,
    name,
  });

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result.puzzles || result);
});

/**
 * Get puzzle by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const puzzle = await puzzleService.getPuzzleById(id);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(puzzle);
});

/**
 * Create a new puzzle
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const create = asyncHandler(async (req, res) => {
  const puzzleData = req.body;
  const puzzle = await puzzleService.createPuzzle(puzzleData);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(201).json(puzzle);
});

/**
 * Update a puzzle
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const puzzle = await puzzleService.updatePuzzle(id, updateData);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(puzzle);
});

/**
 * Delete a puzzle
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deletePuzzle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await puzzleService.deletePuzzle(id);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
});

/**
 * Get puzzles by level
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getByLevel = asyncHandler(async (req, res) => {
  const { level } = req.params;
  const { page, limit, name } = req.query;
  const result = await puzzleService.getPuzzlesByLevel(level, {
    page,
    limit,
    name,
  });

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result.puzzles || result);
});

/**
 * Get random puzzle
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRandom = asyncHandler(async (req, res) => {
  const { level } = req.query;
  let puzzleLevel = level;

  // Convert numeric levels to string levels
  if (level === '1' || level === 'easy') {
    puzzleLevel = 'easy';
  } else if (level === '2' || level === 'medium') {
    puzzleLevel = 'medium';
  } else if (level === '3' || level === 'hard') {
    puzzleLevel = 'hard';
  }

  const puzzle = await puzzleService.getRandomPuzzle(puzzleLevel);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(puzzle);
});

/**
 * Validate puzzle solution
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const validateSolution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { solution } = req.body;
  const result = await puzzleService.validatePuzzleSolution(id, solution);

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result);
});

/**
 * Validate random puzzle solution
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const validateRandomSolution = asyncHandler(async (req, res) => {
  const { level } = req.query;
  const { solution } = req.body;

  // Get a random puzzle first
  const puzzle = await puzzleService.getRandomPuzzle(level);

  // Validate the solution
  const result = await puzzleService.validatePuzzleSolution(
    puzzle.id,
    solution
  );

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({
    ...result,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      level: puzzle.level,
    },
  });
});

/**
 * Validate random puzzle solution by level
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const validateRandomSolutionByLevel = asyncHandler(async (req, res) => {
  const { level } = req.params;
  const { solution } = req.body;

  // Convert numeric levels to string levels
  let puzzleLevel = level;
  if (level === '1' || level === 'easy') {
    puzzleLevel = 'easy';
  } else if (level === '2' || level === 'medium') {
    puzzleLevel = 'medium';
  } else if (level === '3' || level === 'hard') {
    puzzleLevel = 'hard';
  } else {
    return res.status(400).json({
      success: false,
      message: 'Level must be one of: 1/easy, 2/medium, 3/hard'
    });
  }

  // Get a random puzzle by level
  const puzzle = await puzzleService.getRandomPuzzle(puzzleLevel);

  // Validate the solution
  const result = await puzzleService.validatePuzzleSolution(
    puzzle.id,
    solution
  );

  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({
    ...result,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      level: puzzle.level,
    },
  });
});
