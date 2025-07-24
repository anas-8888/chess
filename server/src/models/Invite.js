import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Invite = sequelize.define(
  'Invite',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    from_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    to_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired', 'game_started'),
      defaultValue: 'pending',
      allowNull: false,
    },
    game_type: {
      type: DataTypes.ENUM('friendly', 'competitive'),
      defaultValue: 'friendly',
      allowNull: false,
    },
    time_control: {
      type: DataTypes.INTEGER, // في الدقائق
      defaultValue: 10,
      allowNull: false,
    },
    play_method: {
      type: DataTypes.ENUM('physical_board', 'phone'),
      defaultValue: 'phone',
    },
    date_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    game_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'game',
        key: 'id'
      }
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: 'invites',
    timestamps: false,
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default Invite; 