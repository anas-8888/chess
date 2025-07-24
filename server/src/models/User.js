import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const User = sequelize.define(
  'User',
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        is: /^[a-zA-Z0-9_]+$/,
      },
    },
    type: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
      validate: {
        isIn: [['user', 'admin']],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING(255),
      defaultValue: '/img/default-avatar.png',
    },
    rank: {
      type: DataTypes.INTEGER,
      defaultValue: 1200,
      validate: {
        min: 0,
        max: 3000,
      },
    },
    puzzle_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 10,
      },
    },
    state: {
      type: DataTypes.ENUM('online', 'offline', 'in-game'),
      defaultValue: 'offline',
      allowNull: false
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
    tableName: 'users',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
    hooks: {
      beforeUpdate: user => {
        user.updated_at = new Date();
      },
    },
  }
);

export default User;
