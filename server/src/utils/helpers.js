import { v4 as uuidv4 } from 'uuid';

// Extract token from Authorization header
export function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export function parseToken(header) {
  // TODO: Implement token parsing from Authorization header
  // Format: "Bearer <token>"

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.substring(7); // Remove "Bearer " prefix
}

export function formatResponse(data, message = 'Success') {
  // TODO: Implement standardized response format

  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function validateEmail(email) {
  // TODO: Implement email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password) {
  // TODO: Implement password validation
  // - Minimum 8 characters
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number

  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }
  if (!hasUpperCase) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل');
  }
  if (!hasLowerCase) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل');
  }
  if (!hasNumbers) {
    errors.push('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function generateRandomString(length = 32) {
  // TODO: Implement random string generation
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

export function sanitizeInput(input) {
  // TODO: Implement input sanitization
  // Remove potentially dangerous characters

  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

export function formatError(message, errors = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
}

export function generateSessionId() {
  return `sess-${uuidv4()}`;
}

export function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function getTimeDifference(date1, date2 = new Date()) {
  return Math.floor((date2 - date1) / (1000 * 60));
}

export function isExpired(date) {
  return new Date(date) < new Date();
}

export function paginate(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  return { offset, limit: parseInt(limit) };
}

export function sortBy(sortField = 'created_at', sortOrder = 'DESC') {
  return [[sortField, sortOrder.toUpperCase()]];
}

export function searchQuery(searchTerm, fields) {
  if (!searchTerm) return {};

  const { Op } = require('sequelize');
  const conditions = fields.map(field => ({
    [field]: {
      [Op.like]: `%${searchTerm}%`,
    },
  }));

  return {
    [Op.or]: conditions,
  };
}

export function handleSequelizeError(error) {
  if (error.name === 'SequelizeValidationError') {
    const validationErrors = {};
    error.errors.forEach(err => {
      validationErrors[err.path] = err.message;
    });
    return {
      message: 'فشل في التحقق من البيانات',
      errors: validationErrors,
    };
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.errors[0]?.path;
    return {
      message: `${field} موجود بالفعل`,
      field,
    };
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return {
      message: 'السجل المرجعي غير موجود',
    };
  }

  return {
    message: 'حدث خطأ في قاعدة البيانات',
  };
}

export function validateUsername(username) {
  const errors = [];

  if (username.length < 3 || username.length > 50) {
    errors.push('اسم المستخدم يجب أن يكون بين 3 و 50 حرف');
  }

  if (!/^[a-zA-Z0-9_\u0600-\u06FF\s]+$/.test(username)) {
    errors.push('اسم المستخدم يمكن أن يحتوي على أحرف وأرقام ومسافات وشرطة سفلية وأحرف عربية فقط');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// دالة لتحسين رسائل الخطأ
export const formatDetailedError = (message, error = null) => {
  const errorResponse = {
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
  };

  // إضافة تفاصيل الخطأ في بيئة التطوير
  if (process.env.NODE_ENV === 'development' && error) {
    errorResponse.details = {
      stack: error.stack,
      name: error.name,
      message: error.message,
    };
  }

  return errorResponse;
};

// دالة لتحسين عرض رسائل النجاح
export const formatSuccessResponse = (data, message = 'تمت العملية بنجاح') => {
  return {
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString(),
  };
};
