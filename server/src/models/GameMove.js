import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const GameMove = sequelize.define(
  'GameMove',
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
    moveNum: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'move_num',
    },
    san: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    fen: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    movedBy: {
      type: DataTypes.ENUM('white', 'black'),
      allowNull: false,
      field: 'moved_by',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'game_move',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default GameMove;
