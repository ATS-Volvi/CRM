import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import { getLeads } from "../src/controllers/leadController";

async function main() {
  await Database.createConnection();
  console.log("Calling getLeads with page=1, limit=25...");

  let responseData: any = null;
  let statusCode = 200;

  const mockRes: any = {
    json: (d: any) => { responseData = d; return mockRes; },
    status: (c: number) => { statusCode = c; return mockRes; }
  };

  const adminUser = await sequelize.models.User.findOne({ where: { role: "admin" } });

  const mockReq: any = {
    query: {
      page: "1",
      limit: "25"
    },
    user: adminUser?.get({ plain: true })
  };

  try {
    await getLeads(mockReq, mockRes);
    console.log(`Status Code: ${statusCode}`);
    if (statusCode !== 200) {
      console.error("Error response:", responseData);
    } else {
      console.log(`Success! Total: ${responseData?.total}, Returned count: ${responseData?.data?.length || responseData?.length}`);
    }
  } catch (err) {
    console.error("Unhandled error in getLeads:", err);
  }

  process.exit(0);
}

main().catch(console.error);
