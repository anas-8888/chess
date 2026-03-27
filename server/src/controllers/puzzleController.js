import * as puzzleService from '../services/puzzleService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

export const list = asyncHandler(async (req, res) => {
  const { page, limit, level, name, includeInactive } = req.query;
  const isAdmin = req.user?.type === 'admin';
  const result = await puzzleService.listPuzzles(
    {
      page,
      limit,
      level,
      name,
      includeInactive: includeInactive === '1' || includeInactive === 'true',
    },
    isAdmin
  );

  res.status(200).json(result);
});

export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user?.type === 'admin';
  const puzzle = await puzzleService.getPuzzleById(id, isAdmin);
  res.status(200).json(puzzle);
});

export const getPlayableById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.user_id;
  const puzzle = await puzzleService.getPlayablePuzzleById(id, userId);
  res.status(200).json(puzzle);
});

export const progressOverview = asyncHandler(async (req, res) => {
  const userId = req.user?.user_id;
  const result = await puzzleService.getPuzzleProgressOverview(userId);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req, res) => {
  const puzzleData = req.body;
  const puzzle = await puzzleService.createPuzzle(puzzleData);
  res.status(201).json(puzzle);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const puzzle = await puzzleService.updatePuzzle(id, req.body);
  res.status(200).json(puzzle);
});

export const deletePuzzle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await puzzleService.deletePuzzle(id);
  res.status(200).json({ success: true });
});

export const getByLevel = asyncHandler(async (req, res) => {
  const { level } = req.params;
  const { page, limit, name, includeInactive } = req.query;
  const isAdmin = req.user?.type === 'admin';
  const result = await puzzleService.getPuzzlesByLevel(
    level,
    {
      page,
      limit,
      name,
      includeInactive: includeInactive === '1' || includeInactive === 'true',
    },
    isAdmin
  );
  res.status(200).json(result);
});

export const getRandom = asyncHandler(async (req, res) => {
  const inputLevel = req.query.level || req.params.level;
  let puzzleLevel = inputLevel;
  if (inputLevel === '1') puzzleLevel = 'easy';
  if (inputLevel === '2') puzzleLevel = 'medium';
  if (inputLevel === '3') puzzleLevel = 'hard';
  const isAdmin = req.user?.type === 'admin';
  const puzzle = await puzzleService.getRandomPuzzle(puzzleLevel, isAdmin);
  res.status(200).json(puzzle);
});

export const validateSolution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { solution } = req.body;
  const result = await puzzleService.validatePuzzleSolution(id, solution);
  res.status(200).json(result);
});

export const checkMove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { moves } = req.body;
  const userId = req.user?.user_id;
  const result = await puzzleService.checkPuzzleMoveSequence(id, userId, moves);
  res.status(200).json(result);
});

export const finishAttempt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.user_id;
  const result = await puzzleService.submitPuzzleAttempt(id, userId, req.body || {});
  res.status(200).json(result);
});

export const validateRandomSolution = asyncHandler(async (req, res) => {
  const { level } = req.query;
  const { solution } = req.body;
  const puzzle = await puzzleService.getRandomPuzzle(level);
  const result = await puzzleService.validatePuzzleSolution(puzzle.id, solution);
  res.status(200).json({
    ...result,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      level: puzzle.level,
    },
  });
});

export const validateRandomSolutionByLevel = asyncHandler(async (req, res) => {
  const { level } = req.params;
  const { solution } = req.body;

  let puzzleLevel = level;
  if (level === '1' || level === 'easy') puzzleLevel = 'easy';
  else if (level === '2' || level === 'medium') puzzleLevel = 'medium';
  else if (level === '3' || level === 'hard') puzzleLevel = 'hard';
  else {
    return res.status(400).json({
      success: false,
      message: 'Level must be one of: 1/easy, 2/medium, 3/hard',
    });
  }

  const puzzle = await puzzleService.getRandomPuzzle(puzzleLevel);
  const result = await puzzleService.validatePuzzleSolution(puzzle.id, solution);
  res.status(200).json({
    ...result,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      level: puzzle.level,
    },
  });
});

