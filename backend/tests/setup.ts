process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = "./test.sqlite";

import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

jest.setTimeout(60000);

beforeAll(async () => {
  // Connect and sync fresh schema
  await Database.createConnection();
  await sequelize.query("PRAGMA foreign_keys = OFF;");
  await sequelize.sync({ force: true });
  await sequelize.query("PRAGMA foreign_keys = ON;");

  // Seed default admin user so that Activity's createdById constraint does not fail
  try {
    await sequelize.models.User.findOrCreate({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      defaults: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Admin User",
        email: "admin@nexus.com",
        password: "hashedpassword123",
        role: "admin",
        isAvailable: true,
        maxOpenLeads: 50
      }
    });
  } catch (e) {}
});

afterAll(async () => {
  // Teardown
});
