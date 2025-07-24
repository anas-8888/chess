import {
  registerUser,
  authenticateUser,
  logoutUser,
  refreshToken,
  validateSession,
} from '../services/authService.js';
import { formatResponse, formatError } from '../utils/helpers.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// TODO: Add input validation middleware
// TODO: Add proper error handling

export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json(formatError('جميع الحقول مطلوبة'));
  }

  // Get client information
  const clientData = {
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
  };

  try {
    // Call service to register user
    const result = await registerUser({
      username,
      email,
      password,
      ...clientData,
    });

    // Return success response
    res.status(201).json(formatResponse(result, 'تم تسجيل المستخدم بنجاح'));
  } catch (error) {
    // Handle specific validation errors
    if (error.message.includes('مستخدم بالفعل') || 
        error.message.includes('البريد الإلكتروني') ||
        error.message.includes('اسم المستخدم') ||
        error.message.includes('كلمة المرور') ||
        error.message.includes('صيغة البريد')) {
      return res.status(400).json(formatError(error.message));
    }
    
    // For other errors, return internal server error
    console.error('Registration error:', error);
    return res.status(500).json(formatError('حدث خطأ في الخادم'));
  }
});

export const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!password) {
    return res.status(400).json(formatError('كلمة المرور مطلوبة'));
  }

  // Support both username and email login
  if (!username && !email) {
    return res.status(400).json(formatError('اسم المستخدم أو البريد الإلكتروني مطلوب'));
  }

  // Get client information
  const clientData = {
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
  };

  try {
    // Call service to authenticate user
    const result = await authenticateUser({
      username,
      email,
      password,
      ...clientData,
    });

    // Return JWT token and user data
    res.status(200).json(formatResponse(result, 'تم تسجيل الدخول بنجاح'));
  } catch (error) {
    // Handle specific authentication errors
    if (error.message.includes('بيانات الدخول') ||
        error.message.includes('تم حذف الحساب') ||
        error.message.includes('مطلوب')) {
      return res.status(401).json(formatError(error.message));
    }
    
    // For other errors, return internal server error
    console.error('Login error:', error);
    return res.status(500).json(formatError('حدث خطأ في الخادم'));
  }
});

export const logout = asyncHandler(async (req, res) => {
  // Get user from request (set by auth middleware)
  const userId = req.user?.user_id;
  const token = req.token; // Set by auth middleware

  if (!userId) {
    return res.status(401).json(formatError('المستخدم غير مصادق عليه'));
  }

  // Call service to logout user
  await logoutUser(userId, token);

  // Return success response
  res.status(200).json(formatResponse(null, 'تم تسجيل الخروج بنجاح'));
});

export const refresh = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json(formatError('الرمز المميز مطلوب'));
  }

  // Call service to refresh token
  const newToken = await refreshToken(token);

  // Return new token
  res
    .status(200)
    .json(formatResponse({ token: newToken }, 'تم تحديث الرمز المميز بنجاح'));
});

export const validate = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json(formatError('الرمز المميز مطلوب'));
  }

  // Call service to validate session
  const userData = await validateSession(token);

  // Return user data
  res.status(200).json(formatResponse(userData, 'الرمز المميز صحيح'));
});

// GET endpoint for token validation (for auth-guard.js)
export const validateToken = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json(formatError('لم يتم توفير رمز مميز'));
  }

  try {
    // Call service to validate session
    const userData = await validateSession(token);

    // Return user data
    res.status(200).json(formatResponse(userData, 'الرمز المميز صحيح'));
  } catch (error) {
    res.status(401).json(formatError('الرمز المميز غير صحيح'));
  }
});

// Alias for logout route in index.js
export const logoutController = logout;
