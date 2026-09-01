import { Database, sequelize } from "@nexus-crm/database";
import { getDeals } from "../../src/controllers/pipelineController";
import crypto from "crypto";

async function runUnitTest() {
  await Database.createConnection();
  const { User, Lead, Deal } = sequelize.models;

  let rep: any = await User.findOne({ where: { role: "salesperson" } });
  if (!rep) {
    rep = await User.create({
      id: crypto.randomUUID(),
      name: "Original Rep Test User",
      email: `orig_rep_${Date.now()}@nexus.com`,
      role: "salesperson",
      password: "hash"
    });
  }

  const deal: any = await Deal.create({
    id: crypto.randomUUID(),
    name: "Original Owner Field Test Deal",
    amount: 100000,
    ownerId: rep.id,
    originalOwnerId: rep.id
  });

  const req: any = { query: {}, user: { id: rep.id, role: "salesperson" } };
  let responseData: any = null;
  const res: any = {
    json: (data: any) => {
      responseData = data;
    }
  };

  await getDeals(req, res);

  const found = (responseData || []).find((d: any) => d.id === deal.id);
  console.log(`[TEST 3] Found Deal originalOwnerId in GET /opportunities payload: ${found?.originalOwnerId}`);

  if (!found || found.originalOwnerId !== rep.id) {
    throw new Error(`FAIL: Expected originalOwnerId to be ${rep.id}, but got ${found?.originalOwnerId}`);
  }

  console.log("✅ TEST 3 PASSED: originalOwnerId in GET /opportunities response verified!\n");
  process.exit(0);
}

runUnitTest().catch(err => {
  console.error("Test 3 Failed:", err);
  process.exit(1);
});
