import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Game = sequelize.define(
  'Game',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // الربط باللاعبين
    white_player_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    black_player_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    started_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // نوع اللعبة وبيانات خاصة
    game_type: {
      type: DataTypes.ENUM('friend', 'ranked', 'ai', 'puzzle'),
      allowNull: false,
    },
    ai_level: {
      type: DataTypes.TINYINT,
      allowNull: true,
    },
    puzzle_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // الوقت (بالثواني)
    initial_time: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    white_time_left: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    black_time_left: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // طريقة اللعب لكل لاعب
    white_play_method: {
      type: DataTypes.ENUM('phone', 'physical_board'),
      allowNull: false,
    },
    black_play_method: {
      type: DataTypes.ENUM('phone', 'physical_board'),
      allowNull: false,
    },
    // حالة الرقعة
    current_fen: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'startpos',
    },
    // حالة اللعبة والفائز
    status: {
      type: DataTypes.ENUM('waiting', 'active', 'ended'),
      allowNull: false,
      defaultValue: 'waiting',
    },
    current_turn: {
      type: DataTypes.ENUM('white', 'black'),
      allowNull: false,
      defaultValue: 'white',
    },
    winner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // تغيّر التصنيف لكل طرف
    white_rank_change: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    black_rank_change: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // تتبُّع الأوقات
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'game',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Game; 