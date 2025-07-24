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
import logger from '../utils/logger.js';

// تعريف العلاقات بين الموديلات
// Course belongs to Category
Course.belongsTo(Category, { foreignKey: 'category_id' });
Category.hasMany(Course, { foreignKey: 'category_id' });

// CourseVideo belongs to Course
CourseVideo.belongsTo(Course, { foreignKey: 'course_id' });
Course.hasMany(CourseVideo, { foreignKey: 'course_id' });

// Game relationships
Game.belongsTo(User, { as: 'whitePlayer', foreignKey: 'white_user_id' });
Game.belongsTo(User, { as: 'blackPlayer', foreignKey: 'black_user_id' });
User.hasMany(Game, { as: 'whiteGames', foreignKey: 'white_user_id' });
User.hasMany(Game, { as: 'blackGames', foreignKey: 'black_user_id' });

// GameMove belongs to Game
GameMove.belongsTo(Game, { foreignKey: 'gameId' });
Game.hasMany(GameMove, { foreignKey: 'gameId' });

// Session belongs to User
Session.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Session, { foreignKey: 'user_id' });

// Friend relationships
Friend.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Friend.belongsTo(User, { as: 'friendUser', foreignKey: 'friend_user_id' });
User.hasMany(Friend, { as: 'friends', foreignKey: 'user_id' });
User.hasMany(Friend, { as: 'friendOf', foreignKey: 'friend_user_id' });

// Invite relationships
Invite.belongsTo(User, { as: 'FromUser', foreignKey: 'from_user_id' });
Invite.belongsTo(User, { as: 'ToUser', foreignKey: 'to_user_id' });
Invite.belongsTo(Game, { foreignKey: 'game_id' });
User.hasMany(Invite, { as: 'SentInvites', foreignKey: 'from_user_id' });
User.hasMany(Invite, { as: 'ReceivedInvites', foreignKey: 'to_user_id' });
Game.hasMany(Invite, { foreignKey: 'game_id' });

// UserBoard belongs to User
UserBoard.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(UserBoard, { foreignKey: 'user_id' });

// UserCourse relationships
UserCourse.belongsTo(User, { foreignKey: 'user_id' });
UserCourse.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(UserCourse, { foreignKey: 'user_id' });
Course.hasMany(UserCourse, { foreignKey: 'course_id' });

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

    // 3) مزامنة الجداول عبر نفس الـ instance الذي تعرفت عليه موديلاتك
    logger.info('Creating tables...');
    await sequelize.sync({ alter: true });
    logger.info('All tables created successfully');

    // 4) إضافة البيانات الأولية
    logger.info('Adding initial data...');

    // إضافة الفئات
    logger.info('Adding categories...');
    await Category.bulkCreate([
      { name: 'beginner' },
      { name: 'intermediate' },
      { name: 'pro' },
    ]);
    logger.info('Categories added');

    // إضافة المستخدمين
    logger.info('Adding users...');
    await User.bulkCreate([
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
    await Course.bulkCreate([
      {
        category_id: 1,
        name: 'المبادئ الأساسية للشطرنج',
        details: 'دورة للمبتدئين',
        level: 'beginner',
        image_url: 'https://i.imgur.com/basic.png',
        hours: 2.5,
      },
      {
        category_id: 2,
        name: 'تكنيكات متقدمة',
        details: 'دورة للمتقدمين',
        level: 'intermediate',
        image_url: 'https://i.imgur.com/advanced.png',
        hours: 5.0,
      },
    ]);
    logger.info('Courses added');

    // إضافة فيديوهات الدورات
    logger.info('Adding course videos...');
    await CourseVideo.bulkCreate([
      {
        course_id: 1,
        title: 'الدرس الأول: الحركات الأساسية',
        url: 'https://youtu.be/example1',
        position: 1,
      },
      {
        course_id: 1,
        title: 'الدرس الثاني: فتحات بسيطة',
        url: 'https://youtu.be/example2',
        position: 2,
      },
      {
        course_id: 2,
        title: 'الدرس الثالث: تكتيكات',
        url: 'https://youtu.be/example3',
        position: 1,
      },
    ]);
    logger.info('Course videos added');

    // إضافة الألغاز
    logger.info('Adding puzzles...');
    await Puzzle.bulkCreate([
      {
        name: 'مفتاح الشعاع',
        level: 'easy',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        details: 'ابدأ بتحريك الحصان للسيطرة على المركز',
        solution: JSON.stringify(['Nxe5', 'Nxe5', 'd4', 'Nc6']),
      },
      {
        name: 'هجوم الفيل',
        level: 'medium',
        fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2',
        details: 'استغل ضعف الملك في الطرف',
        solution: JSON.stringify(['d4', 'cxd4', 'Nxd4', 'e5']),
      },
    ]);
    logger.info('Puzzles added');

    // إضافة الأصدقاء
    logger.info('Adding friends...');
    await Friend.bulkCreate([
      { user_id: 1, friend_user_id: 2, status: 'accepted' },
      { user_id: 1, friend_user_id: 3, status: 'pending' },
      { user_id: 2, friend_user_id: 3, status: 'accepted' },
    ]);
    logger.info('Friends added');

    // إضافة الدعوات
    logger.info('Adding invites...');
    await Invite.bulkCreate([
      { from_user_id: 1, to_user_id: 3, status: 'pending' },
    ]);
    logger.info('Invites added');

    // إضافة لوحات المستخدمين
    logger.info('Adding user boards...');
    await UserBoard.bulkCreate([
      {
        user_id: 1,
        serial_number: 'ABC123XYZ',
        name: 'لوحة المكتب',
        connected: true,
      },
      {
        user_id: 2,
        serial_number: 'DEF456UVW',
        name: 'لوحة الغرفة',
        connected: false,
      },
    ]);
    logger.info('User boards added');

    // إضافة دورات المستخدمين
    logger.info('Adding user courses...');
    await UserCourse.bulkCreate([
      { user_id: 1, course_id: 1 },
      { user_id: 1, course_id: 2 },
    ]);
    logger.info('User courses added');

    // إضافة لعبة
    logger.info('Adding games...');
    await Game.bulkCreate([
      {
        white_user_id: 1,
        black_user_id: 2,
        white_play_method: 'local',
        black_play_method: 'board',
        game_time: '5',
        mode: 'friend',
      },
    ]);
    logger.info('Games added');

    // إضافة حركات اللعبة
    logger.info('Adding game moves...');
    await GameMove.bulkCreate([
      { gameId: 1, moveNum: 1, move: 'e4', movedBy: 'white' },
      { gameId: 1, moveNum: 1, move: 'e5', movedBy: 'black' },
      { gameId: 1, moveNum: 2, move: 'Nf3', movedBy: 'white' },
      { gameId: 1, moveNum: 2, move: 'Nc6', movedBy: 'black' },
    ]);
    logger.info('Game moves added');

    // إضافة جلسة
    logger.info('Adding sessions...');
    await Session.bulkCreate([
      {
        id: 'sess-uuid-1234',
        user_id: 1,
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT)',
        expires_at: new Date('2025-07-01 00:00:00'),
        last_activity: new Date('2025-06-27 10:00:00'),
      },
    ]);
    logger.info('Sessions added');



    logger.info('Database initialization completed successfully!');
    process.exit(0);
  } catch (err) {
    logger.error('Error syncing database:', err);
    logger.error('Error details:', err.message);
    process.exit(1);
  }
})();
