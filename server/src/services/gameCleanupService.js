import { Op } from 'sequelize';
import Game from '../models/Game.js';
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

export async function cleanupExpiredGames() {
  try {
    const now = Date.now();

    const openGames = await Game.findAll({
      where: {
        status: { [Op.in]: ['waiting', 'active'] },
        ended_at: null,
      },
      attributes: ['id', 'initial_time', 'status', 'started_at', 'created_at'],
    });

    if (!openGames.length) {
      return 0;
    }

    const staleIds = [];

    for (const game of openGames) {
      const startedAtMs = new Date(game.started_at || game.created_at).getTime();
      if (Number.isNaN(startedAtMs)) {
        continue;
      }

      const ageSeconds = Math.floor((now - startedAtMs) / 1000);
      const staleAfterSeconds = getStaleTimeoutSeconds(game.initial_time);

      if (ageSeconds >= staleAfterSeconds) {
        staleIds.push(game.id);
      }
    }

    if (!staleIds.length) {
      return 0;
    }

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
      logger.info(`Closed ${updatedCount} stale game(s) automatically`);
    }

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

