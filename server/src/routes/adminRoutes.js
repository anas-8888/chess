import express from 'express';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';
import {
  getAdminAccess,
  getAdminStats,
  getAdminUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  getAdminUserDetails,
  removeFriendByAdmin,
  banUserByAdmin,
  unbanUserByAdmin,
  getAdminGames,
  getAdminGameDetails,
  updateGameByAdmin,
  endGameByAdmin,
  getAdminInvites,
  deleteInviteByAdmin,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/access', getAdminAccess);
router.get('/stats', getAdminStats);

router.get('/users', getAdminUsers);
router.post('/users', createUserByAdmin);
router.get('/users/:id/details', getAdminUserDetails);
router.put('/users/:id', updateUserByAdmin);
router.delete('/users/:id', deleteUserByAdmin);
router.delete('/users/:id/friends/:friendId', removeFriendByAdmin);
router.post('/users/:id/ban', banUserByAdmin);
router.post('/users/:id/unban', unbanUserByAdmin);

router.get('/games', getAdminGames);
router.get('/games/:id/details', getAdminGameDetails);
router.put('/games/:id', updateGameByAdmin);
router.post('/games/:id/end', endGameByAdmin);

router.get('/invites', getAdminInvites);
router.delete('/invites/:id', deleteInviteByAdmin);

export default router;
