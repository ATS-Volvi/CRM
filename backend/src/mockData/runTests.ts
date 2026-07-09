import { sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { calculateUserKpis, calculateTeamKpis } from "../services/kpiService";
import { getPriceWinRateSuggestion } from "../services/pricingEngine";
import { suggestBundleOrItems } from "../services/recommendationEngine";

async function runAllTests() {
  console.log("=========================================");
  console.log("STARTING DEV A CRM UNIT & INTEGRATION TESTS");
  console.log("=========================================");
  
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`[PASS] - ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] - ${message}`);
      failed++;
    }
  };

  try {
    // Test 1: Assignment Engine Fallback
    const fallbackId = await assignLead({
      firstName: "Test",
      lastName: "Lead",
      email: "test@example.com",
      source: "Unknown"
    });
    assert(fallbackId !== undefined, "Assignment Engine returns a routed admin fallback user");

    // Test 2: KPI Calculators
    const teamKpis = await calculateTeamKpis();
    assert(teamKpis !== null && typeof teamKpis.totalPipelineValue === "number", "calculateTeamKpis aggregates active deals value");

    // Test 3: Win Rate Analyzer
    const dummyId = require('crypto').randomUUID();
    const pricingRec = await getPriceWinRateSuggestion(dummyId);
    assert(pricingRec !== null && typeof pricingRec.suggestedPrice === "number", "getPriceWinRateSuggestion returns a pricing recommendation");

    // Test 4: Smart Product Recommendations
    const recItems = await suggestBundleOrItems(dummyId);
    assert(recItems !== null && Array.isArray(recItems), "suggestBundleOrItems returns recommendations array");

    console.log("=========================================");
    console.log(`TEST RUN COMPLETE. Passed: ${passed}, Failed: ${failed}`);
    console.log("=========================================");
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution aborted due to unhandled exception:", err);
    process.exit(1);
  }
}

// Connect and run
sequelize.authenticate().then(() => runAllTests());
