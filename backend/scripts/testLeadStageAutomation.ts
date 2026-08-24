import "dotenv/config";
import { Database, sequelize, Lead, Activity, LeadStageHistory, User } from "@nexus-crm/database";
import { checkAndAutoAdvanceLead } from "../src/services/leadStageAutomationService";
import { createActivity } from "../src/controllers/activityController";
import { updateLead } from "../src/controllers/leadController";

async function runTests() {
  console.log("============================================================");
  console.log("🧪 RUNNING LEAD STAGE AUTOMATION TEST SUITE");
  console.log("============================================================");

  await Database.createConnection();

  // Find or create a test user
  let user: any = await User.findOne();
  if (!user) {
    user = await User.create({
      name: "Automation Test User",
      email: `test_user_${Date.now()}@nexuscrm.com`,
      role: "sales_rep"
    });
  }

  // =========================================================================
  // TEST 1: Auto-trigger NEW -> CONTACTED
  // =========================================================================
  console.log("\n▶ TEST 1: Auto-trigger NEW -> CONTACTED on outbound activity...");

  const testLead1: any = await Lead.create({
    firstName: "Sarah",
    lastName: "Connor",
    company: "Cyberdyne Systems",
    email: `sarah.connor.${Date.now()}@cyberdyne.com`,
    phone: "+15551234567",
    status: "NEW",
    source: "website",
    assignedToId: user.id
  });

  console.log(`✓ Created test lead ${testLead1.id} with status: ${testLead1.status}`);
  if (testLead1.status !== "NEW") {
    throw new Error(`Expected initial status to be NEW, got ${testLead1.status}`);
  }

  // Simulate logging an outbound activity via activityController
  let activityResStatus = 200;
  let activityResBody: any = null;
  const mockActivityRes: any = {
    status: (code: number) => { activityResStatus = code; return mockActivityRes; },
    json: (body: any) => { activityResBody = body; return mockActivityRes; }
  };

  await createActivity({
    params: { leadId: testLead1.id },
    body: {
      leadId: testLead1.id,
      type: "call",
      outcome: "Connected - discussed enterprise software requirements",
      direction: "outbound",
      duration: 180,
      notes: "Customer confirmed interest in migrating core systems."
    },
    user: { id: user.id, role: "sales_rep" }
  } as any, mockActivityRes);

  console.log(`✓ Logged outbound call activity (HTTP status: ${activityResStatus})`);

  // Reload lead and verify status auto-advanced to CONTACTED
  await testLead1.reload();
  console.log(`✓ Lead status after outbound activity: ${testLead1.status}`);
  if (testLead1.status !== "CONTACTED") {
    throw new Error(`Expected lead status to auto-advance to CONTACTED, got ${testLead1.status}`);
  }

  // Verify LeadStageHistory audit record
  const stageHistories1 = await LeadStageHistory.findAll({
    where: { leadId: testLead1.id, toStage: "Contacted" }
  });
  console.log(`✓ LeadStageHistory records for New->Contacted: ${stageHistories1.length}`);
  if (stageHistories1.length === 0) {
    throw new Error("Missing LeadStageHistory audit record for New->Contacted transition!");
  }
  const history1: any = stageHistories1[0];
  console.log(`  - fromStage: ${history1.fromStage}`);
  console.log(`  - toStage: ${history1.toStage}`);
  console.log(`  - transitionType: ${history1.transitionType}`);
  console.log(`  - isVerified: ${history1.isVerified}`);
  console.log(`  - evidence: ${history1.evidenceData}`);

  // Verify stage_change Activity audit record
  const stageActivities1 = await Activity.findAll({
    where: { leadId: testLead1.id, type: "stage_change" }
  });
  console.log(`✓ stage_change Activity audit records: ${stageActivities1.length}`);
  if (stageActivities1.length === 0) {
    throw new Error("Missing stage_change Activity audit record!");
  }
  console.log(`  - outcome: ${(stageActivities1[0] as any).outcome}`);

  // =========================================================================
  // TEST 2: Auto-trigger CONTACTED -> QUALIFIED
  // =========================================================================
  console.log("\n▶ TEST 2: Auto-trigger CONTACTED -> QUALIFIED on value + requirements...");

  let updateResStatus = 200;
  let updateResBody: any = null;
  const mockUpdateRes: any = {
    status: (code: number) => { updateResStatus = code; return mockUpdateRes; },
    json: (body: any) => { updateResBody = body; return mockUpdateRes; }
  };

  // Update expectedValue and requirements/notes via updateLead
  await updateLead({
    params: { id: testLead1.id },
    body: {
      expectedValue: 125000,
      notes: "Requirements: Complete cloud modernization, 50-user license, 24/7 dedicated support SLA."
    },
    user: { id: user.id, role: "sales_rep" }
  } as any, mockUpdateRes);

  console.log(`✓ Updated lead with expectedValue ($125,000) and requirements notes`);

  // Reload lead and verify status auto-advanced to QUALIFIED
  await testLead1.reload();
  console.log(`✓ Lead status after value + requirements: ${testLead1.status}`);
  if (testLead1.status !== "QUALIFIED") {
    throw new Error(`Expected lead status to auto-advance to QUALIFIED, got ${testLead1.status}`);
  }

  // Verify LeadStageHistory audit record for Contacted -> Qualified
  const stageHistories2 = await LeadStageHistory.findAll({
    where: { leadId: testLead1.id, toStage: "Qualified" }
  });
  console.log(`✓ LeadStageHistory records for Contacted->Qualified: ${stageHistories2.length}`);
  if (stageHistories2.length === 0) {
    throw new Error("Missing LeadStageHistory audit record for Contacted->Qualified transition!");
  }
  const history2: any = stageHistories2[0];
  console.log(`  - fromStage: ${history2.fromStage}`);
  console.log(`  - toStage: ${history2.toStage}`);
  console.log(`  - transitionType: ${history2.transitionType}`);
  console.log(`  - isVerified: ${history2.isVerified}`);
  console.log(`  - evidence: ${history2.evidenceData}`);

  // =========================================================================
  // TEST 3: Prevent Double-Fire & Do Not Regress / Move Backward
  // =========================================================================
  console.log("\n▶ TEST 3: Idempotency & Non-Regression Verification...");

  const totalHistoriesBefore = await LeadStageHistory.count({ where: { leadId: testLead1.id } });

  // Add another outbound activity to an already QUALIFIED lead
  await createActivity({
    params: { leadId: testLead1.id },
    body: {
      leadId: testLead1.id,
      type: "email",
      outcome: "Email sent: Architecture roadmap sent to customer",
      direction: "outbound"
    },
    user: { id: user.id }
  } as any, mockActivityRes);

  await testLead1.reload();
  console.log(`✓ Lead status after subsequent outbound activity: ${testLead1.status}`);
  if (testLead1.status !== "QUALIFIED") {
    throw new Error(`Lead should remain QUALIFIED, but got ${testLead1.status}`);
  }

  const totalHistoriesAfter = await LeadStageHistory.count({ where: { leadId: testLead1.id } });
  console.log(`✓ Audit history count unchanged (Before: ${totalHistoriesBefore}, After: ${totalHistoriesAfter})`);
  if (totalHistoriesAfter !== totalHistoriesBefore) {
    throw new Error("Duplicate stage history created for already qualified lead!");
  }

  // =========================================================================
  // TEST 4: Manual Override Path Still Works Independently
  // =========================================================================
  console.log("\n▶ TEST 4: Manual Override Path Verification...");

  const manualLead: any = await Lead.create({
    firstName: "Manual",
    lastName: "Override",
    company: "Acme Testing",
    status: "NEW",
    assignedToId: user.id
  });

  // Rep forces transition to QUALIFIED directly via manual status update
  await updateLead({
    params: { id: manualLead.id },
    body: { status: "QUALIFIED" },
    user: { id: user.id }
  } as any, mockUpdateRes);

  await manualLead.reload();
  console.log(`✓ Manual override status: ${manualLead.status}`);
  if (manualLead.status !== "QUALIFIED") {
    throw new Error(`Expected manual override to set status to QUALIFIED, got ${manualLead.status}`);
  }

  console.log("\n============================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY (100% VERIFIED)");
  console.log("============================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
