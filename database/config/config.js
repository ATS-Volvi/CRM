// Load .env only if DATABASE_URL is not already set in the environment.
// On Render (and other CI/CD platforms), DATABASE_URL is injected directly into
// the process environment — we must NOT override it by loading a local .env file.
// Locally, we fall back to backend/.env which carries the dev database URL.
const path = require('path');
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });
}

const isSqlite = process.env.USE_SQLITE === 'true';

const sqliteConfig = {
  dialect: 'sqlite',
  storage: path.resolve(__dirname, '../../nexus_crm.sqlite'),
  logging: false
};

function isLocalDatabaseHost(urlStr) {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

const postgresConfig = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectOptions: isLocalDatabaseHost(process.env.DATABASE_URL) ? {} : {
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
