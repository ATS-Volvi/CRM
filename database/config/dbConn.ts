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
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
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
