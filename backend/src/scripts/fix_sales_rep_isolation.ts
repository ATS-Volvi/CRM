import { Database, sequelize } from "@nexus-crm/database";

async function fixSalesRepRoleAndAssignments() {
  await Database.createConnection();

  // 1. Update roles in DB to "sales_rep"
  const rep1: any = await sequelize.models.User.findOne({ where: { email: "salesperson1@nexus.com" } });
  const rep2: any = await sequelize.models.User.findOne({ where: { email: "salesperson2@nexus.com" } });
  const amelia: any = await sequelize.models.User.findOne({ where: { name: "Amelia Rodriguez" } });

  if (rep1) {
    await rep1.update({ role: "sales_rep" });
    console.log(`Updated rep1 (${rep1.email}) role to "sales_rep"`);
  }

  if (rep2) {
    await rep2.update({ role: "sales_rep" });
    console.log(`Updated rep2 (${rep2.email}) role to "sales_rep"`);
  }

  // 2. If Amelia exists separately or if leads were assigned to Amelia's old ID, reassign to rep1
  if (rep1 && amelia && amelia.id !== rep1.id) {
    const reassignedCount = await sequelize.models.Lead.update(
      { assignedToId: rep1.id },
      { where: { assignedToId: amelia.id } }
    );
    console.log(`Reassigned ${reassignedCount[0]} leads from Amelia to ${rep1.email}`);
  }

  // Ensure rep1 has assigned leads (assign ~35 leads to rep1 if none)
  const rep1LeadCount = await sequelize.models.Lead.count({ where: { assignedToId: rep1.id } });
  console.log(`rep1 (${rep1.email}) currently has ${rep1LeadCount} assigned leads.`);

  if (rep1LeadCount === 0) {
    const unassignedOrOtherLeads = await sequelize.models.Lead.findAll({ limit: 35 });
    for (const l of unassignedOrOtherLeads as any[]) {
      await l.update({ assignedToId: rep1.id });
    }
    console.log(`Assigned 35 leads to ${rep1.email}`);
  }

  // Check lead count for rep1
  const finalCount = await sequelize.models.Lead.count({ where: { assignedToId: rep1.id } });
  console.log(`Final count for ${rep1.email}: ${finalCount} leads.`);

  process.exit(0);
}

fixSalesRepRoleAndAssignments().catch(err => {
  console.error(err);
  process.exit(1);
});
