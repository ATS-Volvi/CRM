import { Database } from "@nexus-crm/database";
import { runEndToEndLeadJourneySim } from "../services/leadJourneyWorkflowEngine";

async function main() {
  console.log("==========================================================================");
  console.log("🚀 END-TO-END 'ONE LEAD' LIFECYCLE WORKFLOW CONTRACT TEST RUNNER");
  console.log("==========================================================================\n");

  try {
    await Database.createConnection();
    console.log("✓ Connected to Database.\n");

    const testEmail = `gulf_corp_${Date.now()}@mfg.com`;
    console.log(`Starting E2E Journey Simulation for prospect: ${testEmail}...\n`);

    const result = await runEndToEndLeadJourneySim(testEmail);

    console.log("--------------------------------------------------------------------------");
    console.log(`RESULT: ${result.success ? "✅ ALL 18 WORKFLOW STEPS PASSED SUCCESSFULLY" : "❌ WORKFLOW FAILED"}`);
    console.log("--------------------------------------------------------------------------\n");

    result.logs.forEach(log => {
      const icon = log.status === "SUCCESS" ? "✓" : "✗";
      console.log(`[Step ${log.stepNumber.toString().padStart(2, '0')}] ${icon} ${log.stepName.padEnd(25)} | ${log.details}`);
    });

    if (result.success) {
      console.log("\n==========================================================================");
      console.log("📊 INHERITED CONTEXT & WORKFLOW ARTIFACTS VERIFIED:");
      console.log(`- Lead ID:    ${result.leadId}`);
      console.log(`- Deal ID:    ${result.dealId}`);
      console.log(`- Quote ID:   ${result.quoteId}`);
      console.log(`- Invoice ID: ${result.invoiceId}`);
      console.log("==========================================================================\n");
    }

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error("Fatal Error running E2E Lead Journey Test:", error);
    process.exit(1);
  }
}

main();
