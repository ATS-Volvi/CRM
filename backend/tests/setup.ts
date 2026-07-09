import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

beforeAll(async () => {
  // Override database for testing
  process.env.DB_DIALECT = "sqlite";
  process.env.DB_STORAGE = "./test.sqlite";

  // Connect and sync fresh schema
  await Database.createConnection();
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
