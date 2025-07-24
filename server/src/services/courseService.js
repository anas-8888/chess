import { Op } from 'sequelize';
import Category from '../models/Category.js';
import Course from '../models/Course.js';
import CourseVideo from '../models/CourseVideo.js';
import UserCourse from '../models/UserCourse.js';
import User from '../models/User.js';
import { paginate, sortBy, handleSequelizeError } from '../utils/helpers.js';

// ==================== CATEGORY SERVICES ====================

export const getAllCategories = async (query = {}) => {
  try {
    const { search, page = 1, limit = 10 } = query;
    const { offset, limit: limitNum } = paginate(page, limit);

    const whereClause = {};
    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }

    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      offset,
      limit: limitNum,
      order: [['name', 'ASC']],
    });

    return {
      categories,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const createCategory = async categoryData => {
  try {
    const category = await Category.create(categoryData);
    return category;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const updateCategory = async (id, updateData) => {
  try {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Category not found');
    }

    await category.update(updateData);
    return category;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const deleteCategory = async id => {
  try {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new Error('Category not found');
    }

    await category.destroy();
    return { id, deleted_at: new Date() };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

// ==================== COURSE SERVICES ====================

export const getAllCourses = async (query = {}) => {
  try {
    const {
      category,
      level,
      search,
      page = 1,
      limit = 10,
      sortBy: sortField = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const { offset, limit: limitNum } = paginate(page, limit);
    const order = sortBy(sortField, sortOrder);

    const whereClause = {};

    if (category) {
      whereClause.category_id = parseInt(category);
    }

    if (level) {
      whereClause.level = level;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { details: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
      ],
      offset,
      limit: limitNum,
      order,
    });

    // If no courses found, return default courses
    if (count === 0) {
      const defaultCourses = [
        {
          id: 1,
          name: 'المبادئ الأساسية للشطرنج',
          details: 'دورة للمبتدئين تتعلم فيها الحركات الأساسية والاستراتيجيات البسيطة',
          level: 'beginner',
          image_url: 'https://i.imgur.com/basic.png',
          hours: 2.5,
          category: { id: 1, name: 'beginner' }
        },
        {
          id: 2,
          name: 'تكنيكات متقدمة',
          details: 'دورة للمتقدمين تتعلم فيها التكتيكات المتقدمة والاستراتيجيات المعقدة',
          level: 'intermediate',
          image_url: 'https://i.imgur.com/advanced.png',
          hours: 5.0,
          category: { id: 2, name: 'intermediate' }
        },
        {
          id: 3,
          name: 'استراتيجيات الاحتراف',
          details: 'دورة للاحترافيين تتعلم فيها الاستراتيجيات المتقدمة والتحليل العميق',
          level: 'pro',
          image_url: 'https://i.imgur.com/pro.png',
          hours: 8.0,
          category: { id: 3, name: 'pro' }
        }
      ];

      return {
        courses: defaultCourses,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total: defaultCourses.length,
          pages: 1,
        },
      };
    }

    return {
      courses,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const getCourseById = async id => {
  try {
    const course = await Course.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: CourseVideo,
          as: 'videos',
          attributes: ['id', 'title', 'url', 'position'],
          order: [['position', 'ASC']],
        },
      ],
    });

    if (!course) {
      throw new Error('Course not found');
    }

    return course;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const createCourse = async courseData => {
  try {
    const course = await Course.create(courseData);
    return course;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const updateCourse = async (id, updateData) => {
  try {
    const course = await Course.findByPk(id);
    if (!course) {
      throw new Error('Course not found');
    }

    await course.update(updateData);
    return course;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const deleteCourse = async id => {
  try {
    const course = await Course.findByPk(id);
    if (!course) {
      throw new Error('Course not found');
    }

    await course.destroy();
    return { id, deleted_at: new Date() };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

// ==================== COURSE VIDEO SERVICES ====================

export const getCourseVideos = async courseId => {
  try {
    const videos = await CourseVideo.findAll({
      where: { course_id: courseId },
      order: [['position', 'ASC']],
    });

    return videos;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const addCourseVideo = async (courseId, videoData) => {
  try {
    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    const video = await CourseVideo.create({
      ...videoData,
      course_id: courseId,
    });

    return video;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const updateCourseVideo = async (courseId, videoId, updateData) => {
  try {
    const video = await CourseVideo.findOne({
      where: { id: videoId, course_id: courseId },
    });

    if (!video) {
      throw new Error('Video not found');
    }

    await video.update(updateData);
    return video;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const deleteCourseVideo = async (courseId, videoId) => {
  try {
    const video = await CourseVideo.findOne({
      where: { id: videoId, course_id: courseId },
    });

    if (!video) {
      throw new Error('Video not found');
    }

    await video.destroy();
    return { id: videoId, deleted_at: new Date() };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

// ==================== USER COURSE SERVICES ====================

export const enrollInCourse = async (userId, courseId) => {
  try {
    // التحقق من وجود معرف المستخدم
    if (!userId) {
      throw new Error('معرف المستخدم مطلوب');
    }

    // التحقق من وجود معرف الكورس
    if (!courseId) {
      throw new Error('معرف الكورس مطلوب');
    }

    // التحقق من وجود المستخدم في قاعدة البيانات
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('المستخدم غير موجود');
    }

    // التحقق من وجود الكورس
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw new Error('الكورس غير موجود');
    }

    // التحقق من عدم وجود تسجيل مسبق
    const existingEnrollment = await UserCourse.findOne({
      where: { user_id: userId, course_id: courseId },
    });

    if (existingEnrollment) {
      throw new Error('أنت مسجل بالفعل في هذا الكورس');
    }

    // إنشاء التسجيل الجديد
    const enrollment = await UserCourse.create({
      user_id: userId,
      course_id: courseId,
      purchase_at: new Date(),
    });

    return enrollment;
  } catch (error) {
    // إذا كان الخطأ من Sequelize، استخرج الرسالة المناسبة
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeDatabaseError') {
      throw new Error('حدث خطأ في قاعدة البيانات: ' + error.message);
    }
    
    // إذا كان خطأ مخصص منا، أرسله كما هو
    throw error;
  }
};

export const getUserCourses = async (userId, query = {}) => {
  try {
    const { page = 1, limit = 10 } = query;
    const { offset, limit: limitNum } = paginate(page, limit);

    const { count, rows: enrollments } = await UserCourse.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: Course,
          as: 'course',
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      offset,
      limit: limitNum,
      order: [['purchase_at', 'DESC']],
    });

    return {
      enrollments,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const unenrollFromCourse = async (userId, courseId) => {
  try {
    const enrollment = await UserCourse.findOne({
      where: { user_id: userId, course_id: courseId },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    await enrollment.destroy();
    return { deleted_at: new Date() };
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};

export const checkEnrollment = async (userId, courseId) => {
  try {
    const enrollment = await UserCourse.findOne({
      where: { user_id: userId, course_id: courseId },
    });

    return !!enrollment;
  } catch (error) {
    throw new Error(handleSequelizeError(error).message);
  }
};
