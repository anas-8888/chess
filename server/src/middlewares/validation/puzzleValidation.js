import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';
import { ValidationError } from '../errorHandler.js';

/**
 * Validation result handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map(error => error.msg)
      .join(', ');
    throw new ValidationError(errorMessages);
  }
  next();
};

/**
 * Validation rules for creating a puzzle
 */
export const createPuzzleValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .isLength({ max: 200 })
    .withMessage('name must be less than 200 characters'),

  body('level')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('level must be one of: easy, medium, hard'),

  body('fen')
    .trim()
    .notEmpty()
    .withMessage('fen is required')
    .isLength({ max: 200 })
    .withMessage('fen must be less than 200 characters'),

  body('details')
    .optional()
    .isLength({ max: 200 })
    .withMessage('details must be less than 200 characters'),

  body('solution')
    .isArray({ min: 1 })
    .withMessage('solution must be a non-empty array'),

  handleValidationErrors,
];

/**
 * Validation rules for updating a puzzle
 */
export const updatePuzzleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid puzzle ID'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('name must be less than 200 characters'),

  body('level')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('level must be one of: easy, medium, hard'),

  body('fen')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('fen cannot be empty')
    .isLength({ max: 200 })
    .withMessage('fen must be less than 200 characters'),

  body('details')
    .optional()
    .isLength({ max: 200 })
    .withMessage('details must be less than 200 characters'),

  body('solution')
    .optional()
    .isArray({ min: 1 })
    .withMessage('solution must be a non-empty array'),

  handleValidationErrors,
];

/**
 * Validation rules for puzzle ID parameter
 */
export const puzzleIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid puzzle ID'),

  handleValidationErrors,
];

/**
 * Validation rules for puzzle list query parameters
 */
export const listPuzzlesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),

  query('level')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('level must be one of: easy, medium, hard'),

  query('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('name must be between 1 and 200 characters'),

  handleValidationErrors,
];
