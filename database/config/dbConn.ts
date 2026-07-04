import { Sequelize } from "sequelize";
import "dotenv/config";

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: false,
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
