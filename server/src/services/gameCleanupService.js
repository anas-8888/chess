import { Op } from 'sequelize';
import Game from '../models/Game.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const CLEANUP_CONFIG = {
  intervalMs: Number(process.env.GAME_CLEANUP_INTERVAL_MS) || 60_000,
  staleMultiplier: Number(process.env.GAME_STALE_MULTIPLIER) || 3,
  staleGraceSeconds: Number(process.env.GAME_STALE_GRACE_SECONDS) || 300,
  staleMinSeconds: Number(process.env.GAME_STALE_MIN_SECONDS) || 900,
  staleMaxSeconds: Number(process.env.GAME_STALE_MAX_SECONDS) || 43_200, // 12 hours
};

const getStaleTimeoutSeconds = initialTime => {
  const safeInitialTime = Math.max(60, Number(initialTime) || 600);
  const rawTimeout =
    Math.round(safeInitialTime * CLEANUP_CONFIG.staleMultiplier) +
    CLEANUP_CONFIG.staleGraceSeconds;
  return Math.min(
    CLEANUP_CONFIG.staleMaxSeconds,
    Math.max(CLEANUP_CONFIG.staleMinSeconds, rawTimeout)
  );
};

export async function reconcileStaleInGameUsers() {
  try {
    const inGameUsers = await User.findAll({
      where: { state: 'in-game' },
      attributes: ['user_id'],
    });

    if (!inGameUsers.length) {
      return 0;
    }

    const { isUserOnline, updateUserStatus } = await import('../socket/socketHelpers.js');

    let fixedCount = 0;
    await Promise.all(
      inGameUsers.map(async (user) => {
        const userId = Number(user.user_id);
        if (!userId) return;

        const hasActiveGame = await Game.findOne({
          where: {
            [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
            status: { [Op.in]: ['waiting', 'active'] },
          },
          attributes: ['id'],
        });

        if (hasActiveGame) {
          return;
        }

        const nextStatus = isUserOnline(userId) ? 'online' : 'offline';
        await updateUserStatus(userId, nextStatus, { force: true });
        fixedCount += 1;
      })
    );

    if (fixedCount > 0) {
      logger.info(`Reconciled ${fixedCount} stale in-game user state(s)`);
    }

    return fixedCount;
  } catch (error) {
    logger.error('Failed to reconcile stale in-game users:', error);
    return 0;
  }
}

export async function cleanupExpiredGames() {
  try {
    const now = Date.now();

    const openGames = await Game.findAll({
      where: {
        status: { [Op.in]: ['waiting', 'active'] },
        ended_at: null,
      },
      attributes: [
        'id',
        'initial_time',
        'status',
        'started_at',
        'created_at',
        'updated_at',
        'white_player_id',
        'black_player_id',
      ],
    });

    if (!openGames.length) {
      await reconcileStaleInGameUsers();
      return 0;
    }

    const staleIds = [];

    for (const game of openGames) {
      const referenceTimeMs = new Date(game.updated_at || game.started_at || game.created_at).getTime();
      if (Number.isNaN(referenceTimeMs)) {
        continue;
      }

      const ageSeconds = Math.floor((now - referenceTimeMs) / 1000);
      const staleAfterSeconds = getStaleTimeoutSeconds(game.initial_time);

      if (ageSeconds >= staleAfterSeconds) {
        staleIds.push(game.id);
      }
    }

    if (!staleIds.length) {
      await reconcileStaleInGameUsers();
      return 0;
    }

    const staleGames = openGames.filter(game => staleIds.includes(game.id));
    const [updatedCount] = await Game.update(
      {
        status: 'ended',
        winner_id: null,
        ended_at: new Date(),
      },
      {
        where: {
          id: { [Op.in]: staleIds },
          status: { [Op.in]: ['waiting', 'active'] },
        },
      }
    );

    if (updatedCount > 0) {
      const { stopClock, isUserOnline, updateUserStatus } = await import('../socket/socketHelpers.js');

      // إيقاف كل مؤقتات المباريات المنتهية بسبب التقادم حتى لا يستمر العد.
      await Promise.all(
        staleIds.map(gameId =>
          stopClock(gameId).catch(error => {
            logger.error(`Failed to stop stale game clock for game ${gameId}:`, error);
          })
        )
      );

      // تحديث حالة اللاعبين المتأثرين من in-game إلى online/offline حسب اتصالهم الحالي
      // بشرط ألا يكون لديهم مباراة نشطة أخرى.
      const affectedUserIds = Array.from(
        new Set(
          staleGames
            .flatMap(game => [game.white_player_id, game.black_player_id])
            .filter(Boolean)
        )
      );

      await Promise.all(
        affectedUserIds.map(async userId => {
          const hasAnotherActiveGame = await Game.findOne({
            where: {
              [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
              status: { [Op.in]: ['waiting', 'active'] },
            },
            attributes: ['id'],
          });

          if (hasAnotherActiveGame) {
            return;
          }

          const nextStatus = isUserOnline(userId) ? 'online' : 'offline';
          await updateUserStatus(userId, nextStatus, { force: true });
        })
      );

      logger.info(`Closed ${updatedCount} stale game(s) automatically`);
    }

    // إصلاح أي حالات عالقة في in-game حتى لو لم تكن من ضمن staleIds
    await reconcileStaleInGameUsers();

    return updatedCount;
  } catch (error) {
    logger.error('Failed to cleanup stale games:', error);
    return 0;
  }
}

export function scheduleGameCleanup() {
  setInterval(async () => {
    try {
      await cleanupExpiredGames();
    } catch (error) {
      logger.error('Scheduled game cleanup failed:', error);
    }
  }, CLEANUP_CONFIG.intervalMs);
}


