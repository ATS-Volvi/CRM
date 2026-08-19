import { sequelize } from "@nexus-crm/database";
import { autoAssignDeal } from "../services/dealAssignmentEngine";
import * as crypto from "crypto";

async function runTest() {
  const { User, Deal, Notification, PipelineStage } = sequelize.models;

  try {
    // 1. Setup - Create 2 brand new dummy senior AEs to guarantee a controlled environment
    const testRepA: any = await User.create({
      id: crypto.randomUUID(),
      name: "Test Rep A",
      email: `testrepa-${Date.now()}@nexus.com`,
      password: "password123",
      role: "senior_ae",
      isAvailable: true,
      dealValueCutoff: 100000,
      maxActiveOpportunities: 100
    });

    const testRepB: any = await User.create({
      id: crypto.randomUUID(),
      name: "Test Rep B",
      email: `testrepb-${Date.now()}@nexus.com`,
      password: "password123",
      role: "senior_ae",
      isAvailable: true,
      dealValueCutoff: 100000,
      maxActiveOpportunities: 100
    });

    // Save old cutoffs of REAL reps and drop their cutoffs to 0 so they are ineligible
    const allSeniorAes: any[] = await User.findAll({ where: { role: "senior_ae" } });
    const originalCutoffs = new Map<string, any>();
    for (const rep of allSeniorAes) {
      if (rep.id !== testRepA.id && rep.id !== testRepB.id) {
        originalCutoffs.set(rep.id, rep.dealValueCutoff);
        await rep.update({ dealValueCutoff: 10 });
      }
    }

    console.log(`[Setup] Created Test Rep A (${testRepA.id}) and Test Rep B (${testRepB.id})`);

    // Assign 2 active deals to Rep A, 5 to Rep B
    const discoveryStage: any = await PipelineStage.findOne({ where: { name: "Discovery" } });

    const dummyDeals = [];
    for (let i = 0; i < 2; i++) {
      dummyDeals.push(await Deal.create({ id: crypto.randomUUID(), name: `Rep A Deal ${i}`, amount: 10, ownerId: testRepA.id, stageId: discoveryStage.id }));
    }
    for (let i = 0; i < 5; i++) {
      dummyDeals.push(await Deal.create({ id: crypto.randomUUID(), name: `Rep B Deal ${i}`, amount: 10, ownerId: testRepB.id, stageId: discoveryStage.id }));
    }
    console.log(`[Setup] Gave Rep A 2 active deals, Rep B 5 active deals`);

    // 2. Test 20k deal -> Should go to Rep A (least loaded)
    const assignee20k = await autoAssignDeal("test-20k", 20000);
    console.log(`[Test 1 - 20,000] Assigned to: ${assignee20k} (Expected: ${testRepA.id} since Rep A has 2 deals vs Rep B's 5 deals)`);

    // 3. Test cutoff - drop Rep A's cutoff to 30k
    await testRepA.update({ dealValueCutoff: 30000 });
    const assignee60k = await autoAssignDeal("test-60k", 60000);
    console.log(`[Test 2 - 60,000] Assigned to: ${assignee60k} (Expected: ${testRepB.id} because Rep A's cutoff is now 30k)`);

    // 4. Test notification fallback - 150k deal (both are capped at 30k/100k)
    const assignee150k = await autoAssignDeal("test-150k", 150000);
    console.log(`[Test 3 - 150,000] Assigned to: ${assignee150k} (Expected: null)`);

    // Verify Notification
    const notifs: any[] = await Notification.findAll({
      where: {
        type: "HIGH_VALUE_LEAD",
        entityId: "test-150k"
      }
    });
    console.log(`[Test 3 - Notification] Found ${notifs.length} HIGH_VALUE_LEAD notifications (Should match number of managers)`);

    // Cleanup
    await Notification.destroy({ where: { entityId: "test-150k" } });
    for (const d of dummyDeals) await d.destroy();
    for (const rep of allSeniorAes) {
      if (rep.id !== testRepA.id && rep.id !== testRepB.id) {
        await rep.update({ dealValueCutoff: originalCutoffs.get(rep.id) });
      }
    }
    await User.destroy({ where: { id: [testRepA.id, testRepB.id] } });
    console.log("[Cleanup] Restored data and destroyed dummy reps");
  } catch (error) {
    console.error("Test failed", error);
  } finally {
    process.exit(0);
  }
}

runTest();
