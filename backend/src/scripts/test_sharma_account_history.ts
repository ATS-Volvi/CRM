import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

async function testSharmaAccountHistory() {
  console.log("=================================================");
  console.log("TEST: SHARMA GLOBAL ACCOUNT 360 & HISTORY");
  console.log("=================================================\n");

  const currentLead: any = await sequelize.models.Lead.findOne({
    where: { email: "rahul.sharma@sharmaglobal.com" }
  });

  if (!currentLead) {
    throw new Error("Rahul Sharma lead not found in database.");
  }

  console.log(`Current Lead: ID=${currentLead.id}, Name=${currentLead.firstName} ${currentLead.lastName}, Company=${currentLead.company}`);

  // Fetch related leads
  const orConditions: any[] = [];
  if (currentLead.accountId) orConditions.push({ accountId: currentLead.accountId });
  if (currentLead.customerId) orConditions.push({ customerId: currentLead.customerId });
  if (currentLead.company) orConditions.push({ company: currentLead.company });
  if (currentLead.email) orConditions.push({ email: currentLead.email });
  if (currentLead.phone) orConditions.push({ phone: currentLead.phone });

  const relatedLeads = await sequelize.models.Lead.findAll({
    where: {
      [Op.or]: orConditions,
      id: { [Op.ne]: currentLead.id }
    },
    order: [["createdAt", "DESC"]]
  });

  console.log(`Found ${relatedLeads.length} historical leads from the same account:`);
  for (const rl of relatedLeads as any[]) {
    console.log(`  - ${rl.leadNumber} (${rl.source}): "${rl.message || rl.notes}" [Status: ${rl.status}]`);
  }

  const allLeadIds = [currentLead.id, ...relatedLeads.map((l: any) => l.id)];
  const deals = await sequelize.models.Deal.findAll({
    where: {
      [Op.or]: [
        { leadId: { [Op.in]: allLeadIds } },
        ...(currentLead.accountId ? [{ accountId: currentLead.accountId }] : [])
      ]
    }
  });

  console.log(`\nFound ${deals.length} deals for this account:`);
  for (const d of deals as any[]) {
    console.log(`  - ${d.name}: SAR ${d.amount} [Status: ${d.status}]`);
  }

  const dealIds = deals.map((d: any) => d.id);
  const quotes = dealIds.length > 0 ? await sequelize.models.Quote.findAll({
    where: { dealId: { [Op.in]: dealIds } }
  }) : [];

  console.log(`\nFound ${quotes.length} quotes for this account:`);
  for (const q of quotes as any[]) {
    console.log(`  - Quote #${q.quoteNumber}: SAR ${q.totalAmount} sent via ${q.sentVia || 'EMAIL'} [Status: ${q.status}]`);
  }

  if (relatedLeads.length === 0 || quotes.length === 0) {
    throw new Error("Failed to link historical leads or quotes to Sharma Global Enterprises.");
  }

  console.log("\n=================================================");
  console.log("🎉 ALL TESTS PASSED: Account 360 history linked!");
  console.log("=================================================");
  process.exit(0);
}

testSharmaAccountHistory().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
