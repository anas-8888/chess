import express from 'express';
import * as inviteController from '../controllers/inviteController.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createInviteValidation,
  updateInviteValidation,
  inviteIdValidation,
  listInvitesValidation,
  createGameInviteValidation,
} from '../middlewares/validation/inviteValidation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/invites - List all invites (with pagination and filtering)
router.get('/', listInvitesValidation, inviteController.list);

// GET /api/invites/sent - Get invites sent by current user
router.get('/sent', inviteController.getSentInvites);

// GET /api/invites/received - Get invites received by current user
router.get('/received', inviteController.getReceivedInvites);

// GET /api/invites/active - Get active invites for current user
router.get('/active', inviteController.getActiveInvites);

// GET /api/invites/recent - Get recent invites (last hour)
router.get('/recent', inviteController.getRecentInvites);

// POST /api/invites - Create new invite
router.post('/', createInviteValidation, inviteController.create);

// POST /api/invites/game - Create game invite
router.post('/game', createGameInviteValidation, inviteController.createGameInvite);

// PUT /api/invites/:id/respond - Respond to game invite
router.put('/:id/respond', inviteController.respondToInvite);

// POST /api/invites/:id/cancel - Cancel invite (only by sender)
router.post('/:id/cancel', inviteController.cancelInvite);

// POST /api/invites/:id/start-game - Start game with method
router.post('/:id/start-game', inviteController.startGame);

// GET /api/invites/:id - Get invite by ID
router.get('/:id', inviteIdValidation, inviteController.getById);

// PUT /api/invites/:id - Update invite
router.put('/:id', updateInviteValidation, inviteController.update);

// DELETE /api/invites/:id - Delete invite
router.delete('/:id', inviteIdValidation, inviteController.deleteInvite);

// GET /api/invites/dashboard - Get pending invites for dashboard
router.get('/dashboard', inviteController.getPendingInvitesForDashboard);

// POST /api/invites/send - Send invite to friend
router.post('/send', inviteController.sendInviteToFriend);

// POST /api/invites/:id/accept - Accept invite for dashboard
router.post('/:id/accept', inviteController.acceptInviteForDashboard);

// POST /api/invites/:id/decline - Decline invite for dashboard
router.post('/:id/decline', inviteController.declineInviteForDashboard);

export default router;
