import Invite from '../models/Invite.js';
import User from '../models/User.js';
import Game from '../models/Game.js';
// import Friend from '../models/Friend.js'; // Removed unused import
import { NotFoundError, ValidationError, ConflictError } from '../middlewares/errorHandler.js';
import sequelize from '../models/index.js';
import { Op } from 'sequelize';

const ACTIVE_GAME_STATUSES = new Set(['waiting', 'active']);

const syncInviteStatusWithGame = async (invites = []) => {
  if (!Array.isArray(invites) || invites.length === 0) {
    return invites;
  }

  const updates = invites
    .filter(
      (invite) =>
        invite.status === 'game_started' &&
        invite.game &&
        !ACTIVE_GAME_STATUSES.has(invite.game.status)
    )
    .map(async (invite) => {
      try {
        await invite.update({ status: 'expired' });
        invite.status = 'expired';
      } catch (_error) {
        // Ignore partial sync failures and keep response flow stable.
      }
    });

  if (updates.length > 0) {
    await Promise.allSettled(updates);
  }

  return invites;
};

const ensureUsersHaveNoActiveGames = async userIds => {
  const existingGame = await Game.findOne({
    where: {
      status: { [Op.in]: ['waiting', 'active'] },
      [Op.or]: userIds.flatMap(userId => [
        { white_player_id: userId },
        { black_player_id: userId },
      ]),
    },
    attributes: ['id'],
  });

  if (existingGame) {
    throw new ConflictError('يوجد مباراة جارية بالفعل لأحد اللاعبين');
  }
};

/**
 * Get all invites with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status
 * @param {number} options.from_user_id - Filter by sender
 * @param {number} options.to_user_id - Filter by recipient
 * @returns {Object} Paginated invites
 */
export const listInvites = async (options = {}) => {
  const { page = 1, limit = 10, status, from_user_id, to_user_id } = options;

  const offset = (page - 1) * limit;
  const where = {};

  if (status) {
    where.status = status;
  }
  if (from_user_id) {
    where.from_user_id = from_user_id;
  }
  if (to_user_id) {
    where.to_user_id = to_user_id;
  }

  const { count, rows } = await Invite.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username', 'email', 'thumbnail', 'rank', 'state'],
      },
      {
        model: User,
        as: 'toUser',
        attributes: ['user_id', 'username', 'email', 'thumbnail', 'rank', 'state'],
      },
      {
        model: Game,
        as: 'game',
        required: false,
        attributes: ['id', 'status', 'ended_at'],
      },
    ],
    order: [['date_time', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const totalPages = Math.ceil(count / limit);
  await syncInviteStatusWithGame(rows);

  return {
    invites: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/**
 * Get invite by ID
 * @param {number} id - Invite ID
 * @returns {Object} Invite object
 */
export const getInviteById = async id => {
  const invite = await Invite.findByPk(id, {
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username', 'email', 'thumbnail', 'rank', 'state'],
      },
      {
        model: User,
        as: 'toUser',
        attributes: ['user_id', 'username', 'email', 'thumbnail', 'rank', 'state'],
      },
      {
        model: Game,
        as: 'game',
        required: false,
        attributes: ['id', 'status', 'ended_at'],
      },
    ],
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  return invite;
};

/**
 * Create a new invite
 * @param {Object} inviteData - Invite data
 * @returns {Object} Created invite
 */
export const createInvite = async inviteData => {
  const { from_user_id, to_user_id, status = 'pending' } = inviteData;

  // Check if users exist
  const [fromUser, toUser] = await Promise.all([
    User.findByPk(from_user_id),
    User.findByPk(to_user_id),
  ]);

  if (!fromUser) {
    throw new ValidationError('from_user_id does not exist');
  }
  if (!toUser) {
    throw new ValidationError('to_user_id does not exist');
  }
  if (from_user_id === to_user_id) {
    throw new ValidationError('from_user_id and to_user_id cannot be the same');
  }

  // Check if invite already exists
  const existingInvite = await Invite.findOne({
    where: {
      from_user_id,
      to_user_id,
      status: 'pending',
    },
  });

  if (existingInvite) {
    throw new ValidationError(
      'A pending invite already exists between these users'
    );
  }

  const invite = await Invite.create({
    from_user_id,
    to_user_id,
    status,
    date_time: new Date(),
  });

  return invite;
};

/**
 * Update an invite
 * @param {number} id - Invite ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated invite
 */
export const updateInvite = async (id, updateData) => {
  const invite = await Invite.findByPk(id);
  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  // Only allow status updates
  const { status } = updateData;
  if (!['pending', 'accepted', 'rejected'].includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  await invite.update({ status });
  return invite;
};

/**
 * Delete an invite
 * @param {number} id - Invite ID
 * @returns {boolean} Success status
 */
export const deleteInvite = async id => {
  const invite = await Invite.findByPk(id);
  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  await invite.destroy();
  return true;
};

/**
 * Get invites sent by a user
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated invites
 */
export const getSentInvites = async (userId, options = {}) => {
  return listInvites({
    ...options,
    from_user_id: userId,
  });
};

/**
 * Get invites received by a user
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated invites
 */
export const getReceivedInvites = async (userId, options = {}) => {
  return listInvites({
    ...options,
    to_user_id: userId,
  });
};

/**
 * Create a game invite
 * @param {number} fromUserId - Sender user ID
 * @param {number} toUserId - Recipient user ID
 * @param {string} gameType - Type of game (friendly/competitive)
 * @param {string} playMethod - Method of play (physical_board/phone)
 * @returns {Object} Created game invite
 */
export const createGameInvite = async (fromUserId, toUserId, gameType, playMethod) => {


  // Check if users exist
  const [fromUser, toUser] = await Promise.all([
    User.findByPk(fromUserId),
    User.findByPk(toUserId),
  ]);

  if (!fromUser) {
    throw new ValidationError('from_user_id does not exist');
  }
  if (!toUser) {
    throw new ValidationError('to_user_id does not exist');
  }
  if (fromUserId === toUserId) {
    throw new ValidationError('from_user_id and to_user_id cannot be the same');
  }

  // Validate game type and play method
  if (!['friendly', 'competitive'].includes(gameType)) {
    throw new ValidationError('Invalid game type. Must be friendly or competitive');
  }
  if (!['physical_board', 'phone'].includes(playMethod)) {
    throw new ValidationError('Invalid play method. Must be physical_board or phone');
  }

  await ensureUsersHaveNoActiveGames([fromUserId, toUserId]);

  // Check if there is already an actionable invite between the same two users in either direction
  const existingInvite = await Invite.findOne({
    where: {
      [Op.or]: [
        { from_user_id: fromUserId, to_user_id: toUserId },
        { from_user_id: toUserId, to_user_id: fromUserId },
      ],
      status: { [Op.in]: ['pending', 'accepted', 'game_started'] },
    },
  });

  if (existingInvite) {
    throw new ConflictError('A pending invite already exists between these users');
  }

  // Set expiration time (1 hour from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const invite = await Invite.create({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    status: 'pending',
    game_type: gameType,
    play_method: playMethod,
    date_time: new Date(),
    expires_at: expiresAt,
  });

  return invite;
};

/**
 * Get active invites for a user
 * @param {number} userId - User ID
 * @returns {Array} Active invites
 */
export const getActiveInvites = async (userId) => {
  const invites = await Invite.findAll({
    where: {
      to_user_id: userId,
      status: 'pending',
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username', 'thumbnail'],
      },
    ],
    order: [['date_time', 'DESC']],
  });

  return invites;
};

/**
 * Validate invite acceptance conditions
 * @param {number} inviteId - Invite ID
 * @param {number} userId - User ID (recipient)
 * @returns {Object} Validation result
 */
export const validateInviteAcceptance = async (inviteId, userId) => {
  const invite = await Invite.findByPk(inviteId, {
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username', 'state'],
      },
      {
        model: User,
        as: 'toUser',
        attributes: ['user_id', 'username', 'state'],
      },
    ],
  });
  
  if (!invite) {
    return { isValid: false, message: 'الدعوة غير موجودة' };
  }
  
  if (invite.to_user_id !== userId) {
    return { isValid: false, message: 'غير مصرح لك بقبول هذه الدعوة' };
  }
  
  // Check if invite is still pending
  if (invite.status !== 'pending') {
    return { isValid: false, message: 'الدعوة غير معلقة' };
  }
  
  // Check if invite has expired
  const now = new Date();
  const expiresAt = new Date(invite.expires_at);
  if (now > expiresAt) {
    return { isValid: false, message: 'انتهت صلاحية الدعوة' };
  }
  
  // Check if both users are online using live socket connections first.
  const { isUserOnline } = await import('../socket/socketHelpers.js');
  const isRecipientOnline = isUserOnline(invite.to_user_id) || invite.toUser.state === 'online' || invite.toUser.state === 'in-game';
  const isSenderOnline = isUserOnline(invite.from_user_id) || invite.fromUser.state === 'online' || invite.fromUser.state === 'in-game';

  if (!isRecipientOnline) {
    return { isValid: false, message: 'يجب أن تكون متصلاً لقبول الدعوة' };
  }
  
  if (!isSenderOnline) {
    return { isValid: false, message: 'يجب أن يكون مرسل الدعوة متصلاً' };
  }
  
  // Check if both users are friends
  const Friend = await import('../models/Friend.js');
  const { Op } = await import('sequelize');
  
  const friendship = await Friend.default.findOne({
    where: {
      [Op.or]: [
        { user_id: invite.from_user_id, friend_user_id: invite.to_user_id },
        { user_id: invite.to_user_id, friend_user_id: invite.from_user_id }
      ],
      status: 'accepted'
    }
  });
  
  if (!friendship) {
    return { isValid: false, message: 'يجب أن تكون صديقاً لمرسل الدعوة' };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Accept invite with validation
 * @param {number} inviteId - Invite ID
 * @param {number} userId - User ID
 * @param {string} playMethod - Play method chosen by the recipient (phone/physical_board)
 * @returns {Object} Updated invite and created game
 */
export const acceptInvite = async (inviteId, userId, playMethod = 'phone') => {
  // First validate the invite acceptance conditions
  const validation = await validateInviteAcceptance(inviteId, userId);
  
  if (!validation.isValid) {
    throw new ValidationError(validation.message);
  }
  
  // Validate play method
  if (!['phone', 'physical_board'].includes(playMethod)) {
    throw new ValidationError('طريقة اللعب غير صحيحة');
  }
  
  // Get the invite with sender information
  const invite = await Invite.findByPk(inviteId, {
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username'],
      },
      {
        model: User,
        as: 'toUser',
        attributes: ['user_id', 'username'],
      },
    ],
  });

  await ensureUsersHaveNoActiveGames([invite.from_user_id, invite.to_user_id]);
  
  // Create a new game
  const Game = await import('../models/Game.js');
  
  const game = await Game.default.create({
    white_player_id: invite.from_user_id, // المرسل
    black_player_id: invite.to_user_id,   // المستقبل
    started_by_user_id: invite.from_user_id, // المرسل هو من بدأ اللعبة
    game_type: 'friend',
    ai_level: null,
    puzzle_id: null,
    initial_time: 600, // 10 دقائق = 600 ثانية
    white_time_left: 600,
    black_time_left: 600,
    white_play_method: invite.play_method, // من الدعوة
    black_play_method: playMethod, // من اختيار المستقبل
    current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'waiting',
    winner_id: null,
    white_rank_change: null,
    black_rank_change: null,
    started_at: new Date(),
    ended_at: null,
  });
  
  // Update invite status to game_started
  await invite.update({ 
    status: 'game_started',
    game_id: game.id
  });

  // Update game status to active
  await game.update({ status: 'active' });

  // Update both players' status to in-game
  const { updateUserStatus } = await import('../socket/socketHelpers.js');
  await Promise.all([
    updateUserStatus(invite.from_user_id, 'in-game'),
    updateUserStatus(invite.to_user_id, 'in-game')
  ]);

  // Send websocket redirect to both players
  try {
    const io = global.io;
    if (io) {
      const gameData = {
        gameId: game.id,
        redirectUrl: `/game?id=${game.id}`
      };
      
      // Send to both players
      io.of('/friends').to(`user::${invite.from_user_id}`).emit('game_created', gameData);
      io.of('/friends').to(`user::${invite.to_user_id}`).emit('game_created', gameData);
    }
  } catch (error) {
    console.error('Error sending game_created websocket event:', error);
  }
  
  return {
    invite: invite,
    game: game
  };
};

/**
 * Respond to an invite
 * @param {number} inviteId - Invite ID
 * @param {number} userId - User ID
 * @param {string} response - Response (accepted/rejected)
 * @returns {Object} Updated invite
 */
export const respondToInvite = async (inviteId, userId, response) => {
  const invite = await Invite.findByPk(inviteId);
  
  if (!invite) {
    throw new NotFoundError('Invite not found');
  }
  
  if (invite.to_user_id !== userId) {
    throw new ValidationError('Not authorized to respond to this invite');
  }
  
  if (!['accept', 'reject'].includes(response)) {
    throw new ValidationError('Invalid response. Must be accept or reject');
  }
  
  // تحويل accept/reject إلى accepted/rejected
  const status = response === 'accept' ? 'accepted' : 'rejected';
  
  await invite.update({ status });
  
  return invite;
};

/**
 * Start game with method
 * @param {number} inviteId - Invite ID
 * @param {number} userId - User ID
 * @param {string} playMethod - Play method (physical_board/phone)
 * @returns {Object} Game start result
 */
export const startGame = async (inviteId, userId, playMethod) => {
  const invite = await Invite.findByPk(inviteId);

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  if (invite.from_user_id !== userId && invite.to_user_id !== userId) {
    throw new ValidationError('Not authorized to start this game');
  }

  if (!['physical_board', 'phone'].includes(playMethod)) {
    throw new ValidationError('Invalid play method. Must be physical_board or phone');
  }

  if (invite.status === 'game_started' && invite.game_id) {
    const existingGame = await Game.findByPk(invite.game_id, { attributes: ['id', 'status'] });
    if (existingGame && ACTIVE_GAME_STATUSES.has(existingGame.status)) {
      return {
        inviteId,
        playMethod,
        gameId: existingGame.id,
        status: 'started',
        game: {
          id: existingGame.id,
          status: existingGame.status,
        },
      };
    }

    await invite.update({ status: 'expired' });
    throw new ValidationError('This game has already ended');
  }

  if (invite.status !== 'accepted') {
    throw new ValidationError('Invite must be accepted before starting game');
  }

  await ensureUsersHaveNoActiveGames([invite.from_user_id, invite.to_user_id]);

  const isWhiteRandom = Math.random() < 0.5;
  const whitePlayerId = isWhiteRandom ? invite.from_user_id : invite.to_user_id;
  const blackPlayerId = isWhiteRandom ? invite.to_user_id : invite.from_user_id;
  const whitePlayMethod = isWhiteRandom ? invite.play_method : playMethod;
  const blackPlayMethod = isWhiteRandom ? playMethod : invite.play_method;
  const initialTime = 600;

  const game = await Game.create({
    white_player_id: whitePlayerId,
    black_player_id: blackPlayerId,
    started_by_user_id: invite.from_user_id,
    game_type: 'friend',
    ai_level: null,
    puzzle_id: null,
    initial_time: initialTime,
    white_time_left: initialTime,
    black_time_left: initialTime,
    white_play_method: whitePlayMethod,
    black_play_method: blackPlayMethod,
    current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'active',
    current_turn: 'white',
    winner_id: null,
    white_rank_change: null,
    black_rank_change: null,
    started_at: new Date(),
    ended_at: null,
  });

  await invite.update({
    game_id: game.id,
    status: 'game_started',
  });

  const { updateUserStatus } = await import('../socket/socketHelpers.js');
  await Promise.all([
    updateUserStatus(invite.from_user_id, 'in-game'),
    updateUserStatus(invite.to_user_id, 'in-game'),
  ]);

  try {
    const io = global.io;
    if (io) {
      const gameData = {
        gameId: game.id,
        whitePlayerId,
        blackPlayerId,
        whitePlayMethod,
        blackPlayMethod,
        mode: invite.game_type,
      };

      io.to(`user::${whitePlayerId}`).emit('rejoin_game', gameData);
      io.to(`user::${blackPlayerId}`).emit('rejoin_game', gameData);
    }
  } catch (error) {
    console.error('Error sending rejoin_game notifications:', error);
  }

  return {
    inviteId,
    playMethod,
    gameId: game.id,
    status: 'started',
    game: {
      id: game.id,
      whitePlayerId,
      blackPlayerId,
      whitePlayMethod,
      blackPlayMethod,
      initialTime,
      status: game.status,
    },
  };
};

/**
 * Get recent invites for a user
 * @param {number} userId - User ID
 * @param {Date} since - Date to get invites since
 * @returns {Array} Recent invites
 */
export const getRecentInvites = async (userId, since) => {
  const invites = await Invite.findAll({
    where: {
      [Op.or]: [
        { from_user_id: userId },
        { to_user_id: userId }
      ],
      date_time: {
        [Op.gte]: since
      }
    },
    include: [
      {
        model: User,
        as: 'fromUser',
        attributes: ['user_id', 'username', 'email'],
      },
      {
        model: User,
        as: 'toUser',
        attributes: ['user_id', 'username', 'email'],
      },
    ],
    order: [['date_time', 'DESC']],
    limit: 50 // حد أقصى 50 دعوة
  });

  // تنسيق البيانات للعرض
  return invites.map(invite => ({
    id: invite.id,
    from_user_id: invite.from_user_id,
    to_user_id: invite.to_user_id,
    from_user_name: invite.fromUser?.username || 'مستخدم',
    to_user_name: invite.toUser?.username || 'مستخدم',
    game_type: invite.game_type,
    play_method: invite.play_method,
    status: invite.status,
    game_id: invite.game_id,
    created_at: invite.date_time,
    message: invite.message
  }));
};

/**
 * Cancel an invite (only by sender)
 * @param {number} inviteId - Invite ID
 * @param {number} userId - User ID (sender)
 * @returns {Object} Cancelled invite
 */
export const cancelInvite = async (inviteId, userId) => {
  // البحث عن الدعوة
  const invite = await Invite.findByPk(inviteId);
  
  if (!invite) {
    throw new Error('الدعوة غير موجودة');
  }
  
  // التحقق من أن المستخدم هو مرسل الدعوة
  if (invite.from_user_id !== userId) {
    throw new Error('غير مصرح لك بإلغاء هذه الدعوة');
  }
  
  // التحقق من أن الدعوة في حالة معلقة
  if (invite.status !== 'pending') {
    throw new Error('لا يمكن إلغاء دعوة غير معلقة');
  }
  
  // تحديث حالة الدعوة إلى مرفوضة (قيمة مدعومة في ENUM)
  await invite.update({ status: 'rejected' });
  

  
  // إرسال إشعار للمستلم عبر Socket.IO
  try {
    const io = global.io;
    if (io) {
      io.to(`user::${invite.to_user_id}`).emit('inviteCancelled', {
        inviteId: invite.id,
        fromUserId: invite.from_user_id,
        message: 'تم إلغاء الدعوة من قبل المرسل'
      });
      
  
    }
  } catch (error) {
    console.error('Error sending invite cancellation notification:', error);
  }
  
  return {
    id: invite.id,
    status: invite.status,
    message: 'تم إلغاء الدعوة بنجاح'
  };
};


