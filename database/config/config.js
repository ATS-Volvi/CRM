require('dotenv').config({ path: require('path').resolve(__dirname, '../../backend/.env') });
const path = require('path');

const isSqlite = process.env.USE_SQLITE === 'true';

const sqliteConfig = {
  dialect: 'sqlite',
  storage: path.resolve(__dirname, '../../nexus_crm.sqlite'),
  logging: false
};

const postgresConfig = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectOptions: process.env.DATABASE_URL?.includes('localhost') ? {} : {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
};

const config = isSqlite ? sqliteConfig : postgresConfig;

module.exports = {
  development: config,
  test: config,
  production: config
};
