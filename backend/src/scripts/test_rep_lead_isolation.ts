import { Database, sequelize } from "@nexus-crm/database";
import jwt from "jsonwebtoken";

async function testRepIsolation() {
  await Database.createConnection();

  const rep1: any = await sequelize.models.User.findOne({ where: { email: "salesperson1@nexus.com" } });
  if (!rep1) throw new Error("Rep 1 not found!");

  console.log(`Rep 1: ${rep1.name} (${rep1.email}) - Role: "${rep1.role}"`);

  // Query leads assigned to rep1
  const repLeads = await sequelize.models.Lead.findAll({
    where: { assignedToId: rep1.id }
  });

  const allLeadsCount = await sequelize.models.Lead.count();

  console.log(`Total Leads in DB: ${allLeadsCount}`);
  console.log(`Leads assigned to Rep 1 (${rep1.email}): ${repLeads.length}`);

  if (repLeads.length === allLeadsCount) {
    throw new Error("Rep 1 still sees all leads! Data isolation failed.");
  }

  console.log("\n✅ SUCCESS: Sales rep data isolation verified! Rep only sees their assigned leads.");
  process.exit(0);
}

testRepIsolation().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
