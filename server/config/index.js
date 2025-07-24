import dotenv from 'dotenv';

// تحميل dotenv مرة واحدة في نقطة الدخول
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'smart-chess',
    port: process.env.DB_PORT || 3306,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  session: {
    policy: process.env.SESSION_POLICY || 'single',
    maxSessions: parseInt(process.env.MAX_SESSIONS) || 5,
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    debug: process.env.DEBUG === '1',
  },
  realtime: {
    pingInterval: 25000,
    pingTimeout: 60000,
  },
};
