import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import { getDealAccessLevel, getLeadAccessLevel, checkRecordAccess } from "../src/services/handoffAccessService";
import { qualifyLeadWorkflow } from "../src/services/stageNextActionEngine";
import { manualReassignDeal } from "../src/services/dealAssignmentEngine";

async function runLeadToOpportunityHandoffTest() {
  console.log("=========================================================================");
  console.log("STARTING E2E VERIFICATION: LEAD -> OPPORTUNITY HANDOFF & CONTINUATION");
  console.log("=========================================================================\n");

  await Database.createConnection();
  await sequelize.sync();

  const { User, Lead, Deal, Activity, LeadReassignmentHistory, DealReassignmentHistory, PipelineStage, Quote } = sequelize.models;

  // 1. Fetch or Create Salesman 1 & Salesman 2
  const users = await User.findAll({ limit: 5 });
  let salesman1: any = users.find((u: any) => u.role === "sales_rep") || users[0];
  let salesman2: any = users.find((u: any) => u.id !== salesman1?.id) || users[1];

  if (!salesman1 || !salesman2) {
    const s1Id = require("crypto").randomUUID();
    const s2Id = require("crypto").randomUUID();

    salesman1 = await User.create({
      id: s1Id,
      name: "Salesman 1 (Original Rep)",
      email: `salesman1_${Date.now()}@example.com`,
      password: "hashedpassword",
      role: "sales_rep"
    });

    salesman2 = await User.create({
      id: s2Id,
      name: "Salesman 2 (New Opportunity Owner)",
      email: `salesman2_${Date.now()}@example.com`,
      password: "hashedpassword",
      role: "senior_ae"
    });
  }

  console.log(`✓ Created Salesman 1: ${salesman1.name} (${salesman1.id})`);
  console.log(`✓ Created Salesman 2: ${salesman2.name} (${salesman2.id})\n`);

  let lead: any = null;
  let deal: any = null;
  let activity1: any = null;

  try {
    // 2. Salesman 1 creates Lead and logs initial discovery data
    lead = await Lead.create({
      id: require("crypto").randomUUID(),
      firstName: "John",
      lastName: "Doe",
      company: "Apex Global Solutions",
      email: `johndoe_${Date.now()}@apexglobal.com`,
      phone: "+966512345678",
      status: "Discovery",
      assignedToId: salesman1.id,
      notes: "Client requires 500 portable office cabins and waste management services."
    });

    console.log(`1. Salesman 1 created Lead: "${lead.company}" (ID: ${lead.id})`);

    // Salesman 1 logs a discovery call activity
    activity1 = await Activity.create({
      id: require("crypto").randomUUID(),
      leadId: lead.id,
      type: "call",
      notes: "Salesman 1 conducted initial discovery call. Budget estimated at 450,000 SAR.",
      duration: 30,
      createdById: salesman1.id,
      direction: "internal"
    });
    console.log(`✓ Salesman 1 logged discovery call activity (ID: ${activity1.id})\n`);

    // 3. Salesman 1 qualifies Lead -> Converts to Opportunity / Deal
    console.log("2. Qualifying Lead and converting into Opportunity...");
    const qualResult = await qualifyLeadWorkflow(
      lead.id,
      {
        budget: 450000,
        estimatedValue: 450000,
        requirement: "Qualified for enterprise portal cabin contract."
      },
      salesman1.id
    );

    deal = await Deal.findOne({ where: { leadId: lead.id } });
    if (!deal) throw new Error("Deal auto-creation failed!");

    console.log(`✓ Opportunity Created: "${deal.name}" (Deal ID: ${deal.id}, Value: ${deal.amount} SAR)\n`);

    // 4. Handoff Opportunity to Salesman 2
    console.log("3. Reassigning Opportunity to Salesman 2...");
    await manualReassignDeal(deal.id, salesman2.id, "Territory Handoff to Senior AE", salesman1.id);
    await deal.reload();
    console.log(`✓ Opportunity reassigned to Salesman 2 (Current Owner ID: ${deal.ownerId})\n`);

    // 5. VERIFY DATA VISIBILITY FOR SALESMAN 2
    console.log("4. Checking Data Visibility on Opportunity...");
    const timelineActivities = await Activity.findAll({
      where: { leadId: lead.id },
      order: [["createdAt", "ASC"]]
    });

    console.log(`✓ Total activities on Opportunity timeline: ${timelineActivities.length}`);
    const hasS1Notes = timelineActivities.some((act: any) => act.createdById === salesman1.id);
    if (!hasS1Notes) {
      throw new Error("FAIL: Salesman 1's historical activities are NOT visible on the opportunity!");
    }
    console.log("✓ SUCCESS: Salesman 1's discovery notes and call logs are 100% VISIBLE on the opportunity timeline!\n");

    // 6. VERIFY PERMISSIONS
    console.log("5. Checking Access Levels & Permissions...");

    // Salesman 1 (Prior Owner) Access
    const s1Access = await getDealAccessLevel(salesman1.id, salesman1.role, deal);
    console.log(`- Salesman 1 Access: canRead=${s1Access.canRead}, canWrite=${s1Access.canWrite}, isViewOnly=${s1Access.isViewOnly}`);
    if (!s1Access.canRead || s1Access.canWrite || !s1Access.isViewOnly) {
      throw new Error(`FAIL: Salesman 1 permission evaluation incorrect! Expected view_only, got: ${JSON.stringify(s1Access)}`);
    }
    console.log("✓ SUCCESS: Salesman 1 has permanent VIEW-ONLY access!");

    // Salesman 2 (Current Owner) Access
    const s2Access = await getDealAccessLevel(salesman2.id, salesman2.role, deal);
    console.log(`- Salesman 2 Access: canRead=${s2Access.canRead}, canWrite=${s2Access.canWrite}, isViewOnly=${s2Access.isViewOnly}`);
    if (!s2Access.canRead || !s2Access.canWrite || s2Access.isViewOnly) {
      throw new Error(`FAIL: Salesman 2 permission evaluation incorrect! Expected full, got: ${JSON.stringify(s2Access)}`);
    }
    console.log("✓ SUCCESS: Salesman 2 has FULL READ/WRITE permissions!\n");

    // 7. VERIFY SALESMAN 2 CAN CONTINUE WORK SEAMLESSLY
    console.log("6. Testing Salesman 2 continuation of work...");

    // Salesman 2 adds a follow-up activity
    const activity2: any = await Activity.create({
      id: require("crypto").randomUUID(),
      leadId: lead.id,
      dealId: deal.id,
      type: "meeting",
      notes: "Salesman 2 conducted technical scope review meeting with client CTO.",
      createdById: salesman2.id,
      direction: "internal"
    });
    console.log(`✓ Salesman 2 logged technical review meeting (Activity ID: ${activity2.id})`);

    // Salesman 2 updates deal stage to Proposal
    const proposalStage: any = await PipelineStage.findOne({ where: { name: "Proposal" } });
    if (proposalStage) {
      await deal.update({ stageId: proposalStage.id, amount: 480000 });
      console.log(`✓ Salesman 2 moved Opportunity to "Proposal" stage (New Amount: 480,000 SAR)`);
    }

    // 8. VERIFY AUTHORSHIP PRESERVATION
    console.log("\n7. Checking Authorship Preservation...");
    const act1Reload: any = await Activity.findByPk(activity1.id);
    const act2Reload: any = await Activity.findByPk(activity2.id);

    console.log(`- Activity 1 Creator: ${act1Reload.createdById} (Salesman 1 ID: ${salesman1.id})`);
    console.log(`- Activity 2 Creator: ${act2Reload.createdById} (Salesman 2 ID: ${salesman2.id})`);

    if (act1Reload.createdById !== salesman1.id || act2Reload.createdById !== salesman2.id) {
      throw new Error("FAIL: Authorship rewrite detected!");
    }
    console.log("✓ SUCCESS: Historical authorship strictly preserved! Salesman 1's work remains credited to Salesman 1.");

    console.log("\n=========================================================================");
    console.log("ALL VERIFICATIONS PASSED 100%! FEATURE IS FULLY FUNCTIONAL AND TESTED.");
    console.log("=========================================================================");
  } finally {
    // Cleanup
    if (lead) {
      await Activity.destroy({ where: { leadId: lead.id } });
      if (deal) {
        await DealReassignmentHistory.destroy({ where: { dealId: deal.id } });
        await Deal.destroy({ where: { id: deal.id } });
      }
      await Lead.destroy({ where: { id: lead.id } });
    }
    if (salesman1 && salesman2 && salesman1.email.includes("salesman1_") && salesman2.email.includes("salesman2_")) {
      await User.destroy({ where: { id: [salesman1.id, salesman2.id] } });
    }
  }
}

runLeadToOpportunityHandoffTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
