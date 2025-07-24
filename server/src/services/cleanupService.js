import { Op } from 'sequelize';
import Invite from '../models/Invite.js';
import User from '../models/User.js';
import Game from '../models/Game.js';
import { testConnection } from '../config/db.js';
import logger from '../utils/logger.js';

// مهمة تنظيف واحدة مجمعة
export async function runCleanupTasks() {
  logger.info('بدء مهام التنظيف...');
  
  try {
    // اختبار الاتصال أولاً
    const isConnected = await testConnection();
    if (!isConnected) {
      logger.error('فشل الاتصال بقاعدة البيانات - تخطي التنظيف');
      return;
    }

    const results = {
      invites: 0,
      users: 0,
      games: 0
    };

    // تنظيف الدعوات المنتهية
    try {
      const expiredInvites = await Invite.findAll({
        where: {
          status: 'pending',
          date_time: {
            [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 ساعة
          }
        }
      });

      if (expiredInvites.length > 0) {
        await Invite.update(
          { status: 'expired' },
          {
            where: {
              id: {
                [Op.in]: expiredInvites.map(invite => invite.id)
              }
            }
          }
        );
        results.invites = expiredInvites.length;
      }
    } catch (error) {
      logger.error('خطأ في تنظيف الدعوات', error);
    }

    // تنظيف حالات المستخدمين المتروكة
    try {
      const inactiveThreshold = new Date(Date.now() - 5 * 60 * 1000);
      
      const inactiveUsers = await User.findAll({
        where: {
          state: 'online',
          updated_at: {
            [Op.lt]: inactiveThreshold
          }
        }
      });

      if (inactiveUsers.length > 0) {
        await User.update(
          { state: 'offline' },
          {
            where: {
              user_id: {
                [Op.in]: inactiveUsers.map(user => user.user_id)
              }
            }
          }
        );
        results.users = inactiveUsers.length;
      }
    } catch (error) {
      logger.error('خطأ في تنظيف حالات المستخدمين', error);
    }

    // تنظيف الألعاب المتروكة
    try {
      const abandonedThreshold = new Date(Date.now() - 30 * 60 * 1000);
      
      const abandonedGames = await Game.findAll({
        where: {
          status: 'in_progress',
          lastTimeUpdate: {
            [Op.lt]: abandonedThreshold
          }
        }
      });

      if (abandonedGames.length > 0) {
        await Game.update(
          { status: 'abandoned' },
          {
            where: {
              id: {
                [Op.in]: abandonedGames.map(game => game.id)
              }
            }
          }
        );
        results.games = abandonedGames.length;
      }
    } catch (error) {
      logger.error('خطأ في تنظيف الألعاب', error);
    }

    // تسجيل النتائج مرة واحدة
    const totalCleaned = results.invites + results.users + results.games;
    if (totalCleaned > 0) {
      logger.info(`تم إكمال التنظيف (${totalCleaned} عنصر)`, results);
    } else {
      logger.info('تم إكمال التنظيف (no changes)');
    }

  } catch (error) {
    logger.error('خطأ عام في مهام التنظيف', error);
  }
}

// تشغيل التنظيف كل 5 دقائق
export function startCleanupScheduler() {
  logger.info('بدء جدولة مهام التنظيف');
  
  // تشغيل التنظيف فوراً
  runCleanupTasks();
  
  // تشغيل التنظيف كل 5 دقائق
  setInterval(runCleanupTasks, 5 * 60 * 1000);
} 