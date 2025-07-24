import { Op } from 'sequelize';
import User from '../models/User.js';

// In-memory storage for challenges (in production, this should be in database)
const challenges = new Map();
let challengeIdCounter = 1;

// Initialize with some default challenges
const initializeDefaultChallenges = async () => {
  try {
    const users = await User.findAll({
      attributes: ['user_id', 'username', 'rank'],
      limit: 3
    });
    
    if (users.length >= 2) {
      // Add some default challenges
      const challenge1 = {
        id: challengeIdCounter++,
        from_user_id: users[0].user_id,
        to_user_id: users[1].user_id,
        time_control: 'blitz',
        game_mode: 'rated',
        status: 'accepted',
        created_at: new Date(Date.now() - 86400000), // 1 day ago
        updated_at: new Date(Date.now() - 86400000)
      };
      
      const challenge2 = {
        id: challengeIdCounter++,
        from_user_id: users[1].user_id,
        to_user_id: users[2]?.user_id || users[0].user_id,
        time_control: 'rapid',
        game_mode: 'casual',
        status: 'pending',
        created_at: new Date(Date.now() - 3600000), // 1 hour ago
        updated_at: new Date(Date.now() - 3600000)
      };
      
      challenges.set(challenge1.id, challenge1);
      challenges.set(challenge2.id, challenge2);
    }
  } catch (error) {
    console.log('Could not initialize default challenges:', error.message);
  }
};

// Initialize default challenges when module loads
initializeDefaultChallenges();

// Create a new challenge
export async function createChallenge(fromUserId, challengeData) {
  const { toUserId, timeControl, gameMode } = challengeData;

  // Check if users exist
  const [fromUser, toUser] = await Promise.all([
    User.findByPk(fromUserId),
    User.findByPk(toUserId)
  ]);

  if (!fromUser || !toUser) {
    throw new Error('User not found');
  }

  if (fromUserId === toUserId) {
    throw new Error('Cannot challenge yourself');
  }

  // Check if challenge already exists
  const existingChallenge = Array.from(challenges.values()).find(
    challenge => 
      challenge.from_user_id === fromUserId && 
      challenge.to_user_id === toUserId && 
      challenge.status === 'pending'
  );

  if (existingChallenge) {
    throw new Error('Challenge already sent to this user');
  }

  // Create challenge
  const challenge = {
    id: challengeIdCounter++,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    time_control: timeControl,
    game_mode: gameMode,
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };

  challenges.set(challenge.id, challenge);

  return {
    id: challenge.id,
    from_user: {
      user_id: fromUser.user_id,
      username: fromUser.username,
      rank: fromUser.rank
    },
    to_user: {
      user_id: toUser.user_id,
      username: toUser.username,
      rank: toUser.rank
    },
    time_control: challenge.time_control,
    game_mode: challenge.game_mode,
    status: challenge.status,
    created_at: challenge.created_at
  };
}

// Get user's challenges
export async function getUserChallenges(userId, filters = {}) {
  const { status, type } = filters;

  let userChallenges = Array.from(challenges.values()).filter(challenge => {
    if (type === 'sent') {
      return challenge.from_user_id === userId;
    } else if (type === 'received') {
      return challenge.to_user_id === userId;
    } else {
      return challenge.from_user_id === userId || challenge.to_user_id === userId;
    }
  });

  if (status) {
    userChallenges = userChallenges.filter(challenge => challenge.status === status);
  }

  // Get user data for challenges
  const userIds = new Set();
  userChallenges.forEach(challenge => {
    userIds.add(challenge.from_user_id);
    userIds.add(challenge.to_user_id);
  });

  const users = await User.findAll({
    where: { user_id: { [Op.in]: Array.from(userIds) } },
    attributes: ['user_id', 'username', 'rank']
  });

  const userMap = new Map(users.map(user => [user.user_id, user]));

  // Convert to format expected by frontend
  return userChallenges.map(challenge => {
    const isFromUser = challenge.from_user_id === userId;
    const opponent = isFromUser 
      ? userMap.get(challenge.to_user_id)?.username || 'Unknown'
      : userMap.get(challenge.from_user_id)?.username || 'Unknown';
    
    // Calculate points based on status and opponent rank
    const opponentRank = isFromUser 
      ? userMap.get(challenge.to_user_id)?.rank || 1200
      : userMap.get(challenge.from_user_id)?.rank || 1200;
    
    let points = 0;
    if (challenge.status === 'accepted') {
      points = Math.floor(Math.random() * 20) - 10; // Random points between -10 and 10
    }
    
    // Format time
    const timeOptions = {
      'blitz': '5 دقائق',
      'rapid': '10 دقائق',
      'classical': '15 دقائق'
    };
    
    return {
      id: challenge.id,
      opponent: opponent,
      points: points,
      time: timeOptions[challenge.time_control] || '5 دقائق',
      status: challenge.status,
      created_at: challenge.created_at
    };
  });
}

// Accept a challenge
export async function acceptChallenge(userId, challengeId) {
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    throw new Error('Challenge not found');
  }

  if (challenge.to_user_id !== userId) {
    throw new Error('Not authorized to accept this challenge');
  }

  if (challenge.status !== 'pending') {
    throw new Error('Challenge is not pending');
  }

  // Update challenge status
  challenge.status = 'accepted';
  challenge.updated_at = new Date();

  // Create game (this would integrate with gameService)
  const game = {
    id: Math.floor(Math.random() * 1000000), // Temporary ID
    player1_id: challenge.from_user_id,
    player2_id: challenge.to_user_id,
    time_control: challenge.time_control,
    game_mode: challenge.game_mode,
    status: 'active'
  };

  return {
    challenge: {
      id: challenge.id,
      status: challenge.status,
      updated_at: challenge.updated_at
    },
    game: game
  };
}

// Reject a challenge
export async function rejectChallenge(userId, challengeId) {
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    throw new Error('Challenge not found');
  }

  if (challenge.to_user_id !== userId) {
    throw new Error('Not authorized to reject this challenge');
  }

  if (challenge.status !== 'pending') {
    throw new Error('Challenge is not pending');
  }

  // Update challenge status
  challenge.status = 'rejected';
  challenge.updated_at = new Date();

  return {
    id: challenge.id,
    status: challenge.status,
    updated_at: challenge.updated_at
  };
} 