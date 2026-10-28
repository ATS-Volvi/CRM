import { Sequelize } from "sequelize";
import * as path from "path";
import * as dotenv from "dotenv";
// Load .env only if DATABASE_URL is not already set in the environment.
// On Render (and other CI/CD platforms), DATABASE_URL is injected directly into
// the process environment — we must NOT override it by loading a local .env file.
if (!process.env.DATABASE_URL) {
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, "../../backend/.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env") });
}

const sqlitePath = __dirname.includes("dist")
  ? path.resolve(__dirname, "../../../nexus_crm.sqlite")
  : path.resolve(__dirname, "../../nexus_crm.sqlite");

const isLocalhost = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1"))
);

export const sequelize = (process.env.USE_SQLITE === "true" && !process.env.DATABASE_URL)
  ? new Sequelize({
      dialect: "sqlite",
      storage: sqlitePath,
      logging: false,
    })
  : process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 60000,
        idle: 10000,
        evict: 5000,
        validate: (client: any) => {
          return client && !client._ending && !client._connecting && client._connected !== false;
        }
      },
      retry: {
        max: 5,
        timeout: 60000,
        match: [
          /ETIMEDOUT/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeConnectionTimedOutError/,
          /Connection terminated unexpectedly/,
          /Connection error/,
          /deadlock detected/
        ]
      },
      dialectOptions: {
        ...(isLocalhost
          ? {}
          : {
              ssl: {
                require: true,
                rejectUnauthorized: false
              }
            }),
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        connectTimeout: 60000
      }
    })
  : new Sequelize(
      process.env.DB_NAME as string,
      process.env.DB_USERNAME as string,
      process.env.DB_PASSWORD as string,
      {
        host: "localhost",
        dialect: "postgres",
        logging: false,
      }
    );

export class Database {
  static async createConnection() {
    try {
      await sequelize.authenticate();
      console.log("DB connection established");
    } catch (error) {
      console.log("unable to connect to DB : ", error);
    }
  }
}
