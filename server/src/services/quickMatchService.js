import Game from '../models/Game.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import {
  hasActivePlayableGame,
  isUserOnline,
  updateUserStatus,
} from '../socket/socketHelpers.js';

const QUICK_MATCH_TICK_MS = 1000;
const QUICK_MATCH_MAX_WAIT_MS = 60000;
const QUICK_MATCH_SOFT_REPEAT_WAIT_MS = 25000;

const queue = new Map();
const recentOpponents = new Map();
let matcherTimer = null;
let namespaceRef = null;

const SEARCH_STEPS = [
  { maxWaitMs: 5000, range: 50 },
  { maxWaitMs: 10000, range: 100 },
  { maxWaitMs: 20000, range: 200 },
  { maxWaitMs: Number.POSITIVE_INFINITY, range: 400 },
];

const normalizePlayMethod = (method) =>
  method === 'physical_board' ? 'physical_board' : 'phone';

const normalizeTimeMinutes = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 3;
  const allowed = [1, 3, 5, 10, 15, 30];
  return allowed.includes(minutes) ? minutes : 3;
};

const resolveSearchRange = (waitMs) => {
  for (const step of SEARCH_STEPS) {
    if (waitMs <= step.maxWaitMs) {
      return step.range;
    }
  }
  return 400;
};

const emitToUser = (userId, event, payload) => {
  if (!namespaceRef) return;
  namespaceRef.to(`user::${userId}`).emit(event, payload);
};

const removeQueueEntry = (userId) => {
  queue.delete(Number(userId));
};

const canPairTogether = async (left, right) => {
  if (!left || !right) return false;
  if (left.userId === right.userId) return false;

  if (left.timeMinutes !== right.timeMinutes) return false;
  if (left.incrementSeconds !== right.incrementSeconds) return false;
  if (left.playMethod !== right.playMethod) return false;

  const now = Date.now();
  const leftWait = now - left.joinedAt;
  const rightWait = now - right.joinedAt;
  const leftRange = resolveSearchRange(leftWait);
  const rightRange = resolveSearchRange(rightWait);
  const ratingGap = Math.abs(left.rating - right.rating);

  if (ratingGap > Math.min(leftRange, rightRange)) {
    return false;
  }

  const leftLastOpponent = recentOpponents.get(left.userId);
  const rightLastOpponent = recentOpponents.get(right.userId);
  const repeatedPair = leftLastOpponent === right.userId || rightLastOpponent === left.userId;

  if (repeatedPair) {
    const bothWaitedEnough =
      leftWait >= QUICK_MATCH_SOFT_REPEAT_WAIT_MS && rightWait >= QUICK_MATCH_SOFT_REPEAT_WAIT_MS;
    if (!bothWaitedEnough) {
      return false;
    }
  }

  if (!isUserOnline(left.userId) || !isUserOnline(right.userId)) {
    return false;
  }

  const [leftActiveGame, rightActiveGame] = await Promise.all([
    hasActivePlayableGame(left.userId),
    hasActivePlayableGame(right.userId),
  ]);

  return !leftActiveGame && !rightActiveGame;
};

const createRankedQuickGame = async (left, right) => {
  const whiteIsLeft = Math.random() < 0.5;
  const whitePlayerId = whiteIsLeft ? left.userId : right.userId;
  const blackPlayerId = whiteIsLeft ? right.userId : left.userId;
  const startedByUserId = left.joinedAt <= right.joinedAt ? left.userId : right.userId;
  const initialTimeSeconds = left.timeMinutes * 60;

  const game = await Game.create({
    white_player_id: whitePlayerId,
    black_player_id: blackPlayerId,
    started_by_user_id: startedByUserId,
    game_type: 'ranked',
    initial_time: initialTimeSeconds,
    white_time_left: initialTimeSeconds,
    black_time_left: initialTimeSeconds,
    white_play_method: left.playMethod,
    black_play_method: right.playMethod,
    current_fen: 'startpos',
    status: 'active',
    current_turn: 'white',
    started_at: new Date(),
  });

  return {
    game,
    initialTimeSeconds,
    whitePlayerId,
    blackPlayerId,
  };
};

const notifyMatchFound = async (left, right) => {
  const [leftUser, rightUser] = await Promise.all([
    User.findByPk(left.userId, { attributes: ['user_id', 'username', 'rank', 'thumbnail'] }),
    User.findByPk(right.userId, { attributes: ['user_id', 'username', 'rank', 'thumbnail'] }),
  ]);

  if (!leftUser || !rightUser) {
    throw new Error('Missing users while building quick match payload');
  }

  const { game, initialTimeSeconds, whitePlayerId, blackPlayerId } = await createRankedQuickGame(left, right);

  await Promise.all([
    updateUserStatus(left.userId, 'in-game', { force: true }),
    updateUserStatus(right.userId, 'in-game', { force: true }),
  ]);

  recentOpponents.set(left.userId, right.userId);
  recentOpponents.set(right.userId, left.userId);

  emitToUser(left.userId, 'quickMatch:found', {
    gameId: game.id,
    playerColor: Number(whitePlayerId) === Number(left.userId) ? 'white' : 'black',
    opponent: {
      id: rightUser.user_id,
      username: rightUser.username,
      rank: rightUser.rank,
      thumbnail: rightUser.thumbnail,
    },
    timeMinutes: left.timeMinutes,
    incrementSeconds: left.incrementSeconds,
    initialTime: initialTimeSeconds,
    countdownSeconds: 3,
  });

  emitToUser(right.userId, 'quickMatch:found', {
    gameId: game.id,
    playerColor: Number(whitePlayerId) === Number(right.userId) ? 'white' : 'black',
    opponent: {
      id: leftUser.user_id,
      username: leftUser.username,
      rank: leftUser.rank,
      thumbnail: leftUser.thumbnail,
    },
    timeMinutes: right.timeMinutes,
    incrementSeconds: right.incrementSeconds,
    initialTime: initialTimeSeconds,
    countdownSeconds: 3,
  });

  logger.info(`Quick match created: game=${game.id}, white=${whitePlayerId}, black=${blackPlayerId}`);
};

const announceSearchProgress = (entry) => {
  const waitMs = Date.now() - entry.joinedAt;
  const nextRange = resolveSearchRange(waitMs);

  if (entry.lastAnnouncedRange !== nextRange) {
    entry.lastAnnouncedRange = nextRange;
    emitToUser(entry.userId, 'quickMatch:searchProgress', {
      range: nextRange,
      waitSeconds: Math.floor(waitMs / 1000),
      timeMinutes: entry.timeMinutes,
      incrementSeconds: entry.incrementSeconds,
    });
  }
};

const cleanupInvalidEntries = async () => {
  const entries = Array.from(queue.values());

  await Promise.all(
    entries.map(async (entry) => {
      const waitMs = Date.now() - entry.joinedAt;

      if (!isUserOnline(entry.userId)) {
        removeQueueEntry(entry.userId);
        return;
      }

      const userActiveGame = await hasActivePlayableGame(entry.userId);
      if (userActiveGame) {
        removeQueueEntry(entry.userId);
        return;
      }

      if (waitMs > QUICK_MATCH_MAX_WAIT_MS) {
        emitToUser(entry.userId, 'quickMatch:notFound', {
          message: 'لم يتم العثور على خصم مناسب حالياً. يمكنك المحاولة ضد الذكاء الاصطناعي.',
          waitSeconds: Math.floor(waitMs / 1000),
        });
        removeQueueEntry(entry.userId);
      }
    })
  );
};

const matchTick = async () => {
  try {
    await cleanupInvalidEntries();

    const entries = Array.from(queue.values()).sort((a, b) => a.joinedAt - b.joinedAt);

    for (const entry of entries) {
      announceSearchProgress(entry);
    }

    const taken = new Set();

    for (let i = 0; i < entries.length; i += 1) {
      const left = entries[i];
      if (!left || taken.has(left.userId) || !queue.has(left.userId)) continue;

      let bestCandidate = null;
      let bestGap = Number.POSITIVE_INFINITY;

      for (let j = i + 1; j < entries.length; j += 1) {
        const right = entries[j];
        if (!right || taken.has(right.userId) || !queue.has(right.userId)) continue;

        const allowed = await canPairTogether(left, right);
        if (!allowed) continue;

        const gap = Math.abs(left.rating - right.rating);
        if (gap < bestGap) {
          bestGap = gap;
          bestCandidate = right;
        }
      }

      if (!bestCandidate) continue;

      taken.add(left.userId);
      taken.add(bestCandidate.userId);
      removeQueueEntry(left.userId);
      removeQueueEntry(bestCandidate.userId);

      try {
        await notifyMatchFound(left, bestCandidate);
      } catch (error) {
        logger.error('Failed to create quick match:', error);
        emitToUser(left.userId, 'quickMatch:error', {
          message: 'حدث خطأ أثناء إنشاء المباراة السريعة. حاول مرة أخرى.',
        });
        emitToUser(bestCandidate.userId, 'quickMatch:error', {
          message: 'حدث خطأ أثناء إنشاء المباراة السريعة. حاول مرة أخرى.',
        });
      }
    }
  } catch (error) {
    logger.error('Quick match tick failed:', error);
  }
};

const ensureMatcherStarted = () => {
  if (matcherTimer) return;
  matcherTimer = setInterval(() => {
    matchTick().catch((error) => {
      logger.error('Quick match loop error:', error);
    });
  }, QUICK_MATCH_TICK_MS);
};

const ensureMatcherStoppedIfIdle = () => {
  if (queue.size === 0 && matcherTimer) {
    clearInterval(matcherTimer);
    matcherTimer = null;
  }
};

export const initQuickMatchService = (namespace) => {
  namespaceRef = namespace;
  ensureMatcherStarted();
};

export const joinQuickMatchQueue = async ({
  userId,
  rating,
  timeMinutes,
  incrementSeconds = 2,
  playMethod = 'phone',
}) => {
  const normalizedUserId = Number(userId);
  const normalizedRating = Number(rating) || 1500;
  const normalizedTime = normalizeTimeMinutes(timeMinutes);
  const normalizedIncrement = Number.isFinite(Number(incrementSeconds))
    ? Math.max(0, Math.floor(Number(incrementSeconds)))
    : 2;

  if (!normalizedUserId) {
    throw new Error('Invalid user ID for quick match');
  }

  const [user, activeGame] = await Promise.all([
    User.findByPk(normalizedUserId, { attributes: ['user_id', 'state'] }),
    hasActivePlayableGame(normalizedUserId),
  ]);

  if (!user) {
    throw new Error('المستخدم غير موجود');
  }

  if (!isUserOnline(normalizedUserId)) {
    throw new Error('يجب أن تكون متصلاً للبحث عن مباراة سريعة');
  }

  if (user.state === 'in-game' || activeGame) {
    throw new Error('لديك مباراة جارية بالفعل');
  }

  const existing = queue.get(normalizedUserId);
  if (existing) {
    return {
      joined: true,
      alreadyQueued: true,
      range: resolveSearchRange(Date.now() - existing.joinedAt),
      waitSeconds: Math.floor((Date.now() - existing.joinedAt) / 1000),
      timeMinutes: existing.timeMinutes,
      incrementSeconds: existing.incrementSeconds,
    };
  }

  const entry = {
    userId: normalizedUserId,
    rating: normalizedRating,
    joinedAt: Date.now(),
    timeMinutes: normalizedTime,
    incrementSeconds: normalizedIncrement,
    playMethod: normalizePlayMethod(playMethod),
    lastAnnouncedRange: null,
  };

  queue.set(normalizedUserId, entry);
  ensureMatcherStarted();

  const range = resolveSearchRange(0);
  entry.lastAnnouncedRange = range;

  return {
    joined: true,
    alreadyQueued: false,
    range,
    waitSeconds: 0,
    timeMinutes: entry.timeMinutes,
    incrementSeconds: entry.incrementSeconds,
  };
};

export const cancelQuickMatchQueue = (userId) => {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) return false;
  const hadEntry = queue.delete(normalizedUserId);
  ensureMatcherStoppedIfIdle();
  return hadEntry;
};

export const isUserInQuickMatchQueue = (userId) => queue.has(Number(userId));

export const handleQuickMatchDisconnect = (userId) => {
  cancelQuickMatchQueue(userId);
};

export const getQuickMatchQueueSize = () => queue.size;