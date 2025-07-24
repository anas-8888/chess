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
    player1_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    player2_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    status: {
      type: DataTypes.ENUM('waiting', 'active', 'paused', 'finished', 'abandoned'),
      defaultValue: 'waiting',
      allowNull: false,
    },
    winner: {
      type: DataTypes.ENUM('player1', 'player2', 'draw', null),
      allowNull: true,
    },
    game_type: {
      type: DataTypes.ENUM('friendly', 'competitive'),
      defaultValue: 'friendly',
      allowNull: false,
    },
    time_control: {
      type: DataTypes.INTEGER, // في الدقائق
      defaultValue: 10,
      allowNull: false,
    },
    current_fen: {
      type: DataTypes.TEXT,
      defaultValue: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      allowNull: false,
    },
    move_history: {
      type: DataTypes.TEXT, // JSON string of moves
      defaultValue: '[]',
    },
    white_time_left: {
      type: DataTypes.INTEGER, // في الثواني
      defaultValue: 600,
    },
    black_time_left: {
      type: DataTypes.INTEGER, // في الثواني
      defaultValue: 600,
    },
    current_turn: {
      type: DataTypes.ENUM('white', 'black'),
      defaultValue: 'white',
    },
    last_move_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'games',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Game; 