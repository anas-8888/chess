import { formatResponse, formatError } from '../utils/helpers.js';
import * as challengeService from '../services/challengeService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// Create a new challenge
export const createChallenge = asyncHandler(async (req, res) => {
  const fromUserId = req.user.user_id;
  const { toUserId, timeControl, gameMode } = req.body;
  
  const challenge = await challengeService.createChallenge(fromUserId, {
    toUserId,
    timeControl: timeControl || 'blitz',
    gameMode: gameMode || 'rated'
  });
  
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(201).json(challenge);
});

// Get user's challenges
export const getChallenges = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { status, type } = req.query; // status: 'pending', 'accepted', 'rejected', type: 'sent', 'received'
  
  const challenges = await challengeService.getUserChallenges(userId, {
    status,
    type
  });
  
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(challenges);
});

// Accept a challenge
export const acceptChallenge = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const challengeId = parseInt(req.params.id);
  
  const result = await challengeService.acceptChallenge(userId, challengeId);
  
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result);
});

// Reject a challenge
export const rejectChallenge = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const challengeId = parseInt(req.params.id);
  
  await challengeService.rejectChallenge(userId, challengeId);
  
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json({ success: true });
}); 