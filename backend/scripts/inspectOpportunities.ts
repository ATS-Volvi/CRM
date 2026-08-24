import "dotenv/config";
import { Database, sequelize, Deal, Account, User, Quote, PipelineStage } from "@nexus-crm/database";
import { getDeals, getOpportunityById, getPipeline, getPipelineStages } from "../src/controllers/pipelineController";

async function main() {
  await Database.createConnection();
  console.log("Database connected");

  // 1. getDeals (OPEN)
  let status1 = 200, body1: any = null;
  const res1: any = {
    status: (code: number) => { status1 = code; return res1; },
    json: (data: any) => { body1 = data; }
  };
  await getDeals({ query: { status: "OPEN" }, user: { id: "test" } } as any, res1);
  console.log("1. getDeals(OPEN) status:", status1, "count:", Array.isArray(body1) ? body1.length : body1);

  // 2. getDeals (ALL)
  let status2 = 200, body2: any = null;
  const res2: any = {
    status: (code: number) => { status2 = code; return res2; },
    json: (data: any) => { body2 = data; }
  };
  await getDeals({ query: {}, user: { id: "test" } } as any, res2);
  console.log("2. getDeals(ALL) status:", status2, "count:", Array.isArray(body2) ? body2.length : body2);

  // 3. getPipelineStages
  let status3 = 200, body3: any = null;
  const res3: any = {
    status: (code: number) => { status3 = code; return res3; },
    json: (data: any) => { body3 = data; }
  };
  await getPipelineStages({ query: {}, user: { id: "test" } } as any, res3);
  console.log("3. getPipelineStages status:", status3, "count:", Array.isArray(body3) ? body3.length : body3);

  // 4. getOpportunityById
  const deal: any = await Deal.findOne();
  if (deal) {
    let status4 = 200, body4: any = null;
    const res4: any = {
      status: (code: number) => { status4 = code; return res4; },
      json: (data: any) => { body4 = data; }
    };
    await getOpportunityById({ params: { id: deal.id }, user: { id: "test" } } as any, res4);
    console.log("4. getOpportunityById status:", status4, "error:", status4 !== 200 ? body4 : "none");
  }

  process.exit(0);
}

main().catch(console.error);
