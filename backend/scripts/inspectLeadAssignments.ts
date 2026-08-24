import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const [users]: any = await sequelize.query('SELECT id, name, email, role FROM "Users";');
  console.log("Users in DB:", users);

  const [leadAssignees]: any = await sequelize.query('SELECT "assignedToId", COUNT(*) as count FROM "Leads" GROUP BY "assignedToId";');
  console.log("Leads assignedToId distribution:", leadAssignees);

  process.exit(0);
}

main().catch(console.error);
