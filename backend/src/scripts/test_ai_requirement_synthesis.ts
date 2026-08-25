import { Database, sequelize } from "@nexus-crm/database";
import { synthesizeLeadRequirements, synthesizeOpportunityRequirements } from "../services/aiRequirementSynthesis";

async function runTest() {
  console.log("=================================================");
  console.log("TEST: AI REQUIREMENT SYNTHESIS (LEADS & OPPORTUNITIES)");
  console.log("=================================================\n");

  await Database.createConnection();

  // 1. Create a lead with realistic unstructured conversation + requirement
  const leadId = require("crypto").randomUUID();
  const testLead = await sequelize.models.Lead.create({
    id: leadId,
    leadNumber: `LD-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: "Hassan",
    lastName: "Al-Mansour",
    email: `hassan.${Date.now()}@redseaindustries.sa`,
    phone: "+966551982736",
    company: "Red Sea Industries",
    industry: "Manufacturing",
    budgetRange: "SAR 150,000 - 250,000",
    message: "Good morning! Can you help me? We need 40 units of 400V IP65 distribution panels and 60 units of SCADA automated valves for our warehouse expansion in Jubail. Please send quote ASAP.",
    status: "QUALIFIED",
    extractedRequirement: {
      item: "400V IP65 distribution panels",
      quantity: 40,
      context: "Warehouse expansion in Jubail Industrial City"
    }
  });

  console.log(`[Step 1] Synthesizing requirements for Lead #${leadId}...`);
  const leadSummary = await synthesizeLeadRequirements(leadId);
  console.log("Lead Core Request:", leadSummary.coreRequest);
  console.log("Deliverables:", leadSummary.primaryDeliverables);
  console.log("Technical Specs:", leadSummary.technicalSpecs);
  console.log("Project Context:", leadSummary.projectContext);
  console.log("Recommended Action:", leadSummary.recommendedAction);
  console.log("Key Tags:", leadSummary.keyTags);
  console.log("Intent Score:", leadSummary.intentScore);

  if (!leadSummary.primaryDeliverables.length || !leadSummary.coreRequest) {
    throw new Error("Lead requirement synthesis failed to extract core deliverables.");
  }
  console.log("✅ Step 1 Passed: Lead requirement synthesis verified.\n");

  // 2. Create an Opportunity with Quotes
  const oppId = require("crypto").randomUUID();
  const testOpp = await sequelize.models.Deal.create({
    id: oppId,
    name: "Jubail Plant Phase 2 Expansion",
    amount: 185000,
    leadId: leadId,
    status: "OPEN"
  });

  const quoteId = require("crypto").randomUUID();
  const testQuote = await sequelize.models.Quote.create({
    id: quoteId,
    quoteNumber: `QT-${Date.now().toString().slice(-5)}`,
    dealId: oppId,
    version: 1,
    totalAmount: 185000,
    status: "Sent"
  });

  console.log(`[Step 2] Synthesizing requirements for Opportunity #${oppId}...`);
  const oppSummary = await synthesizeOpportunityRequirements(oppId);
  console.log("Opportunity Core Request:", oppSummary.coreRequest);
  console.log("Deliverables:", oppSummary.primaryDeliverables);
  console.log("Technical Specs:", oppSummary.technicalSpecs);
  console.log("Project Scope:", oppSummary.projectContext);
  console.log("Commercial Target:", oppSummary.budgetAndCommercials);
  console.log("Recommended Next Step:", oppSummary.recommendedAction);

  if (!oppSummary.primaryDeliverables.length || !oppSummary.coreRequest) {
    throw new Error("Opportunity requirement synthesis failed.");
  }
  console.log("✅ Step 2 Passed: Opportunity requirement synthesis verified.\n");

  console.log("=================================================");
  console.log("🎉 ALL AI REQUIREMENT SYNTHESIS TESTS PASSED!");
  console.log("=================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
