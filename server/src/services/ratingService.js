import { Op } from 'sequelize';
import sequelize from '../models/index.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import { calculateNewRating, INITIAL_RATING } from '../utils/elo.js';

const countCompletedGames = async (userId, transaction, excludeGameId = null) => {
  const where = {
    [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
    status: 'ended',
    ended_at: { [Op.ne]: null },
  };

  if (excludeGameId) {
    where.id = { [Op.ne]: Number(excludeGameId) };
  }

  return Game.count({
    where,
    transaction,
  });
};

const countCurrentWinStreak = async (userId, transaction) => {
  const recentGames = await Game.findAll({
    where: {
      [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
      status: 'ended',
      ended_at: { [Op.ne]: null },
    },
    attributes: ['winner_id'],
    order: [['ended_at', 'DESC']],
    limit: 10,
    transaction,
  });

  let streak = 0;
  for (const game of recentGames) {
    if (!game.winner_id || Number(game.winner_id) !== Number(userId)) {
      break;
    }
    streak += 1;
  }
  return streak;
};

export const applyGameRatingChanges = async ({ gameId, winnerId = null, transaction: externalTx = null }) => {
  const ownTransaction = !externalTx;
  const transaction = externalTx || (await sequelize.transaction());

  try {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    // Already applied
    if (game.white_rank_change !== null && game.black_rank_change !== null) {
      if (ownTransaction) await transaction.commit();
      return {
        applied: false,
        reason: 'already_applied',
        whiteDelta: game.white_rank_change,
        blackDelta: game.black_rank_change,
      };
    }

    const whiteUser = await User.findByPk(game.white_player_id, { transaction, lock: transaction.LOCK.UPDATE });
    const blackUser = await User.findByPk(game.black_player_id, { transaction, lock: transaction.LOCK.UPDATE });

    if (!whiteUser || !blackUser) {
      throw new Error('Players not found while applying rating');
    }

    const whiteRating = Number(whiteUser.rank) || INITIAL_RATING;
    const blackRating = Number(blackUser.rank) || INITIAL_RATING;

    let whiteResult = 0.5;
    let blackResult = 0.5;

    if (winnerId) {
      if (Number(winnerId) === Number(game.white_player_id)) {
        whiteResult = 1;
        blackResult = 0;
      } else if (Number(winnerId) === Number(game.black_player_id)) {
        whiteResult = 0;
        blackResult = 1;
      }
    }

    // AI uses virtual opponent rating by difficulty (ai_level), not bot account rank.
    const isAiGame = game.game_type === 'ai';
    const virtualAiRating = Number(game.ai_level) || 1500;
    const aiUserId =
      isAiGame
        ? Number(game.started_by_user_id) === Number(game.white_player_id)
          ? Number(game.black_player_id)
          : Number(game.white_player_id)
        : null;

    const whiteGamesPlayed = await countCompletedGames(game.white_player_id, transaction, game.id);
    const blackGamesPlayed = await countCompletedGames(game.black_player_id, transaction, game.id);
    const whiteWinStreak = await countCurrentWinStreak(game.white_player_id, transaction);
    const blackWinStreak = await countCurrentWinStreak(game.black_player_id, transaction);

    const whiteOpponentRating =
      isAiGame && Number(game.black_player_id) === aiUserId ? virtualAiRating : blackRating;
    const blackOpponentRating =
      isAiGame && Number(game.white_player_id) === aiUserId ? virtualAiRating : whiteRating;

    const whiteCalc = calculateNewRating(whiteRating, whiteOpponentRating, whiteResult, whiteGamesPlayed, {
      enableStreakBonus: true,
      currentWinStreak: whiteWinStreak,
    });

    const blackCalc = calculateNewRating(blackRating, blackOpponentRating, blackResult, blackGamesPlayed, {
      enableStreakBonus: true,
      currentWinStreak: blackWinStreak,
    });

    // Keep AI system account stable; apply only to human side in AI games.
    if (isAiGame && aiUserId) {
      if (Number(game.white_player_id) !== Number(aiUserId)) {
        await whiteUser.update({ rank: whiteCalc.newRating }, { transaction });
      }
      if (Number(game.black_player_id) !== Number(aiUserId)) {
        await blackUser.update({ rank: blackCalc.newRating }, { transaction });
      }
    } else {
      await whiteUser.update({ rank: whiteCalc.newRating }, { transaction });
      await blackUser.update({ rank: blackCalc.newRating }, { transaction });
    }

    await game.update(
      {
        white_rank_change: whiteCalc.delta,
        black_rank_change: blackCalc.delta,
      },
      { transaction }
    );

    if (ownTransaction) await transaction.commit();

    return {
      applied: true,
      gameId: Number(game.id),
      white: {
        userId: Number(game.white_player_id),
        delta: whiteCalc.delta,
        oldRating: whiteCalc.oldRating,
        newRating: whiteCalc.newRating,
        isPlacement: whiteCalc.isPlacement,
        kFactor: whiteCalc.kFactor,
        gamesPlayed: whiteCalc.gamesPlayed,
      },
      black: {
        userId: Number(game.black_player_id),
        delta: blackCalc.delta,
        oldRating: blackCalc.oldRating,
        newRating: blackCalc.newRating,
        isPlacement: blackCalc.isPlacement,
        kFactor: blackCalc.kFactor,
        gamesPlayed: blackCalc.gamesPlayed,
      },
    };
  } catch (error) {
    if (ownTransaction) await transaction.rollback();
    throw error;
  }
};
