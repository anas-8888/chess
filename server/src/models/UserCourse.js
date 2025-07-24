import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const UserCourse = sequelize.define(
  'UserCourse',
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
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    purchase_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'user_course',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default UserCourse;
