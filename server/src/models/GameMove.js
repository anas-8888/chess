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
    game_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      }
    },
    move_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    player_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    uci: {
      type: DataTypes.STRING(8),
      allowNull: false,
    },
    san: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    fen_after: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: 'game_move',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default GameMove; 