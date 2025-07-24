import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';
import User from '../../models/User.js';
import { ValidationError } from '../errorHandler.js';

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

export const createUserBoardValidation = [
  body('user_id')
    .isInt({ min: 1 })
    .withMessage('user_id must be a positive integer')
    .custom(async value => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('user_id does not exist');
      }
      return true;
    }),

  body('serial_number')
    .trim()
    .notEmpty()
    .withMessage('serial_number is required')
    .isLength({ max: 100 })
    .withMessage('serial_number must be less than 100 characters'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('name must be less than 100 characters'),

  body('connected')
    .optional()
    .isBoolean()
    .withMessage('connected must be a boolean value'),

  handleValidationErrors,
];

export const updateUserBoardValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid board ID'),

  body('serial_number')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('serial_number cannot be empty')
    .isLength({ max: 100 })
    .withMessage('serial_number must be less than 100 characters'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('name must be less than 100 characters'),

  body('connected')
    .optional()
    .isBoolean()
    .withMessage('connected must be a boolean value'),

  handleValidationErrors,
];

export const userBoardIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid board ID'),

  handleValidationErrors,
];

export const listUserBoardsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),

  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('user_id must be a positive integer'),

  query('connected')
    .optional()
    .isBoolean()
    .withMessage('connected must be a boolean value'),

  query('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('name must be between 1 and 100 characters'),

  handleValidationErrors,
];
