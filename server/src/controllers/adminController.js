import { QueryTypes, Op } from 'sequelize';
import sequelize from '../models/index.js';
import User from '../models/User.js';
import Game from '../models/Game.js';
import Invite from '../models/Invite.js';
import Friend from '../models/Friend.js';
import Session from '../models/Session.js';
import bcrypt from 'bcrypt';
import { formatError, formatResponse } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const ADMIN_USER_ATTRIBUTES = [
  'user_id',
  'username',
  'email',
  'type',
  'is_banned',
  'banned_at',
  'banned_reason',
  'thumbnail',
  'rank',
  'puzzle_level',
  'state',
  'created_at',
  'updated_at',
];

export const getAdminAccess = async (req, res) => {
  return res.status(200).json(
    formatResponse(
      {
        user_id: req.user.user_id,
        username: req.user.username,
        type: req.user.type,
      },
      'تم التحقق من صلاحيات الإدارة بنجاح'
    )
  );
};

export const getAdminStats = async (req, res) => {
  try {
    const [totalUsers, onlineUsers, activeGames, pendingInvites, bannedUsers, gamesPlayedToday] =
      await Promise.all([
        User.count({ where: { deleted_at: null } }),
        User.count({ where: { deleted_at: null, state: 'online', is_banned: false } }),
        Game.count({ where: { status: 'active' } }),
        Invite.count({ where: { deleted_at: null, status: 'pending' } }),
        User.count({ where: { deleted_at: null, is_banned: true } }),
        Game.count({
          where: sequelize.where(
            sequelize.fn('DATE', sequelize.col('started_at')),
            sequelize.fn('CURDATE')
          ),
        }),
      ]);

    return res.status(200).json(
      formatResponse(
        {
          totalUsers,
          onlineUsers,
          activeGames,
          pendingInvites,
          bannedUsers,
          gamesPlayedToday,
        },
        'تم جلب إحصائيات الإدارة بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch admin stats:', error);
    return res.status(500).json(formatError('فشل في جلب إحصائيات الإدارة'));
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const whereParts = ['u.deleted_at IS NULL'];
    const replacements = { limit, offset };

    if (search) {
      whereParts.push('(u.username LIKE :search OR u.email LIKE :search)');
      replacements.search = `%${search}%`;
    }

    const whereClause = whereParts.join(' AND ');

    const users = await sequelize.query(
      `
      SELECT
        u.user_id AS id,
        u.username,
        u.email,
        u.thumbnail AS avatar,
        u.state AS status,
        u.rank AS rating,
        u.type,
        u.is_banned AS banned,
        u.created_at AS joinedAt,
        u.updated_at AS lastActiveAt,
        COALESCE(g.games_played, 0) AS gamesPlayed
      FROM users u
      LEFT JOIN (
        SELECT player_id, COUNT(*) AS games_played
        FROM (
          SELECT white_player_id AS player_id FROM game
          UNION ALL
          SELECT black_player_id AS player_id FROM game
        ) gp
        GROUP BY player_id
      ) g ON g.player_id = u.user_id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const [{ total }] = await sequelize.query(
      `
      SELECT COUNT(*) AS total
      FROM users u
      WHERE ${whereClause}
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json(
      formatResponse(
        {
          items: users,
          pagination: {
            page,
            limit,
            total: Number(total) || 0,
            totalPages: Math.ceil((Number(total) || 0) / limit),
          },
        },
        'تم جلب قائمة المستخدمين بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch admin users:', error);
    return res.status(500).json(formatError('فشل في جلب قائمة المستخدمين'));
  }
};

export const banUserByAdmin = async (req, res) => {
  try {
    const targetUserId = toInt(req.params.id, 0);
    const adminUserId = req.user.user_id;
    const reason = (req.body?.reason || '').trim() || 'تم الحظر من قبل الإدارة';

    if (!targetUserId) {
      return res.status(400).json(formatError('معرف المستخدم غير صالح'));
    }

    if (targetUserId === adminUserId) {
      return res.status(400).json(formatError('لا يمكنك حظر حسابك الحالي'));
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser || targetUser.deleted_at) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    if (targetUser.type === 'admin') {
      return res.status(403).json(formatError('لا يمكن حظر حساب مدير'));
    }

    await targetUser.update({
      is_banned: true,
      banned_at: new Date(),
      banned_reason: reason,
      state: 'offline',
    });

    await Session.destroy({ where: { user_id: targetUserId } });

    return res.status(200).json(formatResponse(null, 'تم حظر المستخدم بنجاح'));
  } catch (error) {
    logger.error('Failed to ban user:', error);
    return res.status(500).json(formatError('فشل في حظر المستخدم'));
  }
};

export const unbanUserByAdmin = async (req, res) => {
  try {
    const targetUserId = toInt(req.params.id, 0);
    if (!targetUserId) {
      return res.status(400).json(formatError('معرف المستخدم غير صالح'));
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser || targetUser.deleted_at) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    await targetUser.update({
      is_banned: false,
      banned_at: null,
      banned_reason: null,
    });

    return res.status(200).json(formatResponse(null, 'تم إلغاء حظر المستخدم بنجاح'));
  } catch (error) {
    logger.error('Failed to unban user:', error);
    return res.status(500).json(formatError('فشل في إلغاء حظر المستخدم'));
  }
};

export const createUserByAdmin = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const type = req.body?.type === 'admin' ? 'admin' : 'user';
    const rank = Math.max(0, Math.min(3000, toInt(req.body?.rank, 1500)));
    const puzzleLevel = Math.max(1, Math.min(10, toInt(req.body?.puzzle_level, 1)));
    const state = ['online', 'offline', 'in-game'].includes(req.body?.state) ? req.body.state : 'offline';
    const thumbnail = (req.body?.thumbnail || '/img/default-avatar.png').toString().trim();

    const normalizedUsername = (username || '').toString().trim().toLowerCase();
    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const rawPassword = (password || '').toString();

    if (!normalizedUsername || !normalizedEmail || !rawPassword) {
      return res.status(400).json(formatError('الاسم والبريد وكلمة المرور مطلوبة'));
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json(formatError('اسم المستخدم قصير جداً'));
    }

    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
      return res.status(400).json(formatError('اسم المستخدم يجب أن يحتوي على حروف/أرقام/شرطة سفلية فقط'));
    }

    if (rawPassword.length < 6) {
      return res.status(400).json(formatError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'));
    }

    const existing = await User.findOne({
      where: {
        [Op.or]: [{ username: normalizedUsername }, { email: normalizedEmail }],
      },
    });
    if (existing) {
      return res.status(409).json(formatError('اسم المستخدم أو البريد مستخدم مسبقاً'));
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const created = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password_hash: passwordHash,
      type,
      rank,
      puzzle_level: puzzleLevel,
      state,
      thumbnail,
    });

    const user = await User.findByPk(created.user_id, { attributes: ADMIN_USER_ATTRIBUTES });
    return res.status(201).json(formatResponse(user, 'تم إنشاء المستخدم بنجاح'));
  } catch (error) {
    logger.error('Failed to create user by admin:', error);
    return res.status(500).json(formatError('فشل في إنشاء المستخدم'));
  }
};

export const updateUserByAdmin = async (req, res) => {
  try {
    const targetUserId = toInt(req.params.id, 0);
    if (!targetUserId) {
      return res.status(400).json(formatError('معرف المستخدم غير صالح'));
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser || targetUser.deleted_at) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    const updates = {};
    const {
      username,
      email,
      password,
      type,
      rank,
      puzzle_level,
      state,
      thumbnail,
      is_banned,
      banned_reason,
    } = req.body || {};

    if (typeof username === 'string') {
      const normalized = username.trim().toLowerCase();
      if (!normalized || normalized.length < 3 || !/^[a-zA-Z0-9_]+$/.test(normalized)) {
        return res.status(400).json(formatError('اسم المستخدم غير صالح'));
      }
      if (normalized !== targetUser.username) {
        const exists = await User.findOne({ where: { username: normalized } });
        if (exists && exists.user_id !== targetUserId) {
          return res.status(409).json(formatError('اسم المستخدم مستخدم مسبقاً'));
        }
      }
      updates.username = normalized;
    }

    if (typeof email === 'string') {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return res.status(400).json(formatError('البريد الإلكتروني غير صالح'));
      }
      if (normalized !== targetUser.email) {
        const exists = await User.findOne({ where: { email: normalized } });
        if (exists && exists.user_id !== targetUserId) {
          return res.status(409).json(formatError('البريد الإلكتروني مستخدم مسبقاً'));
        }
      }
      updates.email = normalized;
    }

    if (typeof password === 'string' && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json(formatError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'));
      }
      updates.password_hash = await bcrypt.hash(password.trim(), 12);
    }

    if (type !== undefined) {
      if (!['user', 'admin'].includes(type)) {
        return res.status(400).json(formatError('نوع المستخدم غير صالح'));
      }
      if (targetUser.user_id === req.user.user_id && type !== 'admin') {
        return res.status(400).json(formatError('لا يمكن تخفيض صلاحية حسابك الحالي'));
      }
      updates.type = type;
    }

    if (rank !== undefined) {
      const safeRank = toInt(rank, NaN);
      if (!Number.isFinite(safeRank) || safeRank < 0 || safeRank > 3000) {
        return res.status(400).json(formatError('التقييم يجب أن يكون بين 0 و 3000'));
      }
      updates.rank = safeRank;
    }

    if (puzzle_level !== undefined) {
      const safePuzzle = toInt(puzzle_level, NaN);
      if (!Number.isFinite(safePuzzle) || safePuzzle < 1 || safePuzzle > 10) {
        return res.status(400).json(formatError('مستوى الألغاز يجب أن يكون بين 1 و 10'));
      }
      updates.puzzle_level = safePuzzle;
    }

    if (state !== undefined) {
      if (!['online', 'offline', 'in-game'].includes(state)) {
        return res.status(400).json(formatError('حالة المستخدم غير صالحة'));
      }
      updates.state = state;
    }

    if (typeof thumbnail === 'string') {
      updates.thumbnail = thumbnail.trim() || '/img/default-avatar.png';
    }

    if (is_banned !== undefined) {
      const banned = Boolean(is_banned);
      updates.is_banned = banned;
      if (banned) {
        updates.banned_at = new Date();
        updates.banned_reason = (banned_reason || 'تم الحظر من قبل الإدارة').toString().slice(0, 255);
        updates.state = 'offline';
      } else {
        updates.banned_at = null;
        updates.banned_reason = null;
      }
    } else if (typeof banned_reason === 'string' && targetUser.is_banned) {
      updates.banned_reason = banned_reason.slice(0, 255);
    }

    await targetUser.update(updates);
    if (updates.is_banned === true) {
      await Session.destroy({ where: { user_id: targetUserId } });
    }

    const user = await User.findByPk(targetUserId, { attributes: ADMIN_USER_ATTRIBUTES });
    return res.status(200).json(formatResponse(user, 'تم تحديث المستخدم بنجاح'));
  } catch (error) {
    logger.error('Failed to update user by admin:', error);
    return res.status(500).json(formatError('فشل في تحديث المستخدم'));
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const targetUserId = toInt(req.params.id, 0);
    if (!targetUserId) {
      return res.status(400).json(formatError('معرف المستخدم غير صالح'));
    }

    if (targetUserId === req.user.user_id) {
      return res.status(400).json(formatError('لا يمكن حذف حسابك الحالي'));
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser || targetUser.deleted_at) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    await targetUser.update({ deleted_at: new Date(), state: 'offline' });
    await Session.destroy({ where: { user_id: targetUserId } });

    return res.status(200).json(formatResponse(null, 'تم حذف المستخدم بنجاح'));
  } catch (error) {
    logger.error('Failed to delete user by admin:', error);
    return res.status(500).json(formatError('فشل في حذف المستخدم'));
  }
};

export const getAdminUserDetails = async (req, res) => {
  try {
    const targetUserId = toInt(req.params.id, 0);
    if (!targetUserId) {
      return res.status(400).json(formatError('معرف المستخدم غير صالح'));
    }

    const user = await sequelize.query(
      `
      SELECT
        u.user_id AS id,
        u.username,
        u.email,
        u.type,
        u.state,
        u.rank,
        u.puzzle_level AS puzzleLevel,
        u.thumbnail AS avatar,
        u.is_banned AS banned,
        u.banned_at AS bannedAt,
        u.banned_reason AS bannedReason,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt
      FROM users u
      WHERE u.user_id = :userId AND u.deleted_at IS NULL
      LIMIT 1
      `,
      {
        replacements: { userId: targetUserId },
        type: QueryTypes.SELECT,
      }
    );

    if (!user.length) {
      return res.status(404).json(formatError('المستخدم غير موجود'));
    }

    const friends = await sequelize.query(
      `
      SELECT
        f.id AS friendshipId,
        f.status,
        f.created_at AS createdAt,
        fu.user_id AS friendId,
        fu.username AS friendUsername,
        fu.thumbnail AS friendAvatar,
        fu.rank AS friendRank,
        fu.state AS friendState
      FROM friend f
      INNER JOIN users fu ON fu.user_id = CASE
        WHEN f.user_id = :userId THEN f.friend_user_id
        ELSE f.user_id
      END
      WHERE (f.user_id = :userId OR f.friend_user_id = :userId)
        AND f.deleted_at IS NULL
      ORDER BY f.created_at DESC
      `,
      {
        replacements: { userId: targetUserId },
        type: QueryTypes.SELECT,
      }
    );

    const games = await sequelize.query(
      `
      SELECT
        g.id,
        g.status,
        g.game_type AS gameType,
        g.initial_time AS initialTime,
        g.white_time_left AS whiteTimeLeft,
        g.black_time_left AS blackTimeLeft,
        g.current_turn AS currentTurn,
        g.winner_id AS winnerId,
        g.started_at AS startedAt,
        g.ended_at AS endedAt,
        wp.username AS whitePlayer,
        bp.username AS blackPlayer,
        COALESCE(mv.movesCount, 0) AS moves
      FROM game g
      INNER JOIN users wp ON wp.user_id = g.white_player_id
      INNER JOIN users bp ON bp.user_id = g.black_player_id
      LEFT JOIN (
        SELECT game_id, COUNT(*) AS movesCount
        FROM game_move
        GROUP BY game_id
      ) mv ON mv.game_id = g.id
      WHERE g.white_player_id = :userId OR g.black_player_id = :userId
      ORDER BY g.created_at DESC
      LIMIT 200
      `,
      {
        replacements: { userId: targetUserId },
        type: QueryTypes.SELECT,
      }
    );

    const [{ counts }] = await sequelize.query(
      `
      SELECT JSON_OBJECT(
        'friendsCount',
        (
          SELECT COUNT(*)
          FROM friend f
          WHERE (f.user_id = :userId OR f.friend_user_id = :userId)
            AND f.deleted_at IS NULL
            AND f.status = 'accepted'
        ),
        'gamesCount',
        (
          SELECT COUNT(*)
          FROM game g
          WHERE g.white_player_id = :userId OR g.black_player_id = :userId
        )
      ) AS counts
      `,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );

    return res.status(200).json(
      formatResponse(
        {
          user: user[0],
          friends,
          games,
          stats: typeof counts === 'string' ? JSON.parse(counts) : counts,
        },
        'تم جلب تفاصيل المستخدم بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch admin user details:', error);
    return res.status(500).json(formatError('فشل في جلب تفاصيل المستخدم'));
  }
};

export const removeFriendByAdmin = async (req, res) => {
  try {
    const userId = toInt(req.params.id, 0);
    const friendId = toInt(req.params.friendId, 0);
    if (!userId || !friendId) {
      return res.status(400).json(formatError('معرفات غير صالحة'));
    }

    const friendship = await Friend.findOne({
      where: {
        deleted_at: null,
        [Op.or]: [
          { user_id: userId, friend_user_id: friendId },
          { user_id: friendId, friend_user_id: userId },
        ],
      },
    });

    if (!friendship) {
      return res.status(404).json(formatError('علاقة الصداقة غير موجودة'));
    }

    await friendship.update({ deleted_at: new Date() });
    return res.status(200).json(formatResponse(null, 'تم حذف الصداقة بنجاح'));
  } catch (error) {
    logger.error('Failed to remove friend by admin:', error);
    return res.status(500).json(formatError('فشل في حذف الصداقة'));
  }
};

export const getAdminGames = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;
    const status = (req.query.status || '').trim();

    const replacements = { limit, offset };
    let whereClause = '1=1';
    if (status) {
      whereClause = 'g.status = :status';
      replacements.status = status;
    }

    const games = await sequelize.query(
      `
      SELECT
        g.id,
        g.status,
        g.game_type AS gameType,
        g.initial_time AS initialTime,
        g.started_at AS startedAt,
        g.ended_at AS endedAt,
        wp.username AS whitePlayer,
        bp.username AS blackPlayer,
        COALESCE(mv.movesCount, 0) AS moves
      FROM game g
      INNER JOIN users wp ON wp.user_id = g.white_player_id
      INNER JOIN users bp ON bp.user_id = g.black_player_id
      LEFT JOIN (
        SELECT game_id, COUNT(*) AS movesCount
        FROM game_move
        GROUP BY game_id
      ) mv ON mv.game_id = g.id
      WHERE ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const [{ total }] = await sequelize.query(
      `
      SELECT COUNT(*) AS total
      FROM game g
      WHERE ${whereClause}
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json(
      formatResponse(
        {
          items: games,
          pagination: {
            page,
            limit,
            total: Number(total) || 0,
            totalPages: Math.ceil((Number(total) || 0) / limit),
          },
        },
        'تم جلب قائمة المباريات بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch admin games:', error);
    return res.status(500).json(formatError('فشل في جلب قائمة المباريات'));
  }
};

export const endGameByAdmin = async (req, res) => {
  try {
    const gameId = toInt(req.params.id, 0);
    if (!gameId) {
      return res.status(400).json(formatError('معرف المباراة غير صالح'));
    }

    const game = await Game.findByPk(gameId);
    if (!game) {
      return res.status(404).json(formatError('المباراة غير موجودة'));
    }

    if (game.status === 'ended') {
      return res.status(200).json(formatResponse(null, 'المباراة منتهية مسبقاً'));
    }

    await game.update({ status: 'ended', ended_at: new Date() });

    return res.status(200).json(formatResponse(null, 'تم إنهاء المباراة بنجاح'));
  } catch (error) {
    logger.error('Failed to end game by admin:', error);
    return res.status(500).json(formatError('فشل في إنهاء المباراة'));
  }
};

export const getAdminGameDetails = async (req, res) => {
  try {
    const gameId = toInt(req.params.id, 0);
    if (!gameId) {
      return res.status(400).json(formatError('معرف المباراة غير صالح'));
    }

    const gameRows = await sequelize.query(
      `
      SELECT
        g.id,
        g.status,
        g.game_type AS gameType,
        g.ai_level AS aiLevel,
        g.initial_time AS initialTime,
        g.white_time_left AS whiteTimeLeft,
        g.black_time_left AS blackTimeLeft,
        g.white_play_method AS whitePlayMethod,
        g.black_play_method AS blackPlayMethod,
        g.current_fen AS currentFen,
        g.current_turn AS currentTurn,
        g.winner_id AS winnerId,
        g.white_rank_change AS whiteRankChange,
        g.black_rank_change AS blackRankChange,
        g.started_at AS startedAt,
        g.ended_at AS endedAt,
        wp.user_id AS whitePlayerId,
        wp.username AS whitePlayer,
        bp.user_id AS blackPlayerId,
        bp.username AS blackPlayer
      FROM game g
      INNER JOIN users wp ON wp.user_id = g.white_player_id
      INNER JOIN users bp ON bp.user_id = g.black_player_id
      WHERE g.id = :gameId
      LIMIT 1
      `,
      { replacements: { gameId }, type: QueryTypes.SELECT }
    );

    if (!gameRows.length) {
      return res.status(404).json(formatError('المباراة غير موجودة'));
    }

    const moves = await sequelize.query(
      `
      SELECT
        gm.id,
        gm.move_number AS moveNumber,
        gm.player_id AS playerId,
        u.username AS playerName,
        gm.uci,
        gm.san,
        gm.fen_after AS fenAfter,
        gm.created_at AS createdAt
      FROM game_move gm
      LEFT JOIN users u ON u.user_id = gm.player_id
      WHERE gm.game_id = :gameId
      ORDER BY gm.move_number ASC, gm.created_at ASC
      `,
      { replacements: { gameId }, type: QueryTypes.SELECT }
    );

    return res.status(200).json(
      formatResponse(
        {
          game: gameRows[0],
          moves,
        },
        'تم جلب تفاصيل المباراة بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch game details by admin:', error);
    return res.status(500).json(formatError('فشل في جلب تفاصيل المباراة'));
  }
};

export const updateGameByAdmin = async (req, res) => {
  try {
    const gameId = toInt(req.params.id, 0);
    if (!gameId) {
      return res.status(400).json(formatError('معرف المباراة غير صالح'));
    }

    const game = await Game.findByPk(gameId);
    if (!game) {
      return res.status(404).json(formatError('المباراة غير موجودة'));
    }

    const updates = {};
    const body = req.body || {};

    if (body.status !== undefined) {
      if (!['waiting', 'active', 'ended'].includes(body.status)) {
        return res.status(400).json(formatError('حالة المباراة غير صالحة'));
      }
      updates.status = body.status;
      if (body.status === 'ended' && !body.ended_at) {
        updates.ended_at = new Date();
      }
      if (body.status !== 'ended' && body.ended_at === null) {
        updates.ended_at = null;
      }
    }

    if (body.current_turn !== undefined) {
      if (!['white', 'black'].includes(body.current_turn)) {
        return res.status(400).json(formatError('الدور الحالي غير صالح'));
      }
      updates.current_turn = body.current_turn;
    }

    const intFields = ['initial_time', 'white_time_left', 'black_time_left', 'winner_id', 'ai_level'];
    for (const field of intFields) {
      if (body[field] !== undefined) {
        if (body[field] === null && field === 'winner_id') {
          updates[field] = null;
          continue;
        }
        const value = toInt(body[field], NaN);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json(formatError(`القيمة ${field} غير صالحة`));
        }
        updates[field] = value;
      }
    }

    if (body.current_fen !== undefined) {
      const fen = String(body.current_fen || '').trim();
      if (!fen) {
        return res.status(400).json(formatError('FEN غير صالح'));
      }
      updates.current_fen = fen.slice(0, 100);
    }

    if (body.game_type !== undefined) {
      if (!['friend', 'ranked', 'ai', 'puzzle'].includes(body.game_type)) {
        return res.status(400).json(formatError('نوع المباراة غير صالح'));
      }
      updates.game_type = body.game_type;
    }

    if (body.white_play_method !== undefined) {
      if (!['phone', 'physical_board'].includes(body.white_play_method)) {
        return res.status(400).json(formatError('طريقة لعب الأبيض غير صالحة'));
      }
      updates.white_play_method = body.white_play_method;
    }

    if (body.black_play_method !== undefined) {
      if (!['phone', 'physical_board'].includes(body.black_play_method)) {
        return res.status(400).json(formatError('طريقة لعب الأسود غير صالحة'));
      }
      updates.black_play_method = body.black_play_method;
    }

    if (body.started_at !== undefined) {
      if (body.started_at === null) {
        updates.started_at = null;
      } else {
        const value = new Date(body.started_at);
        if (Number.isNaN(value.getTime())) {
          return res.status(400).json(formatError('وقت بداية المباراة غير صالح'));
        }
        updates.started_at = value;
      }
    }

    if (body.ended_at !== undefined) {
      if (body.ended_at === null) {
        updates.ended_at = null;
      } else {
        const value = new Date(body.ended_at);
        if (Number.isNaN(value.getTime())) {
          return res.status(400).json(formatError('وقت نهاية المباراة غير صالح'));
        }
        updates.ended_at = value;
      }
    }

    await game.update(updates);
    return res.status(200).json(formatResponse(null, 'تم تحديث المباراة بنجاح'));
  } catch (error) {
    logger.error('Failed to update game by admin:', error);
    return res.status(500).json(formatError('فشل في تحديث المباراة'));
  }
};

export const getAdminInvites = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;
    const status = (req.query.status || '').trim();

    const replacements = { limit, offset };
    const whereParts = ['i.deleted_at IS NULL'];
    if (status) {
      whereParts.push('i.status = :status');
      replacements.status = status;
    }

    const whereClause = whereParts.join(' AND ');

    const invites = await sequelize.query(
      `
      SELECT
        i.id,
        i.status,
        i.time_control AS timeControl,
        i.game_type AS gameType,
        i.play_method AS playMethod,
        i.date_time AS createdAt,
        i.expires_at AS expiresAt,
        i.game_id AS gameId,
        fu.username AS fromUsername,
        tu.username AS toUsername
      FROM invites i
      INNER JOIN users fu ON fu.user_id = i.from_user_id
      INNER JOIN users tu ON tu.user_id = i.to_user_id
      WHERE ${whereClause}
      ORDER BY i.date_time DESC
      LIMIT :limit OFFSET :offset
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const [{ total }] = await sequelize.query(
      `
      SELECT COUNT(*) AS total
      FROM invites i
      WHERE ${whereClause}
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json(
      formatResponse(
        {
          items: invites,
          pagination: {
            page,
            limit,
            total: Number(total) || 0,
            totalPages: Math.ceil((Number(total) || 0) / limit),
          },
        },
        'تم جلب قائمة الدعوات بنجاح'
      )
    );
  } catch (error) {
    logger.error('Failed to fetch admin invites:', error);
    return res.status(500).json(formatError('فشل في جلب قائمة الدعوات'));
  }
};

export const deleteInviteByAdmin = async (req, res) => {
  try {
    const inviteId = toInt(req.params.id, 0);
    if (!inviteId) {
      return res.status(400).json(formatError('معرف الدعوة غير صالح'));
    }

    const invite = await Invite.findByPk(inviteId);
    if (!invite || invite.deleted_at) {
      return res.status(404).json(formatError('الدعوة غير موجودة'));
    }

    await invite.update({
      status: invite.status === 'pending' ? 'expired' : invite.status,
      deleted_at: new Date(),
    });

    return res.status(200).json(formatResponse(null, 'تم حذف الدعوة بنجاح'));
  } catch (error) {
    logger.error('Failed to delete invite by admin:', error);
    return res.status(500).json(formatError('فشل في حذف الدعوة'));
  }
};
