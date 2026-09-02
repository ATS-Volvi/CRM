import { Database, sequelize } from "@nexus-crm/database";

async function repairConvertedDealsAndLeads() {
  console.log("=================================================");
  console.log("   REPAIRING CONVERTED DEALS & LEADS DATA       ");
  console.log("=================================================\n");

  await Database.createConnection();
  const { Deal, Lead, User } = sequelize.models;

  // 1. Repair Deals with NaN or invalid amounts
  const deals: any[] = await Deal.findAll();
  let repairedDealsCount = 0;

  for (const deal of deals) {
    const rawVal = deal.amount;
    if (rawVal === null || rawVal === undefined || isNaN(Number(rawVal)) || Number(rawVal) <= 0) {
      // Find associated lead to attempt parsing value
      const associatedLead: any = deal.leadId ? await Lead.findByPk(deal.leadId) : null;
      let newAmount = 100000; // default fallback

      if (associatedLead) {
        const strVal = String(associatedLead.expectedValue || associatedLead.budgetRange || "").replace(/[^0-9.-]/g, " ").trim();
        const nums = strVal.split(/\s+/).map(Number).filter(n => !isNaN(n));
        if (nums.length > 0) {
          newAmount = nums.length === 1 ? nums[0] : Math.round((nums[0] + nums[1]) / 2);
        }
      }

      await deal.update({ amount: newAmount });
      console.log(`[REPAIRED DEAL] ID: ${deal.id}, Name: '${deal.name}' -> Amount set to: ${newAmount}`);
      repairedDealsCount++;
    }
  }

  // 2. Repair Leads missing assignedToId or with unmapped User relation
  const leads: any[] = await Lead.findAll({
    include: [{ model: User, as: "assignedTo" }]
  });
  let repairedLeadsCount = 0;

  for (const lead of leads) {
    if (!lead.assignedToId || !lead.assignedTo) {
      // Assign to default available sales rep or admin
      const fallbackRep: any = await User.findOne({ where: { role: "salesperson" } }) || await User.findOne({ where: { role: "admin" } });
      if (fallbackRep) {
        await lead.update({ assignedToId: fallbackRep.id });
        console.log(`[REPAIRED LEAD] ID: ${lead.id}, Company: '${lead.company || lead.firstName}' -> assignedToId set to: ${fallbackRep.name} (${fallbackRep.id})`);
        repairedLeadsCount++;
      }
    }
  }

  console.log("\n=================================================");
  console.log(`REPAIR COMPLETE: Fixed ${repairedDealsCount} Deals and ${repairedLeadsCount} Leads.`);
  console.log("=================================================");
  process.exit(0);
}

repairConvertedDealsAndLeads().catch((err) => {
  console.error("Repair script failed:", err);
  process.exit(1);
});
