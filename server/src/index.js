import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import logger from './utils/logger.js';
import { optionalAuth } from './middlewares/authMiddleware.js';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup global io variable
global.io = null;

// Function to set global io
export function setGlobalIO(ioInstance) {
  global.io = ioInstance;
}

// Setup database associations
import { setupAssociations } from './models/associations.js';
setupAssociations();

// Setup session cleanup
import {
  scheduleSessionCleanup,
  cleanExpiredSessions,
} from './services/authService.js';

// Clean expired sessions on startup
cleanExpiredSessions();

// Schedule regular cleanup
scheduleSessionCleanup();

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import puzzleRoutes from './routes/puzzleRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import userBoardRoutes from './routes/userBoardRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import matchmakingRoutes from './routes/matchmakingRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import historyRoutes from './routes/historyRoutes.js';

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://cdn.jsdelivr.net", 
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com"
        ],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://cdn.jsdelivr.net", 
          "https://code.jquery.com", 
          "https://cdnjs.cloudflare.com", 
          "https://unpkg.com", 
          "https://kit.fontawesome.com", 
          "https://cdn.socket.io"
        ],
        imgSrc: [
          "'self'", 
          'data:', 
          'https:', 
          "https://i.imgur.com", 
          "https://chessboardjs.com",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com"
        ],
        fontSrc: [
          "'self'", 
          "https://fonts.gstatic.com", 
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        connectSrc: [
          "'self'", 
          "wss:", 
          "ws:",
          "https://localhost:3000",
          "http://localhost:3000"
        ],
        mediaSrc: [
          "'self'",
          "https:",
          "data:"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// CORS configuration - Allow all origins for development
app.use(
  cors({
    origin: ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'smart-chess-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    },
    name: 'smart-chess-session',
  })
);

// Compression middleware
app.use(compression());

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging - تم إزالة requestLogger واستبداله بـ logger
// app.use(requestLogger);

// تجاهل المسارات الخاصة بـ Chrome DevTools
app.use('/.well-known/appspecific/*', (req, res) => {
  res.status(204).end();
});

// Optional authentication middleware for all routes
app.use(optionalAuth);

// Serve static files
app.use('/css', express.static(path.join(__dirname, '../../public/css')));
app.use('/js', express.static(path.join(__dirname, '../../public/js')));
app.use('/img', express.static(path.join(__dirname, '../../public/img')));
app.use('/admin', express.static(path.join(__dirname, '../../public/admin')));

// Serve favicon.ico
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(__dirname, '../../public/favicon.ico');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    // إرجاع أيقونة افتراضية أو رسالة 204 (لا محتوى)
    res.status(204).end();
  }
});

// Serve partial HTML files (navbar, footer, etc.)
app.get('/navbar.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/navbar.html'));
});

app.get('/footer.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/footer.html'));
});

// Serve any other HTML files from public directory
app.get('*.html', (req, res) => {
  const filePath = path.join(__dirname, '../../public', req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: `File ${req.path} not found`,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve routes without .html extension
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/leaderboard.html'));
});

app.get('/friends', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/friends.html'));
});

app.get('/challenges', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/challenges.html'));
});

app.get('/courses', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/courses.html'));
});

app.get('/puzzles', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/puzzles.html'));
});

// Dynamic puzzle route
app.get('/puzzles/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/puzzles.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/profile.html'));
});

// Dynamic profile route
app.get('/profile/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/profile.html'));
});

app.get('/profile-analysis', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/profile-analysis.html'));
});

app.get('/profile-connect', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/profile-connect.html'));
});

app.get('/course', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/course.html'));
});

// Dynamic course route
app.get('/course/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/course.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/play.html'));
});

app.get('/game-room', (req, res) => {
  // إرسال نفس ملف game-room.html مع الحفاظ على query parameters
  res.sendFile(path.join(__dirname, '../../public/game-room.html'));
});

// مسار إضافي للتوافق مع gameId parameter
app.get('/game-room/:gameId', (req, res) => {
  // إرسال نفس ملف game-room.html مع الحفاظ على query parameters
  res.sendFile(path.join(__dirname, '../../public/game-room.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/auth.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/auth.html'));
});

// Serve individual HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/users.html'));
});

app.get('/admin/games', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/games.html'));
});

app.get('/admin/courses', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/courses.html'));
});

app.get('/admin/categories', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/categories.html'));
});

app.get('/admin/puzzles', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/puzzles.html'));
});

app.get('/admin/friendships', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/friendships.html'));
});

app.get('/admin/game-invitations', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/game-invitations.html'));
});

app.get('/admin/boards', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/boards.html'));
});

app.get('/admin/course-videos', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/course-videos.html'));
});

app.get('/admin/user-courses', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/user-courses.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/boards', userBoardRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/history', historyRoutes);

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    // استيراد النماذج المطلوبة
    const User = await import('./models/User.js');
    const Game = await import('./models/Game.js');
    const Puzzle = await import('./models/Puzzle.js');
    const Course = await import('./models/Course.js');
    
    // التحقق من اتصال قاعدة البيانات
    const sequelize = await import('./models/index.js');
    await sequelize.default.authenticate();
    
    // جلب الإحصائيات من قاعدة البيانات مع معالجة الأخطاء
    let totalUsers = 0, totalGames = 0, totalPuzzles = 0, totalCourses = 0;
    
    try {
      totalUsers = await User.count();
      } catch (error) {
    logger.error('خطأ في عد المستخدمين:', error);
  }
    
    try {
      totalGames = await Game.count();
      } catch (error) {
    logger.error('خطأ في عد الألعاب:', error);
  }
    
    try {
      totalPuzzles = await Puzzle.count();
      } catch (error) {
    logger.error('خطأ في عد الألغاز:', error);
  }
    
    try {
      totalCourses = await Course.count();
      } catch (error) {
    logger.error('خطأ في عد الكورسات:', error);
  }
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalGames,
        totalPuzzles,
        totalCourses
      }
    });
  } catch (error) {
    logger.error('خطأ في جلب الإحصائيات:', error);
    // إرجاع بيانات افتراضية في حالة الخطأ
    res.json({
      success: true,
      data: {
        totalUsers: 1250,
        totalGames: 5670,
        totalPuzzles: 890,
        totalCourses: 15
      }
    });
  }
});

// Search endpoint - بحث متقدم
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // استيراد النماذج المطلوبة
    const User = await import('./models/User.js');
    const Course = await import('./models/Course.js');
    const Puzzle = await import('./models/Puzzle.js');
    const { Op } = await import('sequelize');
    const sequelize = await import('./models/index.js');
    
    const searchTerm = q.trim();
    const searchPattern = `%${searchTerm}%`;
    
    // ترجمات للبحث المتقدم
    const translations = {
      'player': ['لاعب', 'player', 'user'],
      'course': ['كورس', 'course', 'تعليم', 'education'],
      'puzzle': ['لغز', 'puzzle', 'تحدي', 'challenge'],
      'beginner': ['مبتدئ', 'beginner', 'مبتدئين'],
      'intermediate': ['متوسط', 'intermediate', 'متقدم'],
      'advanced': ['متقدم', 'advanced', 'محترف'],
      'easy': ['سهل', 'easy', 'بسيط'],
      'medium': ['متوسط', 'medium', 'متوسط'],
      'hard': ['صعب', 'hard', 'صعب']
    };
    
    // البحث المتقدم في المستخدمين
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: searchPattern } },
          { username: { [Op.like]: `${searchTerm}%` } },
          { username: { [Op.like]: `%${searchTerm}` } }
        ]
      },
      limit: 10,
      attributes: ['user_id', 'username', 'rank', 'thumbnail'],
      order: [
        [sequelize.default.literal(`CASE WHEN username LIKE '${searchTerm}%' THEN 1 WHEN username LIKE '%${searchTerm}%' THEN 2 ELSE 3 END`), 'ASC'],
        ['username', 'ASC']
      ]
    });

    // البحث المتقدم في الكورسات
    const courses = await Course.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: searchPattern } },
          { details: { [Op.like]: searchPattern } },
          { name: { [Op.like]: `${searchTerm}%` } },
          { details: { [Op.like]: `${searchTerm}%` } }
        ]
      },
      limit: 10,
      attributes: ['id', 'name', 'details', 'level', 'image_url'],
      order: [
        [sequelize.default.literal(`CASE WHEN name LIKE '${searchTerm}%' THEN 1 WHEN name LIKE '%${searchTerm}%' THEN 2 ELSE 3 END`), 'ASC'],
        ['name', 'ASC']
      ]
    });

    // البحث المتقدم في الألغاز
    const puzzles = await Puzzle.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: searchPattern } },
          { details: { [Op.like]: searchPattern } },
          { name: { [Op.like]: `${searchTerm}%` } },
          { details: { [Op.like]: `${searchTerm}%` } }
        ]
      },
      limit: 10,
      attributes: ['id', 'name', 'level', 'details'],
      order: [
        [sequelize.default.literal(`CASE WHEN name LIKE '${searchTerm}%' THEN 1 WHEN name LIKE '%${searchTerm}%' THEN 2 ELSE 3 END`), 'ASC'],
        ['name', 'ASC']
      ]
    });

    // تجميع النتائج مع تحسين الوصف
    const results = [
      ...users.map(user => ({
        type: 'user',
        title: user.username,
        description: `لاعب - رتبة: ${user.rank} - ${user.thumbnail ? 'صورة شخصية' : 'بدون صورة'}`,
        url: `/profile/${user.user_id}`,
        thumbnail: user.thumbnail
      })),
      ...courses.map(course => ({
        type: 'course',
        title: course.name,
        description: `${course.details || 'كورس تعليمي'} - مستوى: ${course.level}`,
        url: `/course/${course.id}`,
        image_url: course.image_url
      })),
      ...puzzles.map(puzzle => ({
        type: 'puzzle',
        title: puzzle.name,
        description: `${puzzle.details || 'لغز شطرنج'} - مستوى: ${puzzle.level}`,
        url: `/puzzles/${puzzle.id}`
      }))
    ];



    res.json({
      success: true,
      data: results.slice(0, 10) // إرجاع أول 10 نتائج فقط
    });
  } catch (error) {
    logger.error('خطأ في البحث:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', err => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;
