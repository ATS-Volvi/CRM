import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const tables = await sequelize.getQueryInterface().showAllTables();
  console.log("Tables in database:", tables);
  process.exit(0);
}

main().catch(console.error);
