import { Sequelize } from 'sequelize';
import config from '../../config/index.js';

const sequelize = new Sequelize(
  config.db.database,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    dialect: 'mysql',
    pool: {
      max: 20,
      min: 0,
      idle: 10000,
    },
    logging: false,
  }
);

export default sequelize;
