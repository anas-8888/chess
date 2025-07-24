// ELO Rating System Implementation
// Classic ELO with K=32

const K_FACTOR = 32;

/**
 * Calculate expected score for player A against player B
 * @param {number} ratingA - Player A's rating
 * @param {number} ratingB - Player B's rating
 * @returns {number} Expected score (0-1)
 */
export function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new rating for a player
 * @param {number} currentRating - Current rating
 * @param {number} expectedScore - Expected score (0-1)
 * @param {number} actualScore - Actual score (0, 0.5, or 1)
 * @returns {number} New rating
 */
export function calculateNewRating(currentRating, expectedScore, actualScore) {
  return Math.round(currentRating + K_FACTOR * (actualScore - expectedScore));
}

/**
 * Calculate rating change for a player
 * @param {number} expectedScore - Expected score (0-1)
 * @param {number} actualScore - Actual score (0, 0.5, or 1)
 * @returns {number} Rating change
 */
export function calculateRatingChange(expectedScore, actualScore) {
  return Math.round(K_FACTOR * (actualScore - expectedScore));
}

/**
 * Update ratings for both players after a game
 * @param {number} whiteRating - White player's current rating
 * @param {number} blackRating - Black player's current rating
 * @param {string} result - Game result: 'WHITE_WIN', 'BLACK_WIN', 'DRAW'
 * @returns {Object} Updated ratings and changes
 */
export function updateRatings(whiteRating, blackRating, result) {
  const expectedWhite = calculateExpectedScore(whiteRating, blackRating);
  const expectedBlack = calculateExpectedScore(blackRating, whiteRating);

  let actualWhite, actualBlack;

  switch (result) {
    case 'WHITE_WIN':
      actualWhite = 1;
      actualBlack = 0;
      break;
    case 'BLACK_WIN':
      actualWhite = 0;
      actualBlack = 1;
      break;
    case 'DRAW':
      actualWhite = 0.5;
      actualBlack = 0.5;
      break;
    default:
      throw new Error('Invalid game result');
  }

  const newWhiteRating = calculateNewRating(
    whiteRating,
    expectedWhite,
    actualWhite
  );
  const newBlackRating = calculateNewRating(
    blackRating,
    expectedBlack,
    actualBlack
  );

  const whiteChange = calculateRatingChange(expectedWhite, actualWhite);
  const blackChange = calculateRatingChange(expectedBlack, actualBlack);

  return {
    white: {
      oldRating: whiteRating,
      newRating: newWhiteRating,
      change: whiteChange,
    },
    black: {
      oldRating: blackRating,
      newRating: newBlackRating,
      change: blackChange,
    },
  };
}
