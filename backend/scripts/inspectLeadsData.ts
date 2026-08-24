import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const count = await sequelize.models.Lead.count();
  console.log(`Total Leads count in database: ${count}`);

  const [rawRows]: any = await sequelize.query('SELECT status, COUNT(*) as count FROM "Leads" GROUP BY status;');
  console.log("Leads grouped by status:", rawRows);

  const sampleLeads = await sequelize.models.Lead.findAll({ limit: 10 });
  console.log("Sample 10 leads:", sampleLeads.map((l: any) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    company: l.company,
    status: l.status,
    createdAt: l.createdAt
  })));

  process.exit(0);
}

main().catch(console.error);
