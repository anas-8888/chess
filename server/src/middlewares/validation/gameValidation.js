import { param } from 'express-validator';
import { handleValidationErrors } from './userBoardValidation.js';

// التحقق من صحة معرف اللعبة
export const validateGameId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('معرف اللعبة يجب أن يكون رقم صحيح موجب'),
  handleValidationErrors
]; 