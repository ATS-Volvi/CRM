import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import { getAccounts } from "../src/controllers/accountController";

async function main() {
  await Database.createConnection();
  console.log("Calling getAccounts handler...");

  let resultData: any = null;
  let statusCode = 200;

  const mockRes: any = {
    json: (d: any) => { resultData = d; return mockRes; },
    status: (c: number) => { statusCode = c; return mockRes; }
  };

  await getAccounts({ query: {} } as any, mockRes);
  console.log(`Status Code: ${statusCode}`);
  console.log(`Accounts returned: ${Array.isArray(resultData) ? resultData.length : "Not an array"}`);
  if (statusCode !== 200) {
    console.error("Result error:", resultData);
    process.exit(1);
  }
  console.log("Sample Account:", resultData[0] ? {
    id: resultData[0].id,
    name: resultData[0].name,
    contactsCount: resultData[0].contacts?.length,
    dealsCount: resultData[0].deals?.length
  } : "No accounts yet");

  console.log("✅ getAccounts executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
