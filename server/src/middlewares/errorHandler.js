import { formatError } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const BENIGN_STATIC_404_PATTERNS = [
  /^\/sitemap\.xml$/i,
  /^\/robots\.txt$/i,
  /^\/favicon\.ico$/i,
  /^\/apple-touch-icon(?:-precomposed)?\.png$/i,
];

const isExpectedTokenValidationError = (req, error, statusCode) => {
  if (statusCode !== 401) return false;
  if (req.originalUrl !== '/api/auth/validate') return false;

  const message = String(error?.message || '');
  return (
    message.includes('انتهت صلاحية الرمز المميز') ||
    message.includes('الرمز المميز غير صحيح') ||
    message.includes('انتهت صلاحية الجلسة')
  );
};

const isBenignStatic404 = (req, statusCode) => {
  if (statusCode !== 404) return false;
  return BENIGN_STATIC_404_PATTERNS.some((pattern) => pattern.test(req.originalUrl || req.path || ''));
};

/**
 * Central error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const errorHandler = (error, req, res, next) => {
  // تحديد نوع الخطأ ورسالته المناسبة
  let statusCode = Number(error.statusCode || error.status) || 500;
  let message = 'حدث خطأ في الخادم';

  if (error.name === 'ValidationError') {
    statusCode = Number(error.statusCode) || 400;
    message = error.message || 'بيانات غير صحيحة';
  } else if (error.name === 'ConflictError') {
    statusCode = Number(error.statusCode) || 409;
    message = error.message || 'يوجد تعارض في الطلب';
  } else if (error.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'بيانات غير صحيحة';
  } else if (error.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'حدث خطأ في قاعدة البيانات';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'توكن غير صحيح';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'انتهت صلاحية التوكن';
  } else if (error.message) {
    message = error.message;
  }

  const logPayload = {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode,
  };

  // تخفيف ضوضاء اللوغ للحالات المتوقعة
  if (isExpectedTokenValidationError(req, error, statusCode)) {
    logger.warn('Expected token validation failure', {
      ...logPayload,
      stack: undefined,
    });
  } else if (isBenignStatic404(req, statusCode)) {
    logger.debug('Benign static asset not found', {
      ...logPayload,
      stack: undefined,
    });
  } else if (statusCode >= 500) {
    logger.error('Request error', logPayload);
  } else {
    logger.warn('Request warning', {
      ...logPayload,
      stack: undefined,
    });
  }

  res.status(statusCode).json(formatErrorResponse(error, req, statusCode, message));
};

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class ConflictError extends Error {
  constructor(message = 'يوجد تعارض في الطلب') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'المورد المطلوب غير موجود') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'وصول غير مصرح') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'الوصول ممنوع') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends Error {
  constructor(message = 'تم تجاوز الحد المسموح من الطلبات') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// 404 handler for undefined routes
export const notFound = (req, res, next) => {
  const error = new Error(
    `المسار ${req.originalUrl} غير موجود`
  );
  error.statusCode = 404;
  next(error);
};

// Async error wrapper
export const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json(formatError('فشل في التحقق من البيانات', err.errors));
  }
  next(err);
};

// Database error handler
export const databaseErrorHandler = (err, req, res, next) => {
  if (err.name && err.name.startsWith('Sequelize')) {
    logger.error('Database error', err);
    return res.status(500).json(formatError('حدث خطأ في قاعدة البيانات'));
  }
  next(err);
};

// دالة لتحسين عرض رسائل الخطأ
export const formatErrorResponse = (error, req, statusCode = 500, fallbackMessage = 'حدث خطأ في الخادم') => {
  const errorResponse = {
    success: false,
    message: fallbackMessage,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // إضافة تفاصيل الخطأ في بيئة التطوير
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      statusCode,
    };
  }

  return errorResponse;
};

