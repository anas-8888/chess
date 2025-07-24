import express from 'express';
import {
  register,
  login,
  logout,
  refresh,
  validate,
  validateToken,
} from '../controllers/authController.js';
import { protect, rateLimit } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(rateLimit(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/validate', validate);
router.post('/refresh', refresh); // Accept token from body like validate
router.get('/validate', validateToken); // GET endpoint for token validation

// Protected routes
router.post('/logout', protect, logout);

// TODO: Add more auth routes as needed
// router.post('/refresh-token', refreshToken);
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password', resetPassword);
// router.get('/me', protect, getProfile);
// router.put('/me', protect, updateProfile);

export default router;
