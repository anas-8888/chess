import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import User from '../models/User.js';
import Session from '../models/Session.js';
import config from '../../config/index.js';

// JWT configuration from config
const { secret: JWT_SECRET, expiresIn: JWT_EXPIRES_IN } = config.jwt;

// Session management configuration
const SESSION_POLICY = {
  // 'single': Allow only one session per user (revoke others)
  // 'multiple': Allow multiple sessions (current behavior)
  // 'limited': Allow limited number of sessions
  type: process.env.SESSION_POLICY || 'multiple',
  maxSessions: parseInt(process.env.MAX_SESSIONS) || 5,
};

// Validation functions
const validatePassword = password => {
  const minLength = 6;

  if (password.length < minLength) {
    throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  }

  return true;
};

const validateUsername = username => {
  if (username.length < 3 || username.length > 50) {
    throw new Error('اسم المستخدم يجب أن يكون بين 3 و 50 حرف');
  }
  // Allow letters, numbers, spaces, underscores, and Arabic characters
  if (!/^[a-zA-Z0-9_\u0600-\u06FF\s]+$/.test(username)) {
    throw new Error(
      'اسم المستخدم يمكن أن يحتوي على أحرف وأرقام ومسافات وشرطة سفلية وأحرف عربية فقط'
    );
  }
  return true;
};

const validateEmail = email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('صيغة البريد الإلكتروني غير صحيحة');
  }
  return true;
};

export async function registerUser(data) {
  try {
    const { username, email, password } = data;

    // Validate input data
    validateUsername(username);
    validateEmail(email);
    validatePassword(password);

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { username: username }, // Check exact username (case-sensitive)
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        throw new Error('البريد الإلكتروني مستخدم بالفعل');
      }
      if (existingUser.username === username) {
        throw new Error('اسم المستخدم مستخدم بالفعل');
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      username: username, // Keep original case and spaces
      email: email.toLowerCase(),
      password_hash: passwordHash,
      type: 'user',
      rank: 1200,
      puzzle_level: 1,
      state: 'online',
    });

    // Generate JWT token
    const token = generateToken({
      user_id: user.user_id,
      username: user.username,
      type: user.type,
    });

    // Calculate session expiration based on JWT expiration
    const expiresInMs = parseExpiresIn(JWT_EXPIRES_IN);

    // Manage existing sessions based on policy
    await manageExistingSessions(user.user_id, token);

    // Create session
    await Session.create({
      id: token,
      user_id: user.user_id,
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      expires_at: new Date(Date.now() + expiresInMs),
      last_activity: new Date(),
    });

    // Return user data (without password) and token
    const userResponse = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      type: user.type,
      rank: user.rank,
      puzzle_level: user.puzzle_level,
      state: user.state,
      thumbnail: user.thumbnail,
      created_at: user.created_at,
    };

    return {
      user: userResponse,
      token,
    };
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = {};
      error.errors.forEach(err => {
        validationErrors[err.path] = err.message;
      });
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }
    throw error;
  }
}

export async function authenticateUser(data) {
  const { username, email, password } = data;
  
  if (!password) {
    throw new Error('كلمة المرور مطلوبة');
  }

  // Support both username and email login
  if (!username && !email) {
    throw new Error('اسم المستخدم أو البريد الإلكتروني مطلوب');
  }

  // Build where clause for user lookup
  const whereClause = {};
  if (username) {
    whereClause.username = username; // Keep original case and spaces
  } else if (email) {
    whereClause.email = email.toLowerCase();
  }

  const user = await User.findOne({ where: whereClause });
  
  if (!user) {
    throw new Error('بيانات الدخول غير صحيحة');
  }
  
  if (user.deleted_at) {
    throw new Error('تم حذف الحساب');
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('بيانات الدخول غير صحيحة');
  }
  
  // await user.update({ state: 'online' }); // تم التعليق: الحالة ستحدث عند الاتصال socket فقط
  
  const token = generateToken({
    user_id: user.user_id,
    username: user.username,
    type: user.type,
  });
  
  const expiresInMs = parseExpiresIn(JWT_EXPIRES_IN);
  await manageExistingSessions(user.user_id, token);
  
  await Session.upsert({
    id: token,
    user_id: user.user_id,
    ip_address: data.ip_address || null,
    user_agent: data.user_agent || null,
    expires_at: new Date(Date.now() + expiresInMs),
    last_activity: new Date(),
  });
  
  const userResponse = {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    type: user.type,
    rank: user.rank,
    puzzle_level: user.puzzle_level,
    state: user.state,
    thumbnail: user.thumbnail,
    created_at: user.created_at,
  };

  return {
    user: userResponse,
    token,
  };
}

export async function logoutUser(userId, token) {
  console.log('Logout attempt:', {
    userId,
    token: token ? 'present' : 'missing',
  });
  if (!userId) {
    throw new Error('معرف المستخدم مطلوب');
  }
  await User.update({ state: 'offline' }, { where: { user_id: userId } });
  console.log('User state updated to offline for user:', userId);
  if (token) {
    const deletedSessions = await Session.destroy({ where: { id: token } });
    console.log('Sessions deleted:', deletedSessions);
  }
  return true;
}

export async function refreshToken(oldToken) {
  // 1) تأكد من صحة oldToken ونبّهه إذا انتهت صلاحيته
  const decoded = verifyToken(oldToken);
  const user = await User.findByPk(decoded.user_id);
  if (!user || user.deleted_at) throw new Error('المستخدم غير موجود');
  const oldSession = await Session.findOne({ where: { id: oldToken } });
  const sessionData = oldSession
    ? {
        ip_address: oldSession.ip_address,
        user_agent: oldSession.user_agent,
      }
    : {
        ip_address: null,
        user_agent: null,
      };
  await Session.destroy({ where: { id: oldToken } });
  const newToken = generateToken({
    user_id: user.user_id,
    username: user.username,
    type: user.type,
  });
  const expiresInMs = parseExpiresIn(JWT_EXPIRES_IN);
  await Session.create({
    id: newToken,
    user_id: user.user_id,
    ip_address: sessionData.ip_address,
    user_agent: sessionData.user_agent,
    expires_at: new Date(Date.now() + expiresInMs),
    last_activity: new Date(),
  });
  return newToken;
}

export async function validateSession(token) {
  const decoded = verifyToken(token);
  const session = await Session.findOne({
    where: {
      id: token,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!session) {
    throw new Error('انتهت صلاحية الجلسة أو غير صحيحة');
  }
  await session.update({ last_activity: new Date() });
  const user = await User.findByPk(decoded.user_id);
  if (!user || user.deleted_at) {
    throw new Error('المستخدم غير موجود');
  }
  return {
    user_id: user.user_id,
    username: user.username,
    type: user.type,
  };
}

// Helper function to generate JWT token
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'smart-chess-api',
    audience: 'smart-chess-users',
  });
}

// Helper function to verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'smart-chess-api',
      audience: 'smart-chess-users',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('انتهت صلاحية الرمز المميز');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('الرمز المميز غير صحيح');
    } else {
      throw new Error('فشل في التحقق من الرمز المميز');
    }
  }
}

// Helper function to hash password
export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Helper function to compare password
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Helper function to clean expired sessions
export async function cleanExpiredSessions() {
  try {
    const deletedCount = await Session.destroy({
      where: {
        expires_at: { [Op.lt]: new Date() },
      },
    });

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired sessions`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning expired sessions:', error);
    return 0;
  }
}

// Schedule automatic cleanup every hour
export function scheduleSessionCleanup() {
  setInterval(
    async () => {
      try {
        await cleanExpiredSessions();
      } catch (error) {
        console.error('Scheduled session cleanup failed:', error);
      }
    },
    60 * 60 * 1000
  ); // Run every hour
}

// Helper function to parse expiresIn string to milliseconds
function parseExpiresIn(expiresIn) {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1));

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // Default to 24 hours
  }
}

// Get user sessions
export async function getUserSessions(userId) {
  try {
    const sessions = await Session.findAll({
      where: { user_id: userId },
      order: [['last_activity', 'DESC']],
      attributes: [
        'id',
        'ip_address',
        'user_agent',
        'created_at',
        'last_activity',
        'expires_at',
      ],
    });

    return sessions.map(session => ({
      session_id: session.id,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      created_at: session.created_at,
      last_activity: session.last_activity,
      expires_at: session.expires_at,
      is_active: session.expires_at > new Date(),
    }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    throw new Error('فشل في جلب جلسات المستخدم');
  }
}

// Revoke a specific session
export async function revokeSession(sessionId, userId) {
  try {
    const session = await Session.findOne({
      where: { id: sessionId, user_id: userId },
    });

    if (!session) {
      throw new Error('الجلسة غير موجودة');
    }

    await session.destroy();
    return true;
  } catch (error) {
    console.error('Error revoking session:', error);
    throw new Error('فشل في إلغاء الجلسة');
  }
}

// Revoke all other sessions for a user (keep current session)
export async function revokeAllOtherSessions(userId, currentSessionId) {
  try {
    const deletedCount = await Session.destroy({
      where: {
        user_id: userId,
        id: { [Op.ne]: currentSessionId },
      },
    });

    console.log(`Revoked ${deletedCount} other sessions for user ${userId}`);
    return deletedCount;
  } catch (error) {
    console.error('Error revoking all other sessions:', error);
    throw new Error('فشل في إلغاء الجلسات الأخرى');
  }
}

// Manage existing sessions based on policy
async function manageExistingSessions(userId, _newToken) {
  try {
    console.log(
      `🔄 Managing sessions for user ${userId} with policy: ${SESSION_POLICY.type}`
    );

    switch (SESSION_POLICY.type) {
      case 'single': {
        // Delete all existing sessions for this user
        const deletedCount = await Session.destroy({
          where: { user_id: userId },
        });
        console.log(
          `🗑️ Deleted ${deletedCount} existing sessions for single session policy`
        );
        break;
      }
      case 'limited': {
        // Keep only the most recent sessions up to maxSessions
        const existingSessions = await Session.findAll({
          where: { user_id: userId },
          order: [['last_activity', 'DESC']],
        });

        if (existingSessions.length >= SESSION_POLICY.maxSessions) {
          const sessionsToDelete = existingSessions.slice(SESSION_POLICY.maxSessions - 1);
          const sessionIdsToDelete = sessionsToDelete.map(session => session.id);
          
          const deletedCount = await Session.destroy({
            where: { id: sessionIdsToDelete },
          });
          
          console.log(
            `🗑️ Deleted ${deletedCount} old sessions to maintain limit of ${SESSION_POLICY.maxSessions}`
          );
        }
        break;
      }
      case 'multiple':
      default: {
        // Allow multiple sessions - no cleanup needed
        console.log('✅ Multiple sessions allowed - no cleanup needed');
        break;
      }
    }
  } catch (error) {
    console.error('❌ Error managing existing sessions:', error);
    // Don't throw error - session management failure shouldn't break login
  }
}