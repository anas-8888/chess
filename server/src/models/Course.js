import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Course = sequelize.define(
  'Course',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    details: {
      type: DataTypes.STRING(200),
    },
    level: {
      type: DataTypes.ENUM('beginner', 'intermediate', 'pro'),
      defaultValue: 'beginner',
    },
    image_url: {
      type: DataTypes.STRING(255),
    },
    hours: {
      type: DataTypes.DECIMAL(4, 1),
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
    tableName: 'course',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Course;
