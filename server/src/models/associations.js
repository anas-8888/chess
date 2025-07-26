// Import models
import User from './User.js';
import Session from './Session.js';
import Category from './Category.js';
import Course from './Course.js';
import CourseVideo from './CourseVideo.js';
import Friend from './Friend.js';
import Game from './Game.js';
import GameMove from './GameMove.js';
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
  User.hasMany(Game, { foreignKey: 'white_player_id', as: 'whiteGames' });
  User.hasMany(Game, { foreignKey: 'black_player_id', as: 'blackGames' });
  User.hasMany(Game, { foreignKey: 'started_by_user_id', as: 'startedGames' });
  User.hasMany(Game, { foreignKey: 'winner_id', as: 'wonGames' });
  
  Game.belongsTo(User, { foreignKey: 'white_player_id', as: 'whitePlayer' });
  Game.belongsTo(User, { foreignKey: 'black_player_id', as: 'blackPlayer' });
  Game.belongsTo(User, { foreignKey: 'started_by_user_id', as: 'startedBy' });
  Game.belongsTo(User, { foreignKey: 'winner_id', as: 'winner' });

  // GameMove associations
  Game.hasMany(GameMove, { foreignKey: 'game_id', as: 'moves' });
  GameMove.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
  
  User.hasMany(GameMove, { foreignKey: 'player_id', as: 'moves' });
  GameMove.belongsTo(User, { foreignKey: 'player_id', as: 'player' });

  // Puzzle associations
  Puzzle.hasMany(Game, { foreignKey: 'puzzle_id', as: 'games' });
  Game.belongsTo(Puzzle, { foreignKey: 'puzzle_id', as: 'puzzle' });

  // Invite associations
  User.hasMany(Invite, { foreignKey: 'from_user_id', as: 'sentInvites' });
  User.hasMany(Invite, { foreignKey: 'to_user_id', as: 'receivedInvites' });
  Invite.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });
  Invite.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });

  // Game-Invite association
  Invite.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
  Game.hasOne(Invite, { foreignKey: 'game_id', as: 'invite' });

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
  Invite,
  Puzzle,
  UserBoard,
  UserCourse,
};
