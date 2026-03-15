import { QueryTypes } from 'sequelize';
import sequelize from '../models/index.js';
import User from '../models/User.js';
import Game from '../models/Game.js';
import Invite from '../models/Invite.js';
import Session from '../models/Session.js';
import { formatError, formatResponse } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

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
