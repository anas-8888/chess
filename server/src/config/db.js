import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import logger from '../utils/logger.js';

// إعدادات الاتصال الموحدة
const dbConfig = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  charset: 'utf8mb4',
  timezone: '+00:00',
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  ssl: config.nodeEnv === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// إنشاء pool واحد موحد
const pool = mysql.createPool(dbConfig);

// معالج الأخطاء المركزي للـ pool
pool.on('error', (err) => {
  logger.error('Database pool error:', err);
  
  switch (err.code) {
    case 'PROTOCOL_CONNECTION_LOST':
      logger.error('Database connection was closed');
      break;
    case 'ER_CON_COUNT_ERROR':
      logger.error('Database has too many connections');
      break;
    case 'ECONNREFUSED':
      logger.error('Database connection was refused');
      break;
    case 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR':
      logger.error('Database connection fatal error');
      break;
    default:
      logger.error('Unknown database error:', err.code);
  }
});

// دالة للحصول على اتصال مع إعادة المحاولة
async function getConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      const connection = await pool.getConnection();
      return connection;
    } catch (error) {
      retries--;
      logger.error(`Database connection attempt failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        throw new Error(`Failed to connect to database after 3 attempts: ${error.message}`);
      }
      
      // انتظار قبل إعادة المحاولة
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// دالة withConn لضمان إدارة الاتصالات بشكل آمن
export async function withConn(fn) {
  let connection;
  try {
    connection = await getConnection();
    const result = await fn(connection);
    return result;
  } catch (error) {
    logger.error('Database operation error:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// دالة query مع مهلة اختيارية
export async function query(sql, params = [], options = {}) {
  const { timeoutMs } = options;
  
  if (timeoutMs) {
    return Promise.race([
      withConn(async (connection) => {
        const [rows] = await connection.query(sql, params);
        return rows;
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
  
  return withConn(async (connection) => {
    const [rows] = await connection.query(sql, params);
    return rows;
  });
}

// دالة لاختبار الاتصال
export async function testConnection() {
  try {
    await withConn(async (connection) => {
      await connection.ping();
    });
    logger.debug('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error.message);
    return false;
  }
}

// دالة لتنظيف الاتصالات عند الإغلاق
export async function cleanupConnections() {
  try {
    await pool.end();
    logger.info('Database connections cleaned up');
  } catch (error) {
    logger.error('Error cleaning up database connections:', error.message);
  }
}

// إعداد معالج الإغلاق
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, cleaning up...');
  await cleanupConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, cleaning up...');
  await cleanupConnections();
  process.exit(0);
});

export default pool; 