import { validateSession } from '../services/authService.js';
import { formatError, extractToken } from '../utils/helpers.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Main authentication middleware
export const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token)
    return res
      .status(401)
      .json(formatError('Access denied. No token provided.'));

  try {
    const userData = await validateSession(token);
    req.user = userData;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json(formatError(err.message));
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const userData = await validateSession(token);
        req.user = userData;
        req.token = token;
      } catch (error) {
        // Token is invalid but we don't fail the request
        req.user = null;
        req.token = null;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    req.user = null;
    req.token = null;
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json(formatError('Access denied. Authentication required.'));
    }

    if (!roles.includes(req.user.type)) {
      return res
        .status(403)
        .json(formatError('Access denied. Insufficient permissions.'));
    }

    next();
  };
};

// User-only middleware (allows user and admin)
export const userOnly = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json(formatError('Access denied. Authentication required.'));
  }

  // Allow both user and admin types
  if (req.user.type === 'user' || req.user.type === 'admin') {
    return next();
  }

  return res
    .status(403)
    .json(formatError('Access denied. User access required.'));
};

// Admin-only middleware (restricts to admin only)
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json(formatError('Access denied. Authentication required.'));
  }

  // Only allow admin type
  if (req.user.type === 'admin') {
    return next();
  }

  return res
    .status(403)
    .json(formatError('Access denied. Admin access required.'));
};

// Admin middleware (legacy - same as adminOnly)
export const admin = (req, res, next) => {
  return adminOnly(req, res, next);
};

// Check if user is the owner or has admin privileges
export const ownerOrAdmin = (field = 'user_id') => {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[field]);
    const currentUser = req.user;

    // Admin can access any resource
    if (currentUser.type === 'admin') {
      return next();
    }

    // User can only access their own resource
    if (currentUser.user_id === resourceId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.',
      timestamp: new Date().toISOString(),
    });
  };
};

// Rate limiting middleware (basic implementation)
export const rateLimit = (maxRequests = 2000, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (now - value.timestamp > windowMs) {
        requests.delete(key);
      }
    }

    // Check current requests
    const userRequests = requests.get(ip);

    if (!userRequests) {
      requests.set(ip, { count: 1, timestamp: now });
      return next();
    }

    if (now - userRequests.timestamp > windowMs) {
      // Reset window
      requests.set(ip, { count: 1, timestamp: now });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res
        .status(429)
        .json(formatError('Too many requests. Please try again later.'));
    }

    userRequests.count++;
    next();
  };
};

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        timestamp: new Date().toISOString(),
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to ensure they still exist
    const user = await User.findByPk(decoded.user_id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Add user info to request object
    req.user = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      type: user.type,
      rank: user.rank,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        timestamp: new Date().toISOString(),
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        timestamp: new Date().toISOString(),
      });
    }

    next(error);
  }
};

/**
 * Role-based authorization middleware
 * @param {string} requiredRole - Required role ('admin' or 'user')
 * @returns {Function} Middleware function
 */
export const requireRole = requiredRole => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    if (requiredRole === 'admin' && req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Ownership check middleware for UserBoard resources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const checkOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const userType = req.user.type;

    // Admin can access any resource
    if (userType === 'admin') {
      return next();
    }

    // For UserBoard endpoints, check if user owns the board
    if (req.baseUrl.includes('/boards')) {
      const UserBoard = (await import('../models/UserBoard.js')).default;
      const board = await UserBoard.findByPk(id);

      if (!board) {
        return res.status(404).json({
          success: false,
          message: 'Board not found',
          timestamp: new Date().toISOString(),
        });
      }

      if (board.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own boards.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
