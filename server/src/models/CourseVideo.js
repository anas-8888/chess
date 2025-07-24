import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const CourseVideo = sequelize.define(
  'CourseVideo',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'course_video',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default CourseVideo;
