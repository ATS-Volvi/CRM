import { sequelize } from "@nexus-crm/database";
import { processGmailConnector, processMetaConnector, processLinkedInConnector } from "../src/services/leadIngestion";

async function testParallelConnectors() {
  console.log("Testing 3 concurrent connectors in parallel...");
  const results = await Promise.allSettled([
    processGmailConnector(),
    processMetaConnector(),
    processLinkedInConnector()
  ]);

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    console.log(`Connector ${i} result:`, res.status, res.status === "fulfilled" ? (res as any).value : (res as any).reason);
  }

  const allPassed = results.every(r => r.status === "fulfilled");
  console.log("Parallel Ingestion Test:", allPassed ? "ALL PASSED" : "FAILED");
  process.exit(allPassed ? 0 : 1);
}

testParallelConnectors();
