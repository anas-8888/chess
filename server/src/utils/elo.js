const MAX_EXPECTED_DIFF = 400;
const MIN_RATING = 100;
const MAX_RATING = 3500;
export const PLACEMENT_MATCHES = 10;
export const INITIAL_RATING = 1500;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeResult = (result) => {
  const numeric = Number(result);
  if (numeric === 1 || numeric === 0.5 || numeric === 0) {
    return numeric;
  }
  throw new Error('Invalid result. Use 1 (win), 0.5 (draw), or 0 (loss).');
};

export function getDynamicKFactor(rating, gamesPlayed) {
  const totalGames = Number(gamesPlayed) || 0;
  const safeRating = Number(rating) || INITIAL_RATING;

  if (totalGames < PLACEMENT_MATCHES) return 40;
  if (safeRating < 2000) return 20;
  return 10;
}

export function calculateExpectedScore(playerRating, opponentRating) {
  const player = Number(playerRating) || INITIAL_RATING;
  const opponent = Number(opponentRating) || INITIAL_RATING;
  const diff = clamp(opponent - player, -MAX_EXPECTED_DIFF, MAX_EXPECTED_DIFF);
  return 1 / (1 + Math.pow(10, diff / 400));
}

const computeStreakBonus = (result, winStreak = 0) => {
  if (result !== 1) return 0;
  const streak = Number(winStreak) || 0;
  if (streak < 2) return 0;
  // +1 for each win after the second, max +3
  return Math.min(3, streak - 1);
};

export function calculateNewRating(
  playerRating,
  opponentRating,
  result,
  gamesPlayed,
  options = {}
) {
  const safePlayerRating = Number(playerRating) || INITIAL_RATING;
  const safeOpponentRating = Number(opponentRating) || INITIAL_RATING;
  const totalGames = Number(gamesPlayed) || 0;
  const isPlacement = totalGames < PLACEMENT_MATCHES;
  const score = normalizeResult(result);
  const expectedScore = calculateExpectedScore(safePlayerRating, safeOpponentRating);
  const k = getDynamicKFactor(safePlayerRating, totalGames);

  let rawDelta = k * (score - expectedScore);

  // Anti-exploit: strongly-rated player farming much weaker players gets dampened gains.
  if (score === 1 && safePlayerRating - safeOpponentRating >= 300) {
    rawDelta *= 0.65;
  }

  const streakBonus = options.enableStreakBonus
    ? computeStreakBonus(score, options.currentWinStreak)
    : 0;
  rawDelta += streakBonus;

  const delta = Math.round(rawDelta);
  const newRating = clamp(Math.round(safePlayerRating + delta), MIN_RATING, MAX_RATING);

  return {
    oldRating: safePlayerRating,
    opponentRating: safeOpponentRating,
    expectedScore,
    result: score,
    kFactor: k,
    kUsed: k,
    isPlacement,
    gamesPlayed: totalGames,
    delta,
    newRating,
  };
}

export function updateRatings(whiteRating, blackRating, result, whiteGamesPlayed = 0, blackGamesPlayed = 0) {
  let whiteResult = 0.5;
  let blackResult = 0.5;

  if (result === 'WHITE_WIN') {
    whiteResult = 1;
    blackResult = 0;
  } else if (result === 'BLACK_WIN') {
    whiteResult = 0;
    blackResult = 1;
  } else if (result === 'DRAW') {
    whiteResult = 0.5;
    blackResult = 0.5;
  } else {
    throw new Error('Invalid game result');
  }

  const white = calculateNewRating(whiteRating, blackRating, whiteResult, whiteGamesPlayed);
  const black = calculateNewRating(blackRating, whiteRating, blackResult, blackGamesPlayed);

  return {
    white: {
      oldRating: white.oldRating,
      newRating: white.newRating,
      change: white.delta,
    },
    black: {
      oldRating: black.oldRating,
      newRating: black.newRating,
      change: black.delta,
    },
  };
}
