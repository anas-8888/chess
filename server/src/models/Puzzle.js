import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Puzzle = sequelize.define(
  'Puzzle',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
    },
    level: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      defaultValue: 'easy',
    },
    fen: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    details: {
      type: DataTypes.STRING(200),
    },
    solution: {
      type: DataTypes.JSON,
      allowNull: false,
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
    tableName: 'puzzle',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Puzzle;
