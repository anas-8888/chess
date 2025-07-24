import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';
import User from '../../models/User.js';
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
 * Validation rules for creating an invite
 */
export const createInviteValidation = [
  body('from_user_id')
    .isInt({ min: 1 })
    .withMessage('from_user_id must be a positive integer')
    .custom(async (value, { req: _req }) => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('from_user_id does not exist');
      }
      return true;
    }),

  body('to_user_id')
    .isInt({ min: 1 })
    .withMessage('to_user_id must be a positive integer')
    .custom(async (value, { req: _req }) => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('to_user_id does not exist');
      }
      return true;
    })
    .custom((value, { req }) => {
      if (value === req.body.from_user_id) {
        throw new Error('from_user_id and to_user_id cannot be the same');
      }
      return true;
    }),

  body('status')
    .optional()
    .isIn(['pending', 'accepted', 'rejected'])
    .withMessage('status must be one of: pending, accepted, rejected'),

  handleValidationErrors,
];

/**
 * Validation rules for updating an invite
 */
export const updateInviteValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid invite ID'),

  body('status')
    .isIn(['pending', 'accepted', 'rejected'])
    .withMessage('status must be one of: pending, accepted, rejected'),

  handleValidationErrors,
];

/**
 * Validation rules for invite ID parameter
 */
export const inviteIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid invite ID'),

  handleValidationErrors,
];

/**
 * Validation rules for invite list query parameters
 */
export const listInvitesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['pending', 'accepted', 'rejected'])
    .withMessage('status must be one of: pending, accepted, rejected'),

  query('from_user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('from_user_id must be a positive integer'),

  query('to_user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('to_user_id must be a positive integer'),

  handleValidationErrors,
];

/**
 * Validation rules for creating a game invite
 */
export const createGameInviteValidation = [
  body('to_user_id')
    .isInt({ min: 1 })
    .withMessage('to_user_id must be a positive integer')
    .custom(async (value, { req: _req }) => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('to_user_id does not exist');
      }
      return true;
    }),

  body('game_type')
    .isIn(['friendly', 'competitive'])
    .withMessage('game_type must be one of: friendly, competitive'),

  body('play_method')
    .isIn(['physical_board', 'phone'])
    .withMessage('play_method must be one of: physical_board, phone'),

  handleValidationErrors,
];
