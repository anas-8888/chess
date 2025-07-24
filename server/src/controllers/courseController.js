import { formatResponse, formatError, formatDetailedError, formatSuccessResponse } from '../utils/helpers.js';
import * as courseService from '../services/courseService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

// ==================== CATEGORY CONTROLLERS ====================

export const getAllCategories = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await courseService.getAllCategories({
    search,
    page,
    limit,
  });
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result.categories || result);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json(formatError('Category name is required'));
  }
  const category = await courseService.createCategory({ name: name.trim() });
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json(formatError('Category name is required'));
  }
  const category = await courseService.updateCategory(parseInt(id), {
    name: name.trim(),
  });
  res
    .status(200)
    .json(formatResponse(category, 'Category updated successfully'));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await courseService.deleteCategory(parseInt(id));
  res
    .status(200)
    .json(formatResponse(result, 'Category deleted successfully'));
});

// ==================== COURSE CONTROLLERS ====================

export const getAllCourses = asyncHandler(async (req, res) => {
  const { category, level, search, page, limit, sortBy, sortOrder } =
    req.query;
  const result = await courseService.getAllCourses({
    category,
    level,
    search,
    page,
    limit,
    sortBy,
    sortOrder,
  });
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(result.courses || result);
});

export const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const course = await courseService.getCourseById(parseInt(id));
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(course);
});

export const createCourse = asyncHandler(async (req, res) => {
  const { category_id, name, details, level, hours, image_url } = req.body;
  if (!category_id || !name || !level) {
    return res
      .status(400)
      .json(formatError('Category ID, name, and level are required'));
  }
  if (!['beginner', 'intermediate', 'pro'].includes(level)) {
    return res
      .status(400)
      .json(formatError('Level must be beginner, intermediate, or pro'));
  }
  const courseData = {
    category_id: parseInt(category_id),
    name: name.trim(),
    details: details?.trim(),
    level,
    hours: hours ? parseFloat(hours) : null,
    image_url: image_url?.trim(),
  };
  const course = await courseService.createCourse(courseData);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(201).json(course);
});

export const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category_id, name, details, level, hours, image_url } = req.body;
  if (level && !['beginner', 'intermediate', 'pro'].includes(level)) {
    return res
      .status(400)
      .json(formatError('Level must be beginner, intermediate, or pro'));
  }
  const updateData = {};
  if (category_id) updateData.category_id = parseInt(category_id);
  if (name) updateData.name = name.trim();
  if (details !== undefined) updateData.details = details?.trim();
  if (level) updateData.level = level;
  if (hours !== undefined)
    updateData.hours = hours ? parseFloat(hours) : null;
  if (image_url !== undefined) updateData.image_url = image_url?.trim();
  const course = await courseService.updateCourse(parseInt(id), updateData);
  // إرجاع البيانات مباشرة بدون تغليفها
  res.status(200).json(course);
});

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.deleteCourse(parseInt(id));
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

// ==================== COURSE VIDEO CONTROLLERS ====================

export const getCourseVideos = async (req, res) => {
  try {
    const { courseId } = req.params;
    const videos = await courseService.getCourseVideos(parseInt(courseId));
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json(videos);
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

export const addCourseVideo = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, url, position } = req.body;
    if (!title || !url || !position) {
      return res
        .status(400)
        .json(formatError('Title, URL, and position are required'));
    }
    const videoData = {
      title: title.trim(),
      url: url.trim(),
      position: parseInt(position),
    };
    const video = await courseService.addCourseVideo(
      parseInt(courseId),
      videoData
    );
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(201).json(video);
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

export const updateCourseVideo = async (req, res) => {
  try {
    const { courseId, id } = req.params;
    const { title, url, position } = req.body;
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (url) updateData.url = url.trim();
    if (position) updateData.position = parseInt(position);
    const video = await courseService.updateCourseVideo(
      parseInt(courseId),
      parseInt(id),
      updateData
    );
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json(video);
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

export const deleteCourseVideo = async (req, res) => {
  try {
    const { courseId, id } = req.params;
    const result = await courseService.deleteCourseVideo(
      parseInt(courseId),
      parseInt(id)
    );
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

// ==================== USER COURSE CONTROLLERS ====================

export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.user_id;

    // التحقق من وجود المستخدم
    if (!userId) {
      return res.status(401).json(formatDetailedError('يجب تسجيل الدخول أولاً'));
    }

    const enrollment = await courseService.enrollInCourse(
      userId,
      parseInt(courseId)
    );
    
    res.status(200).json(formatSuccessResponse(enrollment, 'تم التسجيل في الكورس بنجاح'));
  } catch (error) {
    console.error('خطأ في تسجيل الكورس:', error);
    
    // رسائل خطأ مخصصة حسب نوع الخطأ
    let errorMessage = error.message;
    let statusCode = 400;

    if (error.message.includes('المستخدم غير موجود')) {
      statusCode = 404;
      errorMessage = 'المستخدم غير موجود';
    } else if (error.message.includes('الكورس غير موجود')) {
      statusCode = 404;
      errorMessage = 'الكورس غير موجود';
    } else if (error.message.includes('مسجل بالفعل')) {
      statusCode = 409; // Conflict
      errorMessage = 'أنت مسجل بالفعل في هذا الكورس';
    } else if (error.message.includes('يجب تسجيل الدخول')) {
      statusCode = 401;
      errorMessage = 'يجب تسجيل الدخول أولاً';
    } else if (error.message.includes('قاعدة البيانات')) {
      statusCode = 500;
      errorMessage = 'حدث خطأ في قاعدة البيانات';
    }

    res.status(statusCode).json(formatDetailedError(errorMessage, error));
  }
};

export const getUserCourses = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { page, limit } = req.query;
    const result = await courseService.getUserCourses(userId, { page, limit });
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json(result.courses || result);
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

export const unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.user_id;
    const result = await courseService.unenrollFromCourse(
      userId,
      parseInt(courseId)
    );
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json(formatError(error.message));
  }
};

export const checkCourseEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json(formatDetailedError('يجب تسجيل الدخول أولاً'));
    }

    const isEnrolled = await courseService.checkEnrollment(
      userId,
      parseInt(courseId)
    );
    
    // إرجاع البيانات مباشرة بدون تغليفها
    res.status(200).json({ isEnrolled });
  } catch (error) {
    console.error('خطأ في فحص حالة التسجيل:', error);
    res.status(500).json(formatDetailedError('حدث خطأ في فحص حالة التسجيل', error));
  }
};
