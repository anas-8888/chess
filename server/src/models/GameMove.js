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
    move: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    movedBy: {
      type: DataTypes.ENUM('white', 'black'),
      allowNull: false,
      field: 'moved_by',
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
