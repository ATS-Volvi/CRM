import { Database, sequelize } from "@nexus-crm/database";
import { convertLeadToOpportunity } from "../../src/services/leadJourneyWorkflowEngine";
import crypto from "crypto";

async function runUnitTests() {
  await Database.createConnection();
  await sequelize.query("ALTER TABLE Deals ADD COLUMN originalOwnerId TEXT;").catch(() => {});

  const { User, Lead, Deal } = sequelize.models;

  let rep: any = await User.findOne({ where: { role: "salesperson" } });
  if (!rep) {
    rep = await User.create({
      id: crypto.randomUUID(),
      name: "Test Sales Rep",
      email: `test_rep_${Date.now()}@nexus.com`,
      role: "salesperson",
      password: "hash"
    });
  }

  const lead: any = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "OwnerInheritance",
    lastName: "TestLead",
    email: `owner_test_${Date.now()}@testdomain.com`,
    company: "Inheritance Test Corp",
    status: "New",
    assignedToId: rep.id
  });

  const result = await convertLeadToOpportunity(lead.id, {
    requirement: "Cloud Infrastructure Setup",
    estimatedValue: 250000
  }, rep.id);

  const dealId = result.deal?.id;
  const fetchedDeal: any = await Deal.findByPk(dealId);

  console.log(`[TEST 1] Lead AssignedToId: ${rep.id}`);
  console.log(`[TEST 1] Fetched Deal OwnerId: ${fetchedDeal?.ownerId}`);
  console.log(`[TEST 1] Fetched Deal OriginalOwnerId: ${fetchedDeal?.originalOwnerId}`);

  if (fetchedDeal?.ownerId !== rep.id) {
    throw new Error(`FAIL: Expected Deal.ownerId to equal Lead.assignedToId (${rep.id}), but got ${fetchedDeal?.ownerId}`);
  }
  if (fetchedDeal?.originalOwnerId !== rep.id) {
    throw new Error(`FAIL: Expected Deal.originalOwnerId to equal ${rep.id}, but got ${fetchedDeal?.originalOwnerId}`);
  }

  console.log("✅ TEST 1 PASSED: Lead conversion owner inheritance verified!\n");
  process.exit(0);
}

runUnitTests().catch(err => {
  console.error("Test 1 Failed:", err);
  process.exit(1);
});
