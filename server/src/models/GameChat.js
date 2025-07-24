import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const GameChat = sequelize.define(
  'GameChat',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'game_id',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    messageType: {
      type: DataTypes.ENUM('text', 'sticker', 'system'),
      allowNull: false,
      defaultValue: 'text',
      field: 'message_type',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    tableName: 'game_chat',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default GameChat; 