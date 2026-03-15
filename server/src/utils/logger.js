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
    const normalizedMessage = this.normalizeToEnglish(message);
    const normalizedData = this.normalizeDataToEnglish(data);
    
    if (normalizedData && this.debugMode) {
      return `${prefix} ${normalizedMessage} ${JSON.stringify(normalizedData, null, 2)}`;
    }
    
    return `${prefix} ${normalizedMessage}`;
  }

  normalizeToEnglish(input) {
    if (typeof input !== 'string') {
      return input;
    }

    if (!/[\u0600-\u06FF]/.test(input)) {
      return input;
    }

    const phraseMap = [
      ['تم تحديث إعدادات التسجيل', 'Logging configuration updated'],
      ['تم تعطيل جميع الرسائل التفصيلية', 'All verbose log messages disabled'],
      ['تم تفعيل التسجيل البسيط (الأحداث المهمة فقط)', 'Simple logging enabled (important events only)'],
      ['خطأ في تحديث حالة المستخدم إلى online', 'Failed to update user status to online'],
      ['خطأ في تحديث حالة المستخدم إلى offline', 'Failed to update user status to offline'],
      ['خطأ في إرسال حالة الأصدقاء:', 'Failed to send friends status:'],
      ['خطأ في إرسال تحديث حالة الأصدقاء:', 'Failed to send friends status update:'],
      ['المستخدم غير موجود:', 'User not found:'],
      ['بيانات تحديث حالة المستخدم غير مكتملة:', 'User status update payload is incomplete:'],
      ['حالة مستخدم غير صحيحة:', 'Invalid user status:'],
      ['تم إنشاء مباراة جديدة:', 'New game created:'],
      ['تم إنشاء مباراة جديدة مع طريقتي اللعب:', 'New game created with play methods:'],
      ['إرسال دعوة لعب:', 'Sending game invite:'],
      ['تم إرسال دعوة بنجاح:', 'Game invite sent successfully:'],
      ['رد على دعوة لعب:', 'Game invite response:'],
      ['خطأ في إنشاء المباراة:', 'Failed to create game:'],
      ['خطأ في إنشاء المباراة مع طريقتي اللعب:', 'Failed to create game with play methods:'],
      ['خطأ في إرسال دعوة لعب:', 'Failed to send game invite:'],
      ['خطأ في الرد على دعوة لعب:', 'Failed to respond to game invite:'],
      ['خطأ في تنظيف الدعوات المنتهية:', 'Failed to clean expired invites:'],
      ['إحصائيات الاتصالات:', 'Connection stats:'],
      ['لا يوجد مستخدمين متصلين حالياً', 'No users are currently connected'],
      ['خطأ في المصادقة:', 'Authentication error:'],
      ['انضمام لاعب لغرفة المباراة:', 'Player joined game room:'],
      ['خطأ في الانضمام لغرفة المباراة:', 'Failed to join game room:'],
      ['مغادرة لاعب لغرفة المباراة:', 'Player left game room:'],
      ['خطأ في مغادرة غرفة المباراة:', 'Failed to leave game room:'],
      ['خطأ في تحديث حالة المستخدم:', 'Failed to update user status:'],
      ['تم تحديث حالة المستخدم', 'User status updated'],
      ['تم إرسال تحديث الحالة لـ', 'Status update sent to'],
      ['خطأ في', 'Error in'],
    ];

    let message = input;
    for (const [ar, en] of phraseMap) {
      message = message.split(ar).join(en);
    }

    // If unmatched Arabic remains, keep original text to avoid broken/empty logs.
    if (/[\u0600-\u06FF]/.test(message)) {
      return input;
    }

    message = message.replace(/\s{2,}/g, ' ').trim();
    return message || input;
  }

  normalizeDataToEnglish(data) {
    if (data == null) {
      return data;
    }

    if (typeof data === 'string') {
      return this.normalizeToEnglish(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.normalizeDataToEnglish(item));
    }

    if (typeof data === 'object') {
      const output = {};
      for (const [key, value] of Object.entries(data)) {
        output[key] = this.normalizeDataToEnglish(value);
      }
      return output;
    }

    return data;
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
