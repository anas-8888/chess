import express from 'express';
import { protect, userOnly, adminOnly } from '../middlewares/authMiddleware.js';
import {
  // Category controllers
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,

  // Course controllers
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,

  // Course video controllers
  getCourseVideos,
  addCourseVideo,
  updateCourseVideo,
  deleteCourseVideo,

  // User course controllers
  enrollInCourse,
  unenrollFromCourse,
  checkCourseEnrollment,
} from '../controllers/courseController.js';

const router = express.Router();

// ==================== CATEGORY ROUTES ====================

// GET /courses/categories - List categories (user and admin)
router.get('/categories', protect, userOnly, getAllCategories);

// POST /courses/categories - Create category (admin only)
router.post('/categories', protect, adminOnly, createCategory);

// PUT /courses/categories/:id - Update category (admin only)
router.put('/categories/:id', protect, adminOnly, updateCategory);

// DELETE /courses/categories/:id - Delete category (admin only)
router.delete('/categories/:id', protect, adminOnly, deleteCategory);

// ==================== COURSE ROUTES ====================

// GET /courses - List courses (user and admin)
router.get('/', protect, userOnly, getAllCourses);

// GET /courses/:id - Get course by ID (user and admin)
router.get('/:id', protect, userOnly, getCourseById);

// POST /courses - Create course (admin only)
router.post('/', protect, adminOnly, createCourse);

// PUT /courses/:id - Update course (admin only)
router.put('/:id', protect, adminOnly, updateCourse);

// DELETE /courses/:id - Delete course (admin only)
router.delete('/:id', protect, adminOnly, deleteCourse);

// ==================== COURSE VIDEO ROUTES ====================

// GET /courses/:courseId/videos - List course videos (user and admin)
router.get('/:courseId/videos', protect, userOnly, getCourseVideos);

// POST /courses/:courseId/videos - Add course video (admin only)
router.post('/:courseId/videos', protect, adminOnly, addCourseVideo);

// PUT /courses/:courseId/videos/:id - Update course video (admin only)
router.put('/:courseId/videos/:id', protect, adminOnly, updateCourseVideo);

// DELETE /courses/:courseId/videos/:id - Delete course video (admin only)
router.delete('/:courseId/videos/:id', protect, adminOnly, deleteCourseVideo);

// ==================== USER COURSE ROUTES ====================

// POST /courses/:courseId/enroll - Enroll in course (user and admin)
router.post('/:courseId/enroll', protect, userOnly, enrollInCourse);

// DELETE /courses/:courseId/enroll - Unenroll from course (user and admin)
router.delete('/:courseId/enroll', protect, userOnly, unenrollFromCourse);

// GET /courses/:courseId/enrollment - Check enrollment status (user and admin)
router.get('/:courseId/enrollment', protect, userOnly, checkCourseEnrollment);

export default router;
