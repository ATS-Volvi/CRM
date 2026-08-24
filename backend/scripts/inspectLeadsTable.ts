import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const desc = await sequelize.getQueryInterface().describeTable("Leads");
  console.log("Leads columns in DB:", Object.keys(desc));
  process.exit(0);
}

main().catch(console.error);
