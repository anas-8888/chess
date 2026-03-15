import express from 'express';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';
import {
  getAdminAccess,
  getAdminStats,
  getAdminUsers,
  banUserByAdmin,
  unbanUserByAdmin,
  getAdminGames,
  endGameByAdmin,
  getAdminInvites,
  deleteInviteByAdmin,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/access', getAdminAccess);
router.get('/stats', getAdminStats);

router.get('/users', getAdminUsers);
router.post('/users/:id/ban', banUserByAdmin);
router.post('/users/:id/unban', unbanUserByAdmin);

router.get('/games', getAdminGames);
router.post('/games/:id/end', endGameByAdmin);

router.get('/invites', getAdminInvites);
router.delete('/invites/:id', deleteInviteByAdmin);

export default router;
