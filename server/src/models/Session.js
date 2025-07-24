import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Session = sequelize.define(
  'Session',
  {
    id: {
      type: DataTypes.STRING(512),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
    },
    user_agent: {
      type: DataTypes.STRING(255),
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
    },
    last_activity: {
      type: DataTypes.DATE,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'session',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Session;
