// Import models
import User from './User.js';
import Session from './Session.js';
import Category from './Category.js';
import Course from './Course.js';
import CourseVideo from './CourseVideo.js';
import Friend from './Friend.js';
import Game from './Game.js';
import GameMove from './GameMove.js';
import GameChat from './GameChat.js';
import Invite from './Invite.js';
import Puzzle from './Puzzle.js';
import UserBoard from './UserBoard.js';
import UserCourse from './UserCourse.js';

// Define associations
export function setupAssociations() {
  // User associations
  User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
  Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Friend associations
  User.hasMany(Friend, { foreignKey: 'user_id', as: 'friends' });
  User.hasMany(Friend, { foreignKey: 'friend_user_id', as: 'friendOf' });
  Friend.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Friend.belongsTo(User, { foreignKey: 'friend_user_id', as: 'friend' });

  // Game associations
  User.hasMany(Game, { foreignKey: 'player1_id', as: 'player1Games' });
  User.hasMany(Game, { foreignKey: 'player2_id', as: 'player2Games' });

  // Invite associations
  User.hasMany(Invite, { foreignKey: 'from_user_id', as: 'sentInvites' });
  User.hasMany(Invite, { foreignKey: 'to_user_id', as: 'receivedInvites' });
  Invite.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });
  Invite.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });

  User.hasMany(UserBoard, { foreignKey: 'user_id', as: 'boards' });
  User.hasMany(UserCourse, { foreignKey: 'user_id', as: 'enrolledCourses' });

  // Category associations
  Category.hasMany(Course, { foreignKey: 'category_id', as: 'courses' });
  Course.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

  // Course associations
  Course.hasMany(CourseVideo, { foreignKey: 'course_id', as: 'videos' });
  CourseVideo.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

  Course.hasMany(UserCourse, { foreignKey: 'course_id', as: 'enrollments' });
  UserCourse.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

  // Game associations
  Game.hasMany(GameMove, { foreignKey: 'gameId', as: 'moves' });
  GameMove.belongsTo(Game, { foreignKey: 'gameId', as: 'game' });

  Game.hasMany(GameChat, { foreignKey: 'gameId', as: 'chatMessages' });
  GameChat.belongsTo(Game, { foreignKey: 'gameId', as: 'game' });

  Game.belongsTo(User, { foreignKey: 'player1_id', as: 'player1' });
  Game.belongsTo(User, { foreignKey: 'player2_id', as: 'player2' });

  // GameChat associations
  GameChat.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(GameChat, { foreignKey: 'userId', as: 'chatMessages' });
}

// Export all models
export {
  User,
  Session,
  Category,
  Course,
  CourseVideo,
  Friend,
  Game,
  GameMove,
  GameChat,
  Invite,
  Puzzle,
  UserBoard,
  UserCourse,
};
