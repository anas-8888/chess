import mysql from 'mysql2/promise';
import sequelize from './index.js';
import config from '../../config/index.js';
import Category from './Category.js';
import User from './User.js';
import Course from './Course.js';
import CourseVideo from './CourseVideo.js';
import Game from './Game.js';
import GameMove from './GameMove.js';
import Puzzle from './Puzzle.js';
import Session from './Session.js';
import Friend from './Friend.js';
import Invite from './Invite.js';
import UserBoard from './UserBoard.js';
import UserCourse from './UserCourse.js';
import { setupAssociations } from './associations.js';
import logger from '../utils/logger.js';

// Setup associations
setupAssociations();

(async () => {
  try {
    // 1) إنشاء القاعدة إذا لم تكن موجودة باستخدام اتصال mysql2
    const conn = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );
    await conn.end();
    logger.info(`Database '${config.db.database}' created/verified successfully`);

    // 2) تأكد من الاتصال بالـ Sequelize instance
    await sequelize.authenticate();
    logger.info('Database connection OK');

    // 3) حذف الجداول الموجودة بالترتيب الصحيح لتجنب مشاكل foreign key
    logger.info('Dropping existing tables...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // حذف الجداول بالترتيب العكسي للتبعيات
    const tablesToDrop = [
      'game_move',
      'game', 
      'session',
      'friend',
      'invite',
      'user_board',
      'user_course',
      'course_video',
      'course',
      'puzzle',
      'category',
      'users'
    ];
    
    for (const table of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
        logger.info(`Dropped table: ${table}`);
      } catch (error) {
        logger.warn(`Could not drop table ${table}:`, error.message);
      }
    }
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    logger.info('All existing tables dropped');

    // 4) مزامنة الجداول عبر نفس الـ instance الذي تعرفت عليه موديلاتك
    logger.info('Creating tables...');
    await sequelize.sync({ force: true });
    logger.info('All tables created successfully');

    // 5) إضافة البيانات الأولية
    logger.info('Adding initial data...');

    // إضافة الفئات أولاً
    logger.info('Adding categories...');
    const categories = await Category.bulkCreate([
      { name: 'beginner' },
      { name: 'intermediate' },
      { name: 'pro' },
    ]);
    logger.info('Categories added');

    // إضافة المستخدمين
    logger.info('Adding users...');
    const users = await User.bulkCreate([
      {
        username: 'bashar',
        type: 'user',
        email: 'bashar@example.com',
        password_hash: 'hash1',
        thumbnail: '/img/default-avatar.png',
        rank: 1400,
        puzzle_level: 2,
        state: 'online',
      },
      {
        username: 'ahmad',
        type: 'user',
        email: 'ahmad@example.com',
        password_hash: 'hash2',
        thumbnail: '/img/default-avatar.png',
        rank: 1350,
        puzzle_level: 1,
        state: 'offline',
      },
      {
        username: 'laila',
        type: 'user',
        email: 'laila@example.com',
        password_hash: 'hash3',
        thumbnail: '/img/default-avatar.png',
        rank: 1500,
        puzzle_level: 3,
        state: 'in-game',
      },
    ]);
    logger.info('Users added');

    // إضافة الدورات
    logger.info('Adding courses...');
    const courses = await Course.bulkCreate([
      {
        category_id: categories[0].id, // beginner category
        name: 'المبادئ الأساسية للشطرنج',
        details: 'دورة للمبتدئين',
        level: 'beginner',
        image_url: '/img/course1.jpg',
        hours: 10.5,
      },
      {
        category_id: categories[1].id, // intermediate category
        name: 'استراتيجيات متقدمة',
        details: 'دورة للمتوسطين',
        level: 'intermediate',
        image_url: '/img/course2.jpg',
        hours: 15.0,
      },
    ]);
    logger.info('Courses added');

    // إضافة الفيديوهات
    logger.info('Adding course videos...');
    await CourseVideo.bulkCreate([
      {
        course_id: courses[0].id,
        title: 'مقدمة في الشطرنج',
        url: 'https://example.com/video1.mp4',
        position: 1,
      },
      {
        course_id: courses[0].id,
        title: 'حركة القطع',
        url: 'https://example.com/video2.mp4',
        position: 2,
      },
      {
        course_id: courses[1].id,
        title: 'استراتيجيات الافتتاح',
        url: 'https://example.com/video3.mp4',
        position: 1,
      },
    ]);
    logger.info('Course videos added');

    // إضافة الألغاز
    logger.info('Adding puzzles...');
    await Puzzle.bulkCreate([
      {
        name: 'مات في حركتين',
        level: 'easy',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        details: 'أول لغز للمبتدئين',
        solution: { moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'] },
      },
      {
        name: 'مات في ثلاث حركات',
        level: 'medium',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        details: 'لغز متوسط',
        solution: { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'Nxe5'] },
      },
    ]);
    logger.info('Puzzles added');

    logger.info('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
})();
