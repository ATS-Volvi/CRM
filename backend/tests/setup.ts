import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

beforeAll(async () => {
  // Override database for testing
  process.env.DB_DIALECT = "sqlite";
  process.env.DB_STORAGE = "./test.sqlite";

  // Connect and sync fresh schema
  await Database.createConnection();
  await sequelize.sync({ force: true });

  // Seed default admin user so that Activity's createdById constraint does not fail
  await sequelize.models.User.create({
    id: "00000000-0000-0000-0000-000000000000",
    name: "Admin User",
    email: "admin@nexus.com",
    password: "hashedpassword123",
    role: "admin",
    isAvailable: true,
    maxOpenLeads: 50
  });
});

afterAll(async () => {
  await sequelize.close();
});
