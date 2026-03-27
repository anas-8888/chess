import { Op } from 'sequelize';
import Puzzle from '../models/Puzzle.js';
import User from '../models/User.js';
import UserPuzzleProgress from '../models/UserPuzzleProgress.js';
import UserPuzzleAttempt from '../models/UserPuzzleAttempt.js';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler.js';

const LEVELS = ['easy', 'medium', 'hard'];
const MOVE_UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

const normalizeSan = san =>
  String(san || '')
    .replace(/[+#?!\s]/g, '')
    .toLowerCase();

const normalizeUci = uci => String(uci || '').trim().toLowerCase();

const normalizeMoveEntry = (entry, index) => {
  const fallbackActor = index % 2 === 0 ? 'player' : 'opponent';

  if (typeof entry === 'string') {
    const raw = entry.trim();
    if (!raw) return null;
    if (MOVE_UCI_RE.test(raw)) {
      return { raw, actor: fallbackActor, uci: normalizeUci(raw), san: null };
    }
    return { raw, actor: fallbackActor, uci: null, san: normalizeSan(raw) };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const actor =
    entry.actor === 'player' || entry.actor === 'opponent'
      ? entry.actor
      : fallbackActor;
  const rawUci = typeof entry.uci === 'string' ? entry.uci.trim() : '';
  const rawSan = typeof entry.san === 'string' ? entry.san.trim() : '';
  const hasUci = rawUci && MOVE_UCI_RE.test(rawUci);
  const hasSan = !!rawSan;

  if (!hasUci && !hasSan) {
    return null;
  }

  return {
    raw: rawUci || rawSan,
    actor,
    uci: hasUci ? normalizeUci(rawUci) : null,
    san: hasSan ? normalizeSan(rawSan) : null,
  };
};

const normalizeSolution = solution => {
  let parsedSolution = solution;
  if (typeof parsedSolution === 'string') {
    try {
      parsedSolution = JSON.parse(parsedSolution);
    } catch (_error) {
      // keep original; validation below will raise a clear error
    }
  }

  if (!Array.isArray(parsedSolution) || parsedSolution.length === 0) {
    throw new ValidationError('حل اللغز يجب أن يكون مصفوفة حركات غير فارغة');
  }

  const normalized = parsedSolution
    .map((entry, index) => normalizeMoveEntry(entry, index))
    .filter(Boolean);

  if (!normalized.length) {
    throw new ValidationError('تعذر قراءة أي نقلة صحيحة من الحل');
  }

  return normalized;
};

const normalizeClientMove = move => {
  if (!move || typeof move !== 'object') return null;
  const rawUci = typeof move.uci === 'string' ? move.uci.trim() : '';
  const rawSan = typeof move.san === 'string' ? move.san.trim() : '';
  const hasUci = rawUci && MOVE_UCI_RE.test(rawUci);
  const hasSan = !!rawSan;
  if (!hasUci && !hasSan) return null;
  return {
    uci: hasUci ? normalizeUci(rawUci) : null,
    san: hasSan ? normalizeSan(rawSan) : null,
    raw: rawUci || rawSan,
  };
};

const moveMatches = (clientMove, expectedMove) => {
  if (!clientMove || !expectedMove) return false;
  if (expectedMove.uci && clientMove.uci) {
    return expectedMove.uci === clientMove.uci;
  }
  if (expectedMove.san && clientMove.san) {
    return expectedMove.san === clientMove.san;
  }
  if (expectedMove.uci && clientMove.san) {
    return expectedMove.uci === clientMove.san;
  }
  if (expectedMove.san && clientMove.uci) {
    return expectedMove.san === clientMove.uci;
  }
  return false;
};

const toClientPuzzle = (puzzle, includeSolution = false) => {
  const base = {
    id: puzzle.id,
    name: puzzle.name || `لغز #${puzzle.id}`,
    level: puzzle.level,
    fen: puzzle.fen,
    details: puzzle.details || '',
    objective: puzzle.objective || '',
    startsWith: puzzle.starts_with || 'white',
    points: Number(puzzle.points || 10),
    orderIndex: Number(puzzle.order_index || 0),
    isActive: Boolean(puzzle.is_active),
  };

  if (!includeSolution) return base;

  let normalized = [];
  let invalidSolution = false;
  let solutionError = null;

  try {
    normalized = normalizeSolution(puzzle.solution);
  } catch (error) {
    invalidSolution = true;
    solutionError = error instanceof Error ? error.message : 'حل اللغز غير صالح';
  }

  return {
    ...base,
    invalidSolution,
    solutionError,
    solution: normalized.map(move => ({
      actor: move.actor,
      uci: move.uci,
      san: move.san,
      raw: move.raw,
    })),
  };
};

const mapLevelLabel = level => {
  if (level === 'easy') return 'سهل';
  if (level === 'hard') return 'صعب';
  return 'متوسط';
};

const buildWhere = ({ level, name, includeInactive = false }, isAdmin = false) => {
  const where = {};

  if (level) {
    where.level = level;
  }

  if (name) {
    where.name = { [Op.like]: `%${name}%` };
  }

  if (!isAdmin || !includeInactive) {
    where.is_active = true;
  }

  return where;
};

const listAllActivePuzzles = async () => {
  return Puzzle.findAll({
    where: { is_active: true },
    order: [
      ['order_index', 'ASC'],
      ['id', 'ASC'],
    ],
  });
};

const calculateUnlockMap = (puzzles, completedIdsSet) => {
  const unlockMap = new Map();

  puzzles.forEach((puzzle, index) => {
    if (index === 0) {
      unlockMap.set(puzzle.id, true);
      return;
    }
    const prevPuzzle = puzzles[index - 1];
    const unlocked = completedIdsSet.has(prevPuzzle.id);
    unlockMap.set(puzzle.id, unlocked);
  });

  return unlockMap;
};

export const listPuzzles = async (options = {}, isAdmin = false) => {
  const { page = 1, limit = 50, level, name, includeInactive = false } = options;
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const where = buildWhere({ level, name, includeInactive }, isAdmin);

  const { count, rows } = await Puzzle.findAndCountAll({
    where,
    order: [
      ['order_index', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: safeLimit,
    offset,
  });

  const totalPages = Math.ceil(count / safeLimit) || 1;

  return {
    puzzles: rows.map(row => toClientPuzzle(row, isAdmin)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
};

export const getPuzzleById = async (id, isAdmin = false) => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle || (!isAdmin && !puzzle.is_active)) {
    throw new NotFoundError('اللغز غير موجود');
  }

  return toClientPuzzle(puzzle, isAdmin);
};

export const getPlayablePuzzleById = async (id, userId) => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle || !puzzle.is_active) {
    throw new NotFoundError('اللغز غير متاح');
  }

  const activePuzzles = await listAllActivePuzzles();
  const progressRows = await UserPuzzleProgress.findAll({
    where: { user_id: userId },
  });
  const completedIds = new Set(progressRows.filter(p => p.success_count > 0).map(p => p.puzzle_id));
  const unlockMap = calculateUnlockMap(activePuzzles, completedIds);
  if (!unlockMap.get(Number(id))) {
    throw new ValidationError('هذا اللغز مقفل. أكمل اللغز السابق أولاً.');
  }

  const puzzleForClient = toClientPuzzle(puzzle, true);
  const normalizedSolution = normalizeSolution(puzzle.solution);
  const playerSteps = normalizedSolution.filter(step => step.actor === 'player').length;

  return {
    ...puzzleForClient,
    levelLabel: mapLevelLabel(puzzle.level),
    totalSteps: normalizedSolution.length,
    playerSteps,
  };
};

export const createPuzzle = async puzzleData => {
  const {
    name,
    level = 'easy',
    fen,
    details,
    objective,
    startsWith = 'white',
    points = 10,
    orderIndex = 0,
    isActive = true,
    solution,
  } = puzzleData;

  if (!fen || typeof fen !== 'string') {
    throw new ValidationError('FEN مطلوب');
  }
  if (!LEVELS.includes(level)) {
    throw new ValidationError('مستوى اللغز غير صالح');
  }
  if (!['white', 'black'].includes(startsWith)) {
    throw new ValidationError('startsWith يجب أن يكون white أو black');
  }
  normalizeSolution(solution);

  const puzzle = await Puzzle.create({
    name,
    level,
    fen,
    details,
    objective,
    starts_with: startsWith,
    points: Math.max(1, Number(points) || 10),
    order_index: Math.max(0, Number(orderIndex) || 0),
    is_active: Boolean(isActive),
    solution,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return toClientPuzzle(puzzle, true);
};

export const updatePuzzle = async (id, updateData) => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle) {
    throw new NotFoundError('اللغز غير موجود');
  }

  const {
    name,
    level,
    fen,
    details,
    objective,
    startsWith,
    points,
    orderIndex,
    isActive,
    solution,
  } = updateData;

  if (level !== undefined && !LEVELS.includes(level)) {
    throw new ValidationError('مستوى اللغز غير صالح');
  }
  if (startsWith !== undefined && !['white', 'black'].includes(startsWith)) {
    throw new ValidationError('startsWith يجب أن يكون white أو black');
  }
  if (solution !== undefined) {
    normalizeSolution(solution);
  }

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (level !== undefined) patch.level = level;
  if (fen !== undefined) patch.fen = fen;
  if (details !== undefined) patch.details = details;
  if (objective !== undefined) patch.objective = objective;
  if (startsWith !== undefined) patch.starts_with = startsWith;
  if (points !== undefined) patch.points = Math.max(1, Number(points) || 10);
  if (orderIndex !== undefined) patch.order_index = Math.max(0, Number(orderIndex) || 0);
  if (isActive !== undefined) patch.is_active = Boolean(isActive);
  if (solution !== undefined) patch.solution = solution;
  patch.updated_at = new Date();

  await puzzle.update(patch);
  return toClientPuzzle(puzzle, true);
};

export const deletePuzzle = async id => {
  const puzzle = await Puzzle.findByPk(id);
  if (!puzzle) {
    throw new NotFoundError('اللغز غير موجود');
  }
  await puzzle.destroy();
  return true;
};

export const getPuzzlesByLevel = async (level, options = {}, isAdmin = false) => {
  return listPuzzles(
    {
      ...options,
      level,
    },
    isAdmin
  );
};

export const getRandomPuzzle = async (level = null, isAdmin = false) => {
  const where = {};
  if (level) where.level = level;
  if (!isAdmin) where.is_active = true;

  const puzzle = await Puzzle.findOne({
    where,
    order: Puzzle.sequelize.random(),
  });

  if (!puzzle) {
    throw new NotFoundError('لا توجد ألغاز متاحة');
  }

  return toClientPuzzle(puzzle, false);
};

export const validatePuzzleSolution = async (puzzleId, userSolution) => {
  const puzzle = await Puzzle.findByPk(puzzleId);
  if (!puzzle || !puzzle.is_active) {
    throw new NotFoundError('اللغز غير موجود');
  }

  if (!Array.isArray(userSolution)) {
    throw new ValidationError('الحل يجب أن يكون مصفوفة');
  }

  const correctSolution = normalizeSolution(puzzle.solution);
  const userMoves = userSolution.map(normalizeClientMove).filter(Boolean);
  const minLength = Math.min(userMoves.length, correctSolution.length);
  let incorrectAt = -1;

  for (let i = 0; i < minLength; i += 1) {
    if (!moveMatches(userMoves[i], correctSolution[i])) {
      incorrectAt = i + 1;
      break;
    }
  }

  const isLengthValid = userMoves.length === correctSolution.length;
  const isCorrect = incorrectAt < 0 && isLengthValid;

  return {
    isCorrect,
    incorrectAt: incorrectAt > 0 ? incorrectAt : null,
    expectedLength: correctSolution.length,
  };
};

export const checkPuzzleMoveSequence = async (puzzleId, userId, movesInput) => {
  const puzzle = await Puzzle.findByPk(puzzleId);
  if (!puzzle || !puzzle.is_active) {
    throw new NotFoundError('اللغز غير متاح');
  }

  if (!Array.isArray(movesInput)) {
    throw new ValidationError('moves يجب أن تكون مصفوفة');
  }

  const expectedMoves = normalizeSolution(puzzle.solution);
  const userMoves = movesInput.map(normalizeClientMove).filter(Boolean);

  if (!userMoves.length) {
    throw new ValidationError('لا توجد نقلة للتحقق منها');
  }

  if (userMoves.length > expectedMoves.length) {
    return {
      isCorrect: false,
      completed: false,
      message: 'عدد النقلات أكبر من مسار حل اللغز',
      incorrectAt: expectedMoves.length + 1,
    };
  }

  for (let i = 0; i < userMoves.length; i += 1) {
    if (!moveMatches(userMoves[i], expectedMoves[i])) {
      return {
        isCorrect: false,
        completed: false,
        message: 'النقلة غير صحيحة، حاول مرة أخرى',
        incorrectAt: i + 1,
      };
    }
  }

  let cursor = userMoves.length;
  const autoMoves = [];
  while (cursor < expectedMoves.length && expectedMoves[cursor].actor === 'opponent') {
    autoMoves.push({
      index: cursor + 1,
      actor: expectedMoves[cursor].actor,
      uci: expectedMoves[cursor].uci,
      san: expectedMoves[cursor].san,
      raw: expectedMoves[cursor].raw,
    });
    cursor += 1;
  }

  const completed = cursor >= expectedMoves.length;

  return {
    isCorrect: true,
    completed,
    nextIndex: cursor + 1,
    autoMoves,
    message: completed ? 'تم حل اللغز بنجاح' : 'نقلة صحيحة',
  };
};

const getOrCreateProgressRow = async (userId, puzzleId) => {
  const existing = await UserPuzzleProgress.findOne({
    where: { user_id: userId, puzzle_id: puzzleId },
  });

  if (existing) return existing;

  return UserPuzzleProgress.create({
    user_id: userId,
    puzzle_id: puzzleId,
    attempts_count: 0,
    success_count: 0,
    fail_count: 0,
    total_mistakes: 0,
    total_hints_used: 0,
    used_solution_count: 0,
    points_earned: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
};

const updateUserPuzzleLevel = async userId => {
  const activePuzzles = await listAllActivePuzzles();
  const progressRows = await UserPuzzleProgress.findAll({ where: { user_id: userId } });
  const solved = new Set(progressRows.filter(p => p.success_count > 0).map(p => p.puzzle_id));
  const unlockMap = calculateUnlockMap(activePuzzles, solved);
  const unlockedCount = activePuzzles.filter(p => unlockMap.get(p.id)).length;
  const nextPuzzleLevel = Math.max(1, unlockedCount);

  await User.update(
    { puzzle_level: nextPuzzleLevel, updated_at: new Date() },
    { where: { user_id: userId } }
  );
};

export const submitPuzzleAttempt = async (puzzleId, userId, payload = {}) => {
  const puzzle = await Puzzle.findByPk(puzzleId);
  if (!puzzle || !puzzle.is_active) {
    throw new NotFoundError('اللغز غير متاح');
  }

  const status = payload.status;
  if (!['solved', 'failed', 'abandoned'].includes(status)) {
    throw new ValidationError('status يجب أن يكون solved أو failed أو abandoned');
  }

  const moves = Array.isArray(payload.moves) ? payload.moves : [];
  const hintsUsed = Math.max(0, Number(payload.hintsUsed) || 0);
  const usedSolution = Boolean(payload.usedSolution);
  const mistakesCount = Math.max(0, Number(payload.mistakesCount) || 0);
  const elapsedSecondsRaw = Number(payload.elapsedSeconds);
  const elapsedSeconds =
    Number.isFinite(elapsedSecondsRaw) && elapsedSecondsRaw > 0
      ? Math.round(elapsedSecondsRaw)
      : null;

  if (status === 'solved') {
    const puzzleSolution = normalizeSolution(puzzle.solution);
    const userMoves = moves.map(normalizeClientMove).filter(Boolean);

    // حالة 1: العميل أرسل كامل المسار (لاعب + خصم)
    const fullPathIsCorrect = (() => {
      if (userMoves.length !== puzzleSolution.length) return false;
      for (let i = 0; i < puzzleSolution.length; i += 1) {
        if (!moveMatches(userMoves[i], puzzleSolution[i])) {
          return false;
        }
      }
      return true;
    })();

    // حالة 2: العميل أرسل مسار اللاعب فقط (والخصم تم لعبه تلقائياً في الواجهة)
    const playerPathIsCorrect = (() => {
      if (!userMoves.length) return false;
      let userCursor = 0;

      for (let i = 0; i < puzzleSolution.length; i += 1) {
        const expected = puzzleSolution[i];
        const currentUserMove = userMoves[userCursor];

        if (expected.actor === 'player') {
          if (!currentUserMove || !moveMatches(currentUserMove, expected)) {
            return false;
          }
          userCursor += 1;
          continue;
        }

        // Move actor === opponent:
        // إذا العميل أرسل نقلة الخصم أيضاً وكان مطابقاً نستهلكها، وإلا نتجاوزها.
        if (currentUserMove && moveMatches(currentUserMove, expected)) {
          userCursor += 1;
        }
      }

      return userCursor === userMoves.length;
    })();

    if (!fullPathIsCorrect && !playerPathIsCorrect) {
      throw new ValidationError('لا يمكن إنهاء اللغز كـ solved لأن المسار غير صحيح');
    }
  }

  const progressRow = await getOrCreateProgressRow(userId, puzzleId);
  const isFirstSolve = status === 'solved' && progressRow.success_count === 0;
  const puzzlePoints = Math.max(1, Number(puzzle.points || 10));
  const penalty = Math.min(puzzlePoints - 1, hintsUsed + Math.floor(mistakesCount / 2));
  const awarded = status === 'solved' ? Math.max(1, puzzlePoints - penalty) : 0;

  await UserPuzzleAttempt.create({
    user_id: userId,
    puzzle_id: puzzleId,
    status,
    moves_count: moves.length,
    mistakes_count: mistakesCount,
    hints_used: hintsUsed,
    used_solution: usedSolution,
    elapsed_seconds: elapsedSeconds,
    points_awarded: awarded,
    created_at: new Date(),
  });

  const updates = {
    attempts_count: progressRow.attempts_count + 1,
    success_count: progressRow.success_count + (status === 'solved' ? 1 : 0),
    fail_count: progressRow.fail_count + (status !== 'solved' ? 1 : 0),
    total_mistakes: progressRow.total_mistakes + mistakesCount,
    total_hints_used: progressRow.total_hints_used + hintsUsed,
    used_solution_count: progressRow.used_solution_count + (usedSolution ? 1 : 0),
    updated_at: new Date(),
  };

  if (status === 'solved') {
    updates.last_solved_at = new Date();
    updates.first_solved_at = progressRow.first_solved_at || new Date();
    if (elapsedSeconds && (!progressRow.best_time_seconds || elapsedSeconds < progressRow.best_time_seconds)) {
      updates.best_time_seconds = elapsedSeconds;
    }
    if (isFirstSolve) {
      updates.points_earned = progressRow.points_earned + awarded;
    }
  }

  await progressRow.update(updates);
  await updateUserPuzzleLevel(userId);

  const overview = await getPuzzleProgressOverview(userId);
  return {
    status,
    pointsAwarded: awarded,
    firstSolve: isFirstSolve,
    progress: overview,
  };
};

export const getPuzzleProgressOverview = async userId => {
  const puzzles = await listAllActivePuzzles();
  const progressRows = await UserPuzzleProgress.findAll({
    where: { user_id: userId },
  });

  const progressByPuzzle = new Map(progressRows.map(row => [row.puzzle_id, row]));
  const completedIds = new Set(progressRows.filter(p => p.success_count > 0).map(p => p.puzzle_id));
  const unlockMap = calculateUnlockMap(puzzles, completedIds);

  const stats = {
    totalPuzzles: puzzles.length,
    completedPuzzles: 0,
    unlockedPuzzles: 0,
    totalAttempts: 0,
    totalSuccesses: 0,
    totalFails: 0,
    totalPoints: 0,
    successRate: 0,
  };

  const levels = {
    easy: [],
    medium: [],
    hard: [],
  };

  for (const puzzle of puzzles) {
    const progress = progressByPuzzle.get(puzzle.id);
    const completed = Boolean(progress && progress.success_count > 0);
    const unlocked = Boolean(unlockMap.get(puzzle.id));

    stats.completedPuzzles += completed ? 1 : 0;
    stats.unlockedPuzzles += unlocked ? 1 : 0;
    stats.totalAttempts += Number(progress?.attempts_count || 0);
    stats.totalSuccesses += Number(progress?.success_count || 0);
    stats.totalFails += Number(progress?.fail_count || 0);
    stats.totalPoints += Number(progress?.points_earned || 0);

    levels[puzzle.level].push({
      id: puzzle.id,
      name: puzzle.name || `لغز #${puzzle.id}`,
      level: puzzle.level,
      levelLabel: mapLevelLabel(puzzle.level),
      objective: puzzle.objective || '',
      details: puzzle.details || '',
      orderIndex: Number(puzzle.order_index || 0),
      points: Number(puzzle.points || 10),
      status: completed ? 'completed' : unlocked ? 'unlocked' : 'locked',
      attemptsCount: Number(progress?.attempts_count || 0),
      successCount: Number(progress?.success_count || 0),
      bestTimeSeconds: progress?.best_time_seconds || null,
      lastSolvedAt: progress?.last_solved_at || null,
    });
  }

  stats.successRate =
    stats.totalAttempts > 0
      ? Number(((stats.totalSuccesses / stats.totalAttempts) * 100).toFixed(1))
      : 0;

  return {
    stats,
    levels,
    all: [...levels.easy, ...levels.medium, ...levels.hard].sort((a, b) => {
      if (a.orderIndex === b.orderIndex) return a.id - b.id;
      return a.orderIndex - b.orderIndex;
    }),
  };
};
