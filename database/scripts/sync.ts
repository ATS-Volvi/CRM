import { sequelize } from "../models";

async function syncDatabase() {
  try {
    console.log("Connecting to the database...");
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    console.log("Syncing models with the database (alter mode)...");
    await sequelize.sync({ alter: true });
    console.log("Database synchronized successfully!");
  } catch (error) {
    console.error("Unable to connect to or sync the database:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

syncDatabase();
