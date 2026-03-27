import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const UserPuzzleAttempt = sequelize.define(
  'UserPuzzleAttempt',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    puzzle_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('solved', 'failed', 'abandoned'),
      allowNull: false,
      defaultValue: 'failed',
    },
    moves_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    mistakes_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    hints_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    used_solution: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    elapsed_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    points_awarded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'user_puzzle_attempt',
    timestamps: false,
  }
);

export default UserPuzzleAttempt;

