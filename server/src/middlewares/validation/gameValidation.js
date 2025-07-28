import { param, body } from 'express-validator';
import { handleValidationErrors } from './userBoardValidation.js';

// التحقق من صحة معرف اللعبة
export const validateGameId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('معرف اللعبة يجب أن يكون رقم صحيح موجب'),
  handleValidationErrors
];

// التحقق من صحة بيانات تحديث الوقت
export const validateUpdateTime = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('معرف اللعبة يجب أن يكون رقم صحيح موجب'),
  body('whiteTimeLeft')
    .isInt({ min: 0 })
    .withMessage('الوقت المتبقي للاعب الأبيض يجب أن يكون رقم صحيح موجب'),
  body('blackTimeLeft')
    .isInt({ min: 0 })
    .withMessage('الوقت المتبقي للاعب الأسود يجب أن يكون رقم صحيح موجب'),
  body('currentTurn')
    .isIn(['white', 'black'])
    .withMessage('الدور الحالي يجب أن يكون إما white أو black'),
  handleValidationErrors
]; 