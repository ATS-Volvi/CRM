import { Database, sequelize } from "@nexus-crm/database";
import { validateStageTransition } from "../../src/services/stageValidationService";
import crypto from "crypto";

async function runUnitTest() {
  await Database.createConnection();
  const { Lead, Activity } = sequelize.models;

  const lead: any = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Evidence",
    lastName: "TestLead",
    email: `evidence_test_${Date.now()}@testdomain.com`,
    company: "Evidence Corp",
    status: "New"
  });

  // 1. Attempt validation without activities
  const validationBefore = await validateStageTransition(lead.id, "New", "Qualified");
  console.log("[TEST 2] Validation before logging activity:", {
    allowed: validationBefore.allowed,
    missingRequirements: validationBefore.missingRequirements
  });

  if (validationBefore.allowed) {
    throw new Error("FAIL: Expected validationBefore.allowed to be FALSE when zero activities logged.");
  }

  // 2. Log an activity for the lead
  await Activity.create({
    id: crypto.randomUUID(),
    leadId: lead.id,
    type: "CALL",
    subject: "Qualification Call",
    notes: "Customer confirmed budget and project timeline."
  });

  // 3. Attempt validation after logging activity
  const validationAfter = await validateStageTransition(lead.id, "New", "Qualified");
  console.log("[TEST 2] Validation after logging activity:", {
    allowed: validationAfter.allowed,
    missingRequirements: validationAfter.missingRequirements
  });

  if (!validationAfter.allowed) {
    throw new Error(`FAIL: Expected validationAfter.allowed to be TRUE after logging activity. Missing: ${validationAfter.missingRequirements.join(" ")}`);
  }

  console.log("✅ TEST 2 PASSED: Stage evidence enforcement on Lead Qualification verified!\n");
  process.exit(0);
}

runUnitTest().catch(err => {
  console.error("Test 2 Failed:", err);
  process.exit(1);
});
