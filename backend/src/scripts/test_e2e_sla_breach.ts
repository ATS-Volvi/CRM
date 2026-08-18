import { enforceSLAs } from "../services/slaEnforcementJob";
import { convertLeadToOpportunity } from "../services/leadJourneyWorkflowEngine";
import { sequelize } from "@nexus-crm/database";

async function runTest() {
  const { Lead, User, DealOwner } = sequelize.models;
  
  // Find a sales_rep
  const rep: any = await User.findOne({ where: { role: "sales_rep" } });
  if (!rep) {
    console.log("No sales_rep found.");
    return;
  }

  // Create a dummy lead that breached SLA
  const testLead: any = await Lead.create({
    id: require("crypto").randomUUID(),
    firstName: "SLA",
    lastName: "Breacher",
    email: "sla-breach-test@example.com",
    status: "New",
    assignedToId: rep.id
  });

  // Backdate updatedAt by 4 hours (SLA for New is 2 hours)
  await sequelize.query(
    `UPDATE public."Leads" SET "updatedAt" = NOW() - INTERVAL '4 hours' WHERE id = '${testLead.id}'`
  );

  console.log(`[Before Job] Lead ${testLead.id} assigned to ${rep.id} (sales_rep)`);

  const escalatedCount = await enforceSLAs();
  
  console.log(`Job escalated ${escalatedCount} leads.`);

  const updatedLead: any = await Lead.findByPk(testLead.id, { include: [{ model: User, as: "assignedTo" }] });
  console.log(`[After Job] Lead ${testLead.id} assigned to ${updatedLead.assignedToId} (Role: ${updatedLead.assignedTo.role})`);

  // Now convert it to an opportunity to test DealOwner splits
  console.log(`[Conversion] Converting to Deal...`);
  const qualData = { requirement: "Enterprise deployment", estimatedValue: 50000, expectedCloseDate: new Date(Date.now() + 86400000) };
  const conversion = await convertLeadToOpportunity(testLead.id, qualData, updatedLead.assignedToId);
  const dealId = conversion.deal.id;
  
  // Verify Deal Owners
  const owners: any[] = await DealOwner.findAll({ where: { dealId: dealId } });
  for (const owner of owners) {
    console.log(`[DealOwner] User: ${owner.userId}, Role: ${owner.role}, Split: ${owner.splitPct}%`);
  }

  // Cleanup
  await DealOwner.destroy({ where: { dealId: dealId } });
  await sequelize.query(`DELETE FROM public."Deals" WHERE id = '${dealId}'`);
  await sequelize.query(`DELETE FROM public."LeadReassignmentHistory" WHERE "leadId" = '${testLead.id}'`);
  await testLead.destroy();
  process.exit(0);
}

runTest().catch(console.error);
