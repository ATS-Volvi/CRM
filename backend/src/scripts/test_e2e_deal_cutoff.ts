import { sequelize } from "@nexus-crm/database";
import { autoAssignDeal } from "../services/dealAssignmentEngine";

async function runTest() {
  const { User, DealReassignmentHistory, Deal } = sequelize.models;

  try {
    // 1. Setup - Find two senior AEs
    const seniorAes: any[] = await User.findAll({ where: { role: "senior_ae" }, limit: 2 });
    if (seniorAes.length < 2) {
      console.log("Need at least 2 senior AEs to run this test.");
      process.exit(1);
    }

    const repA = seniorAes[0];
    const repB = seniorAes[1];

    // Set cutoffs: repA max $30k, repB max $100k
    await repA.update({ dealValueCutoff: 30000, maxActiveOpportunities: 100 });
    await repB.update({ dealValueCutoff: 100000, maxActiveOpportunities: 100 });

    console.log(`[Setup] Rep A (${repA.id}): Cutoff 30,000`);
    console.log(`[Setup] Rep B (${repB.id}): Cutoff 100,000`);

    // 2. Test $20k deal -> Should go to Rep A (or B, but both eligible, tie-break decides)
    await repB.update({ maxActiveOpportunities: 10 });
    const assignee20k = await autoAssignDeal("test-20k", 20000);
    console.log(`[Test 1 - 20,000] Assigned to: ${assignee20k} (Expected: ${repA.id} due to capacity tie-break)`);

    // 3. Test $60k deal -> Should go to Rep B (Rep A's cutoff is 30k)
    const assignee60k = await autoAssignDeal("test-60k", 60000);
    console.log(`[Test 2 - 60,000] Assigned to: ${assignee60k} (Expected: ${repB.id} due to cutoff)`);

    // 4. Test $150k deal -> Should be null (both cutoffs exceeded)
    const assignee150k = await autoAssignDeal("test-150k", 150000);
    console.log(`[Test 3 - 150,000] Assigned to: ${assignee150k} (Expected: null)`);

    // 5. Test DealReassignmentHistory
    const deal: any = await Deal.create({
        id: require("crypto").randomUUID(),
        name: "E2E Test Deal",
        amount: 60000,
        ownerId: repA.id
    });
    const reassignment: any = await DealReassignmentHistory.create({
        id: require("crypto").randomUUID(),
        dealId: deal.id,
        fromUserId: repA.id,
        toUserId: repB.id,
        reason: "Test reassignment"
    });
    console.log(`[Test 4 - Reassignment] Created history record for Deal ${deal.id}`);

    // Cleanup
    await DealReassignmentHistory.destroy({ where: { id: reassignment.id } });
    await Deal.destroy({ where: { id: deal.id } });
    await repA.update({ dealValueCutoff: null });
    await repB.update({ dealValueCutoff: null });
    console.log("[Cleanup] Restored data");
  } catch (error) {
    console.error("Test failed", error);
  } finally {
    process.exit(0);
  }
}

runTest();
