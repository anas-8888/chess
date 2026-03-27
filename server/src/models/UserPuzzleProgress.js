import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const UserPuzzleProgress = sequelize.define(
  'UserPuzzleProgress',
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
    attempts_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    success_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    fail_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_mistakes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_hints_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    used_solution_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    best_time_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    points_earned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    first_solved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_solved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'user_puzzle_progress',
    timestamps: false,
  }
);

export default UserPuzzleProgress;

