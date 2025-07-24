import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import User from '../models/User.js';
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from '../utils/helpers.js';

// Validation functions
const validateUserUpdate = data => {
  const errors = [];

  if (data.username) {
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.isValid) {
      errors.push(...usernameValidation.errors);
    }
  }

  if (data.email) {
    if (!validateEmail(data.email)) {
      errors.push('Invalid email format');
    }
  }

  if (data.password) {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }

  if (data.rank !== undefined) {
    if (data.rank < 0 || data.rank > 3000) {
      errors.push('Rank must be between 0 and 3000');
    }
  }

  if (data.puzzle_level !== undefined) {
    if (data.puzzle_level < 1 || data.puzzle_level > 10) {
      errors.push('Puzzle level must be between 1 and 10');
    }
  }

  if (data.type && !['user', 'admin'].includes(data.type)) {
    errors.push('Invalid user type');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Create new user (Admin only)
export async function createUser(userData, currentUser) {
  // Check if current user is admin
  if (currentUser.type !== 'admin') {
    throw new Error('Access denied. Admin privileges required.');
  }

  // Validate required fields
  const requiredFields = ['username', 'email', 'password'];
  const missingFields = requiredFields.filter(field => !userData[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate user data
  const validation = validateUserUpdate(userData);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [
        { email: userData.email.toLowerCase() },
        { username: userData.username.toLowerCase() },
      ],
    },
  });

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(userData.password, 12);

  // Create user
  const newUser = await User.create({
    username: userData.username.toLowerCase(),
    email: userData.email.toLowerCase(),
    password_hash: passwordHash,
    type: userData.type || 'user',
    rank: userData.rank || 1200,
    puzzle_level: userData.puzzle_level || 1,
    state: userData.state || 'offline',
    thumbnail: userData.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNlOWVjZTYiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOTk5OTk5Ij4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4eiIvPgo8cGF0aCBkPSJNMTIgNmMtMy4zMSAwLTYgMi42OS02IDZzMi42OSA2IDYgNiA2LTIuNjkgNi02LTIuNjktNi02LTZ6bTAgMTBjLTIuMjEgMC00LTEuNzktNC00czEuNzktNCA0LTQgNCAxLjc5IDQgNC0xLjc5IDQtNCA0eiIvPgo8L3N2Zz4KPC9zdmc+',
  });

  // Return user without password
  return await User.findByPk(newUser.user_id, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });
}

// Get all users with pagination
export async function getAllUsers(options = {}) {
  const {
    page = 1,
    limit = 10,
    search = '',
    type = '',
    state = '',
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = options;

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { username: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  if (type) whereClause.type = type;
  if (state) whereClause.state = state;

  // Validate sortBy field
  const allowedSortFields = [
    'username',
    'email',
    'rank',
    'created_at',
    'type',
    'state',
  ];
  const validSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : 'created_at';

  // Validate sortOrder
  const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
    ? sortOrder.toUpperCase()
    : 'DESC';

  const { count, rows } = await User.findAndCountAll({
    where: whereClause,
    attributes: { exclude: ['password_hash', 'deleted_at'] },
    order: [[validSortBy, validSortOrder]],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  return {
    users: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

// Get user by ID
export async function getUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Get current user profile
export async function getCurrentUserProfile(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Update user profile
export async function updateUserProfile(userId, updateData, currentUser) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check permissions
  if (currentUser.type !== 'admin' && currentUser.user_id !== userId) {
    throw new Error('Access denied. You can only update your own profile.');
  }

  // Hash password if provided
  if (updateData.password) {
    updateData.password_hash = await bcrypt.hash(updateData.password, 12);
    delete updateData.password;
  }

  // Normalize email and username
  if (updateData.email) {
    updateData.email = updateData.email.toLowerCase();
  }
  if (updateData.username) {
    updateData.username = updateData.username.toLowerCase();
  }

  await user.update(updateData);

  return await User.findByPk(userId, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });
}

// Delete user (soft delete)
export async function deleteUser(userId, currentUser) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check permissions
  if (currentUser.type !== 'admin' && currentUser.user_id !== userId) {
    throw new Error('Access denied. You can only delete your own account.');
  }

  // Soft delete
  await user.update({ deleted_at: new Date() });

  return { message: 'User deleted successfully' };
}

// Search users
export async function searchUsers(searchTerm, options = {}) {
  const { limit = 10, type = '', state = '' } = options;

  const whereClause = {
    [Op.or]: [
      { username: { [Op.like]: `%${searchTerm}%` } },
      { email: { [Op.like]: `%${searchTerm}%` } },
    ],
  };

  if (type) whereClause.type = type;
  if (state) whereClause.state = state;

  const users = await User.findAll({
    where: whereClause,
    attributes: { exclude: ['password_hash', 'deleted_at'] },
    limit: parseInt(limit),
    order: [['username', 'ASC']],
  });

  return users;
}

// Get user statistics
export async function getUserStats(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // TODO: Add more statistics as needed
  return {
    user_id: user.user_id,
    username: user.username,
    rank: user.rank,
    puzzle_level: user.puzzle_level,
    created_at: user.created_at,
  };
}

// Change password
export async function changePassword(
  userId,
  currentPassword,
  newPassword,
  currentUser
) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check permissions
  if (currentUser.type !== 'admin' && currentUser.user_id !== userId) {
    throw new Error('Access denied. You can only change your own password.');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password_hash
  );

  if (!isCurrentPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await user.update({ password_hash: newPasswordHash });

  return { message: 'Password changed successfully' };
}
