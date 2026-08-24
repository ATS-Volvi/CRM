import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const migration = require("../../database/migrations/20260818000000-update-lead-status-default.js");
  await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
  console.log("Migration up completed.");
  process.exit(0);
}

main().catch(console.error);
