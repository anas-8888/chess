import { formatDate } from './helpers.js';

// نظام تسجيل مركزي لتقليل الضوضاء
class Logger {
  constructor() {
    this.debugMode = process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.messageCache = new Map(); // لتجنب تكرار الرسائل
    this.cacheTimeout = 5000; // 5 ثوان
  }

  // تحويل مستوى التسجيل إلى رقم
  getLevelNumber(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    return levels[level] || 2;
  }

  // التحقق من إمكانية التسجيل
  shouldLog(level) {
    return this.getLevelNumber(level) <= this.getLevelNumber(this.logLevel);
  }

  // فحص تكرار الرسائل
  isMessageRepeated(message, level = 'info') {
    const key = `${level}:${message}`;
    const now = Date.now();
    const lastTime = this.messageCache.get(key);
    
    if (lastTime && (now - lastTime) < this.cacheTimeout) {
      return true;
    }
    
    this.messageCache.set(key, now);
    return false;
  }

  // تنظيف الكاش القديم
  cleanupCache() {
    const now = Date.now();
    for (const [key, time] of this.messageCache.entries()) {
      if (now - time > this.cacheTimeout) {
        this.messageCache.delete(key);
      }
    }
  }

  // تنسيق الرسالة
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data && this.debugMode) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info') && !this.isMessageRepeated(message, 'info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug') && this.debugMode && !this.isMessageRepeated(message, 'debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  // تسجيل خاص للعمليات المتكررة (مثل عدد الأصدقاء)
  logCount(operation, count) {
    const message = `${operation}: ${count} items`;
    if (this.debugMode) {
      this.debug(message);
    } else {
      this.info(message);
    }
  }

  // تسجيل خاص للعمليات المهمة
  logOperation(operation, status = 'completed', data = null) {
    const message = `${operation} ${status}`;
    if (status === 'failed') {
      this.error(message, data);
    } else {
      this.info(message, data);
    }
  }

  // تسجيل خاص للأحداث المتكررة (مثل حالات المستخدم)
  logUserStatus(userId, status) {
    const message = `User ${userId} status: ${status}`;
    if (!this.isMessageRepeated(message, 'info')) {
      this.info(message);
    }
  }

  // تسجيل خاص للألعاب النشطة
  logActiveGame(userId, gameId) {
    const message = `User ${userId} has active game: ${gameId}`;
    if (!this.isMessageRepeated(message, 'info')) {
      this.info(message);
    }
  }
}

// إنشاء instance واحد للاستخدام في التطبيق
const logger = new Logger();

// تنظيف الكاش كل دقيقة
setInterval(() => {
  logger.cleanupCache();
}, 60000);

export default logger;
