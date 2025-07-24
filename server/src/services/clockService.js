import { EventEmitter } from 'events';

class GameClock extends EventEmitter {
  constructor(whiteTime, blackTime, timeControl = 'blitz') {
    super();
    this.whiteTime = whiteTime || this.getInitialTime(timeControl);
    this.blackTime = blackTime || this.getInitialTime(timeControl);
    this.currentTurn = 'w';
    this.isRunning = false;
    this.interval = null;
    this.lastUpdate = Date.now();
    this.timeControl = timeControl;
    this.increment = this.getIncrement(timeControl);
  }

  /**
   * الحصول على الوقت الابتدائي حسب نوع اللعبة
   */
  getInitialTime(timeControl) {
    const timeMap = {
      bullet: 60,
      blitz: 300,
      rapid: 900,
      classical: 1800,
    };
    return timeMap[timeControl] || 300;
  }

  /**
   * الحصول على الزيادة الزمنية
   */
  getIncrement(timeControl) {
    const incrementMap = {
      bullet: 0,
      blitz: 0,
      rapid: 10,
      classical: 30,
    };
    return incrementMap[timeControl] || 0;
  }

  /**
   * بدء الساعة
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdate = Date.now();
    
    this.interval = setInterval(() => {
      this.updateTime();
    }, 1000);
    
    this.emit('started');
  }

  /**
   * إيقاف الساعة
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.emit('stopped');
  }

  /**
   * إيقاف مؤقت
   */
  pause() {
    this.stop();
    this.emit('paused');
  }

  /**
   * استئناف الساعة
   */
  resume() {
    this.start();
    this.emit('resumed');
  }

  /**
   * تحديث الوقت
   */
  updateTime() {
    const now = Date.now();
    const elapsed = Math.floor((now - this.lastUpdate) / 1000);
    
    if (this.currentTurn === 'w') {
      this.whiteTime -= elapsed;
      if (this.whiteTime <= 0) {
        this.whiteTime = 0;
        this.stop();
        this.emit('timeout', 'white');
        return;
      }
    } else {
      this.blackTime -= elapsed;
      if (this.blackTime <= 0) {
        this.blackTime = 0;
        this.stop();
        this.emit('timeout', 'black');
        return;
      }
    }
    
    this.lastUpdate = now;
    this.emit('updated', {
      whiteTime: this.whiteTime,
      blackTime: this.blackTime,
      currentTurn: this.currentTurn
    });
  }

  /**
   * تبديل الدور
   */
  switchTurn() {
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    
    // إضافة الزيادة الزمنية إذا كانت متوفرة
    if (this.increment > 0) {
      if (this.currentTurn === 'w') {
        this.whiteTime += this.increment;
      } else {
        this.blackTime += this.increment;
      }
    }
    
    this.lastUpdate = Date.now();
    this.emit('turnSwitched', this.currentTurn);
  }

  /**
   * الحصول على الوقت المتبقي
   */
  getTime(color) {
    return color === 'w' ? this.whiteTime : this.blackTime;
  }

  /**
   * تعيين الوقت
   */
  setTime(color, time) {
    if (color === 'w') {
      this.whiteTime = time;
    } else {
      this.blackTime = time;
    }
    this.emit('timeSet', { color, time });
  }

  /**
   * الحصول على حالة الساعة
   */
  getStatus() {
    return {
      whiteTime: this.whiteTime,
      blackTime: this.blackTime,
      currentTurn: this.currentTurn,
      isRunning: this.isRunning,
      timeControl: this.timeControl,
      increment: this.increment
    };
  }

  /**
   * تنسيق الوقت للعرض
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * تنظيف الموارد
   */
  cleanup() {
    this.stop();
    this.removeAllListeners();
  }
}

// إدارة الساعات النشطة
const activeClocks = new Map();

/**
 * إنشاء ساعة جديدة
 */
export function createClock(gameId, whiteTime, blackTime, timeControl = 'blitz') {
  const clock = new GameClock(whiteTime, blackTime, timeControl);
  activeClocks.set(gameId, clock);
  return clock;
}

/**
 * الحصول على ساعة اللعبة
 */
export function getClock(gameId) {
  return activeClocks.get(gameId);
}

/**
 * إزالة ساعة اللعبة
 */
export function removeClock(gameId) {
  const clock = activeClocks.get(gameId);
  if (clock) {
    clock.cleanup();
    activeClocks.delete(gameId);
  }
}

/**
 * بدء ساعة اللعبة
 */
export function startClock(gameId) {
  const clock = getClock(gameId);
  if (clock) {
    clock.start();
  }
}

/**
 * إيقاف ساعة اللعبة
 */
export function stopClock(gameId) {
  const clock = getClock(gameId);
  if (clock) {
    clock.stop();
  }
}

/**
 * تبديل دور اللعبة
 */
export function switchTurn(gameId) {
  const clock = getClock(gameId);
  if (clock) {
    clock.switchTurn();
  }
}

/**
 * الحصول على حالة الساعة
 */
export function getClockStatus(gameId) {
  const clock = getClock(gameId);
  return clock ? clock.getStatus() : null;
}

/**
 * تنظيف جميع الساعات
 */
export function cleanupAllClocks() {
  for (const [gameId, clock] of activeClocks) {
    clock.cleanup();
  }
  activeClocks.clear();
}

export default GameClock; 