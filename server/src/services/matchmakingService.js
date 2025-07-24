import User from '../models/User.js';

// In-memory storage for matchmaking queue
const matchmakingQueue = new Map();

// Join random matchmaking
export async function joinRandomMatchmaking(userId, preferences = {}) {
  const { timeControl = 'blitz', gameMode = 'rated' } = preferences;

  // Get user data
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Remove user from any existing queue
  matchmakingQueue.delete(userId);

  // Add to queue
  matchmakingQueue.set(userId, {
    userId,
    timeControl,
    gameMode,
    rank: user.rank,
    joinedAt: new Date()
  });

  // Try to find a match
  const match = await findRandomMatch(userId, preferences);
  
  return {
    inQueue: !match,
    match: match,
    queuePosition: match ? null : getQueuePosition(userId)
  };
}

// Leave random matchmaking
export async function leaveRandomMatchmaking(userId) {
  const wasInQueue = matchmakingQueue.has(userId);
  matchmakingQueue.delete(userId);
  
  return {
    success: wasInQueue,
    message: wasInQueue ? 'Left matchmaking queue' : 'Not in queue'
  };
}

// Find random match
async function findRandomMatch(userId, preferences) {
  const userData = matchmakingQueue.get(userId);
  if (!userData) return null;

  for (const [queuedUserId, queuedUser] of matchmakingQueue.entries()) {
    if (queuedUserId === userId) continue;

    // Check if users match preferences
    if (
      queuedUser.timeControl === preferences.timeControl &&
      queuedUser.gameMode === preferences.gameMode
    ) {
      // Remove both users from queue
      matchmakingQueue.delete(userId);
      matchmakingQueue.delete(queuedUserId);

      // Create game (this would integrate with gameService)
      return {
        opponent: {
          user_id: queuedUserId,
          rank: queuedUser.rank
        },
        timeControl: preferences.timeControl,
        gameMode: preferences.gameMode
      };
    }
  }

  return null; // No match found
}

// Get queue position
function getQueuePosition(userId) {
  const queueArray = Array.from(matchmakingQueue.keys());
  const position = queueArray.indexOf(userId);
  return position >= 0 ? position + 1 : null;
}

// Get queue status (for debugging)
export function getQueueStatus() {
  return {
    size: matchmakingQueue.size,
    users: Array.from(matchmakingQueue.entries()).map(([userId, data]) => ({
      userId,
      timeControl: data.timeControl,
      gameMode: data.gameMode,
      rank: data.rank,
      joinedAt: data.joinedAt
    }))
  };
} 