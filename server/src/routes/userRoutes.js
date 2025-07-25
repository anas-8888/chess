import express from 'express';
import {
  protect,
  userOnly,
  adminOnly,
  ownerOrAdmin,
} from '../middlewares/authMiddleware.js';
import {
  getUsers,
  getUser,
  getProfile,
  updateProfile,
  updateCurrentProfile,
  deleteUserAccount,
  deleteCurrentAccount,
  searchUsersController,
  getUserStatsController,
  changePasswordController,
  createNewUser,
  getUserSessionsController,
  revokeSessionController,
  revokeAllOtherSessionsController,
  getSiteStats,
  updateUserStatus,
  getProfileWithStats,
  getCurrentUserStatus,
} from '../controllers/userController.js';
import { getUserCourses } from '../controllers/courseController.js';
import User from '../models/User.js';
import Friend from '../models/Friend.js';
import { Op } from 'sequelize';
import logger from '../utils/logger.js';

const router = express.Router();

// TODO: Import user controllers
// import {
//   getProfile,
//   updateProfile,
//   deleteProfile,
//   getAllUsers,
//   getUserById
// } from '../controllers/userController.js';

// Apply authentication middleware to all routes
router.use(protect);

// Current user routes (no ID needed)
router.get('/profile', getProfile);
router.get('/profile/stats', getProfileWithStats);
router.get('/status', getCurrentUserStatus);
router.put('/profile', updateCurrentProfile);
router.delete('/profile', deleteCurrentAccount);
router.post('/change-password', changePasswordController);

// تحديث حالة المستخدم
router.put('/status', async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.user.user_id;
        
        // التحقق من صحة الحالة
        const validStatuses = ['online', 'offline', 'in-game'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'حالة غير صحيحة' 
            });
        }
        
        // التحقق من الحالة الحالية قبل التحديث
        const currentUser = await User.findByPk(userId);
        if (!currentUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'المستخدم غير موجود' 
            });
        }
        
        // إذا كانت الحالة نفسها، لا حاجة للتحديث
        if (currentUser.state === status) {
            logger.debug(`المستخدم ${userId} حالته ${status} بالفعل، تخطي التحديث`);
            return res.json({ 
                success: true, 
                message: 'الحالة لم تتغير',
                status: status
            });
        }
        
        // تحديث حالة المستخدم
        await User.update(
            { state: status },
            { where: { user_id: userId } }
        );
        
        logger.info(`تم تحديث حالة المستخدم ${userId} من ${currentUser.state} إلى ${status}`);
        
        // إرسال تحديث real-time للأصدقاء فقط إذا تغيرت الحالة
        const io = global.io;
        if (io) {
            // البحث عن أصدقاء المستخدم
            const friends = await Friend.findAll({
                where: {
                    [Op.or]: [
                        { user_id: userId },
                        { friend_user_id: userId }
                    ],
                    status: 'accepted'
                }
            });
            
            // إرسال التحديث لكل صديق فقط إذا كان هناك أصدقاء
            if (friends.length > 0) {
                for (const friend of friends) {
                    const friendUserId = friend.user_id === userId ? friend.friend_user_id : friend.user_id;
                    io.to(`user_${friendUserId}`).emit('friendStatusChanged', {
                        userId: userId,
                        status: status,
                        timestamp: new Date()
                    });
                }
                
                logger.debug(`تم إرسال تحديث الحالة لـ ${friends.length} صديق`);
            } else {
                logger.debug(`المستخدم ${userId} ليس له أصدقاء، تخطي إرسال تحديث الحالة`);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'تم تحديث الحالة بنجاح',
            status: status
        });
        
    } catch (error) {
        logger.error('خطأ في تحديث حالة المستخدم:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في تحديث الحالة',
            error: error.message,
            stack: error.stack
        });
    }
});

// Current user session management
router.get('/sessions', getUserSessionsController);
router.post('/sessions/revoke', revokeSessionController);
router.post('/sessions/revoke-others', revokeAllOtherSessionsController);

// Current user courses (user and admin)
router.get('/me/courses', userOnly, getUserCourses);

// User management routes (Admin only)
router.get('/', adminOnly, getUsers);
router.post('/', adminOnly, createNewUser);
router.get('/search', userOnly, searchUsersController);

// Individual user routes (Admin or owner)
router.get('/:id', ownerOrAdmin('id'), getUser);
router.put('/:id', ownerOrAdmin('id'), updateProfile);
router.delete('/:id', ownerOrAdmin('id'), deleteUserAccount);

// User statistics
router.get('/:id/stats', ownerOrAdmin('id'), getUserStatsController);

// موقع الإحصائيات العامة
router.get('/stats', getSiteStats);

// Session management routes
router.get('/:id/sessions', ownerOrAdmin('id'), getUserSessionsController);
router.post(
  '/:id/sessions/revoke',
  ownerOrAdmin('id'),
  revokeSessionController
);
router.post(
  '/:id/sessions/revoke-others',
  ownerOrAdmin('id'),
  revokeAllOtherSessionsController
);

export default router;
