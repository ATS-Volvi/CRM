import { Sequelize } from "sequelize";
import * as path from "path";
import "dotenv/config";

const sqlitePath = __dirname.includes("dist")
  ? path.resolve(__dirname, "../../../nexus_crm.sqlite")
  : path.resolve(__dirname, "../../nexus_crm.sqlite");

export const sequelize = process.env.USE_SQLITE === "true"
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
        ssl: {
          require: true,
          rejectUnauthorized: false
        },
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
