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
    white_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    black_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    white_play_method: {
      type: DataTypes.ENUM('local', 'board'),
      allowNull: false,
    },
    black_play_method: {
      type: DataTypes.ENUM('local', 'board'),
      allowNull: false,
    },
    game_time: {
      type: DataTypes.ENUM('5', '10', '15'),
      defaultValue: '5',
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM('friend', 'random', 'ai', 'challenge'),
      allowNull: false,
    },
    white_rating_change: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    black_rating_change: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    date_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'game',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Game; 