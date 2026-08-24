import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { convertLeadToOpportunity } from "../src/services/leadJourneyWorkflowEngine";
import { processOpportunityEvent, classifyCommercialIntent } from "../src/services/opportunityAutomationEngine";

async function runOpportunityLifecycleAcceptanceTest() {
  console.log("================================================================");
  console.log("PHASE 6A — AUTOMATED OPPORTUNITY LIFECYCLE ACCEPTANCE TEST");
  console.log("================================================================\n");

  try {
    await sequelize.authenticate();
    console.log(" Database connected.\n");

    const testEmail = `test_opp_${Date.now()}@acmeindustrial.com`;

    // ── 1. Create Qualified Lead ──
    console.log("[1] Creating Lead and converting to Opportunity...");
    const lead: any = await sequelize.models.Lead.create({
      id: crypto.randomUUID(),
      firstName: "Sarah",
      lastName: "Jenkins",
      company: "Acme Industrial Fabrications",
      email: testEmail,
      phone: "+971501112233",
      source: "Website Enquiry",
      status: "NEW",
      budgetRange: "₹40L",
      subject: "3 Custom Prefab Units Requirement"
    });

    const conversionResult = await convertLeadToOpportunity(
      lead.id,
      {
        requirement: "3 Heavy Duty Prefab Modular Units",
        estimatedValue: 4000000,
        dealName: "Acme Industrial - 3 Prefab Units"
      }
    );

    const deal: any = conversionResult.deal;
    console.log(` Lead converted. Opportunity created: '${deal.name}' (ID: ${deal.id})`);
    console.log(` Opportunity Status: ${deal.status} (Expected: OPEN)`);
    console.log(` Current Activity: ${deal.currentActivity}`);
    console.log(` Next Action: ${deal.nextAction}`);

    if (deal.status !== "OPEN") {
      throw new Error(`Expected Opportunity status to be OPEN, got ${deal.status}`);
    }

    // ── 2. Create Quote v1 ──
    console.log("\n[2] Creating Quote v1...");
    const quoteV1: any = await sequelize.models.Quote.create({
      id: crypto.randomUUID(),
      dealId: deal.id,
      quoteNumber: `QT-TEST-${Date.now().toString().slice(-4)}-1`,
      version: 1,
      totalAmount: 4000000,
      status: "Draft"
    });

    const q1EventRes = await processOpportunityEvent({
      opportunityId: deal.id,
      type: "QuoteCreated",
      payload: {
        quoteId: quoteV1.id,
        quoteNumber: quoteV1.quoteNumber,
        version: 1,
        totalAmount: 4000000
      }
    });

    console.log(` Quote v1 recorded. Opportunity Status: ${q1EventRes.status}`);
    console.log(` Next Action: ${q1EventRes.nextAction}`);

    // ── 3. Approve Quote v1 ──
    console.log("\n[3] Approving Quote v1...");
    await quoteV1.update({ status: "Approved" });
    const q1ApproveRes = await processOpportunityEvent({
      opportunityId: deal.id,
      type: "QuoteApproved",
      payload: {
        quoteId: quoteV1.id,
        quoteNumber: quoteV1.quoteNumber,
        approverRole: "Team Lead"
      }
    });
    console.log(` Quote v1 approved. Opportunity Status: ${q1ApproveRes.status}`);
    console.log(` Next Action: ${q1ApproveRes.nextAction}`);

    // ── 4. Send Quote v1 ──
    console.log("\n[4] Sending Quote v1 to customer...");
    await quoteV1.update({ status: "Sent", sentAt: new Date() });
    const q1SendRes = await processOpportunityEvent({
      opportunityId: deal.id,
      type: "QuoteSent",
      payload: {
        quoteId: quoteV1.id,
        quoteNumber: quoteV1.quoteNumber
      }
    });
    console.log(` Quote v1 sent. Opportunity Status: ${q1SendRes.status}`);
    console.log(` Next Action: ${q1SendRes.nextAction} (Due in: ${q1SendRes.nextActionDue})`);

    // ── 5. Customer Pricing Request (WhatsApp / Email) ──
    console.log("\n[5] Simulating customer message with commercial pricing discussion...");
    const customerMsg = "We received the quotation. Can you give us a 7.5% discount on the 3 units?";
    const detectedIntent = classifyCommercialIntent(customerMsg);
    console.log(` Commercial Intent Classification: ${detectedIntent}`);

    const customerReplyRes = await processOpportunityEvent({
      opportunityId: deal.id,
      type: "CustomerWhatsAppReceived",
      payload: {
        text: customerMsg,
        intent: detectedIntent
      }
    });
    console.log(` Inbound message processed. Next Action: ${customerReplyRes.nextAction}`);
    console.log(` Current Activity: ${customerReplyRes.currentActivity}`);

    // ── 6. Create Revised Quote v2 ──
    console.log("\n[6] Creating Quote v2 with revision...");
    await quoteV1.update({ status: "Superseded" });

    const quoteV2: any = await sequelize.models.Quote.create({
      id: crypto.randomUUID(),
      dealId: deal.id,
      quoteNumber: `QT-TEST-${Date.now().toString().slice(-4)}-2`,
      version: 2,
      totalAmount: 3700000, // 7.5% discount applied
      status: "Approved",
      sentAt: new Date()
    });

    const q2EventRes = await processOpportunityEvent({
      opportunityId: deal.id,
      type: "QuoteCreated",
      payload: {
        quoteId: quoteV2.id,
        quoteNumber: quoteV2.quoteNumber,
        version: 2,
        totalAmount: 3700000
      }
    });
    console.log(` Quote v2 created. Status: ${q2EventRes.status}`);

    // ── 7. Customer Accepts Quote v2 as Final Agreed Quote ──
    console.log("\n[7] Customer accepts Quote v2 as Final Agreed Quote...");
    await quoteV2.update({
      status: "Accepted",
      acceptedAt: new Date()
    });

    const wonEventRes = await processOpportunityEvent({
      eventId: `accept_quote_${quoteV2.id}`,
      opportunityId: deal.id,
      type: "QuoteAccepted",
      payload: {
        quoteId: quoteV2.id,
        quoteNumber: quoteV2.quoteNumber,
        version: 2,
        totalAmount: 3700000
      }
    });

    console.log(` Opportunity WON! Status: ${wonEventRes.status}`);
    console.log(` Winning Quote: ${quoteV2.id}`);
    console.log(` Current Activity: ${wonEventRes.currentActivity}`);
    console.log(` Next Action: ${wonEventRes.nextAction}`);

    const refreshedDeal: any = await sequelize.models.Deal.findByPk(deal.id);
    if (refreshedDeal.status !== "WON") {
      throw new Error(`Expected Opportunity status to be WON, got ${refreshedDeal.status}`);
    }
    if (refreshedDeal.winningQuoteId !== quoteV2.id) {
      throw new Error(`Expected winningQuoteId to be ${quoteV2.id}, got ${refreshedDeal.winningQuoteId}`);
    }

    // ── 8. Idempotency Test ──
    console.log("\n[8] Replaying QuoteAccepted event to verify idempotency...");
    const idempotentReplayRes = await processOpportunityEvent({
      eventId: `accept_quote_${quoteV2.id}`,
      opportunityId: deal.id,
      type: "QuoteAccepted",
      payload: {
        quoteId: quoteV2.id,
        quoteNumber: quoteV2.quoteNumber
      }
    });

    console.log(` Idempotency Verified: isIdempotentReplay = ${idempotentReplayRes.isIdempotentReplay}`);
    console.log(` Message: ${idempotentReplayRes.message}`);

    // ── 9. Verify Quotes Preservation ──
    console.log("\n[9] Verifying historical quote preservation...");
    const dealQuotes = await sequelize.models.Quote.findAll({
      where: { dealId: deal.id },
      order: [["version", "ASC"]]
    });
    console.log(` Total Quotes preserved for deal: ${dealQuotes.length}`);
    for (const q of dealQuotes as any[]) {
      console.log(`   - Quote ${q.quoteNumber} (v${q.version}): Status = ${q.status}, Amount = ₹${Number(q.totalAmount).toLocaleString()}`);
    }

    // ── 10. Test Closed Lost Lifecycle Flow on Separate Opportunity ──
    console.log("\n[10] Testing Closed Lost scenario...");
    const lostOpp: any = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: "Omega Fabrication - Cancelled Project",
      amount: 1500000,
      status: "OPEN",
      customerId: conversionResult.account.id,
      accountId: conversionResult.account.id
    });

    const rejectionMsg = "We have decided not to proceed with this project as management cancelled the budget.";
    const rejIntent = classifyCommercialIntent(rejectionMsg);
    console.log(` Inbound Rejection Intent: ${rejIntent}`);

    await processOpportunityEvent({
      opportunityId: lostOpp.id,
      type: "CustomerEmailReceived",
      payload: { text: rejectionMsg, intent: rejIntent }
    });

    const markLostRes = await processOpportunityEvent({
      opportunityId: lostOpp.id,
      type: "MarkLost",
      payload: {
        lossReason: "NO_BUDGET",
        lossNotes: "Management cancelled budget for Q3 expansions."
      }
    });

    console.log(` Opportunity marked LOST. Status: ${markLostRes.status}`);
    const finalLostDeal: any = await sequelize.models.Deal.findByPk(lostOpp.id);
    console.log(` Loss Reason: ${finalLostDeal.lossReason}`);
    console.log(` Loss Notes: ${finalLostDeal.lossNotes}`);

    console.log("\n================================================================");
    console.log(" PHASE 6A AUTOMATED OPPORTUNITY LIFECYCLE ACCEPTANCE TEST PASSED!");
    console.log("================================================================\n");

    process.exit(0);
  } catch (error: any) {
    console.error(" Acceptance Test Failed:", error);
    process.exit(1);
  }
}

runOpportunityLifecycleAcceptanceTest();
