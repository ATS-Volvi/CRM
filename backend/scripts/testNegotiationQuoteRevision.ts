import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();
import { Database, sequelize, Deal, Lead, User, Quote, QuoteLineItem, PriceBookEntry } from "@nexus-crm/database";

function deriveCommercialActivity(opp: any): "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" {
  const quotes: any[] = Array.isArray(opp.quotes) ? opp.quotes : [];
  const stageName = (typeof opp.stage === "object" ? opp.stage?.name : String(opp.stage || "")).toLowerCase();

  const hasMultipleVersions = quotes.some((q) => Number(q.version || 1) > 1) || quotes.length > 1;
  const hasFinalAgreedQuote = quotes.some((q) => q.isFinalAgreed === true);
  const isNegotiationStage = stageName.includes("negotiat") || stageName.includes("agree");
  
  const sortedQuotes = [...quotes].sort((a, b) => (Number(a.version) || 1) - (Number(b.version) || 1));
  const activeQuote = [...sortedQuotes].reverse().find((q) => q.status !== "Superseded" && q.status !== "Cancelled");
  const isAwaitingReplyOrInReview = activeQuote && (activeQuote.status === "Sent" || activeQuote.status === "Viewed" || activeQuote.status === "Pending Approval");

  if (hasMultipleVersions || hasFinalAgreedQuote || isNegotiationStage || isAwaitingReplyOrInReview) {
    return "NEGOTIATION";
  }

  const hasQuote = quotes.length > 0;
  const isProposalStage = stageName.includes("quote") || stageName.includes("solution") || stageName.includes("scope") || stageName.includes("proposal");

  if (hasQuote || isProposalStage) {
    return "PROPOSAL";
  }

  if (stageName.includes("require") || stageName.includes("qualif") || opp.leadId || opp.qualificationData) {
    return "QUALIFIED";
  }

  return "NEW";
}

async function runTest() {
  console.log("=== STARTING NEGOTIATION & QUOTE REVISION TEST ===");
  await Database.createConnection();
  await sequelize.query('ALTER TABLE "Quotes" ADD COLUMN IF NOT EXISTS "isFinalAgreed" BOOLEAN DEFAULT FALSE;');

  let user: any = await User.findOne();
  if (!user) {
    user = await User.create({
      id: require("crypto").randomUUID(),
      name: "AE Closer",
      email: `ae_${Date.now()}@nexus.com`,
      password: "HashedPassword123!",
      role: "SALES_REP",
      isAvailable: true
    });
  }

  let lead: any = await Lead.findOne({ where: { status: "QUALIFIED" } });
  if (!lead) {
    lead = await Lead.findOne();
  }

  const [product] = await PriceBookEntry.findOrCreate({
    where: { sku: "ERP-ENT-LICENSE" },
    defaults: {
      name: "Enterprise ERP Cloud License",
      unitPrice: 500000,
      category: "Software"
    }
  });

  // 2. Create Deal
  const dealId = require("crypto").randomUUID();
  const deal = await Deal.create({
    id: dealId,
    name: "MegaCorp Enterprise ERP Deal",
    amount: 500000,
    ownerId: user.id,
    leadId: lead.id,
    status: "OPEN"
  });
  console.log("✓ Created Deal:", deal.name, deal.id);

  // 3. Create Quote v1
  const quote1Id = require("crypto").randomUUID();
  const quote1 = await Quote.create({
    id: quote1Id,
    dealId: deal.id,
    quoteNumber: `QT-TEST-001`,
    version: 1,
    status: "Sent",
    totalAmount: 500000,
    isFinalAgreed: false
  });
  await QuoteLineItem.create({
    id: require("crypto").randomUUID(),
    quoteId: quote1.id,
    productId: product.id,
    quantity: 1,
    unitPrice: 500000,
    totalPrice: 500000
  });
  console.log("✓ Created Quote v1:", quote1.quoteNumber, "Status:", quote1.status);

  // Test deriveCommercialActivity with 1 sent quote (awaiting customer reply)
  const oppWithV1 = {
    ...deal.toJSON(),
    quotes: [quote1.toJSON()]
  };
  const categoryV1 = deriveCommercialActivity(oppWithV1);
  console.log("  deriveCommercialActivity (v1 Sent):", categoryV1);
  if (categoryV1 !== "NEGOTIATION") {
    throw new Error(`Expected NEGOTIATION for Sent quote awaiting reply, got ${categoryV1}`);
  }

  // 4. Create Revision Quote v2 (simulate revision endpoint logic)
  await quote1.update({ status: "Superseded" });
  const quote2Id = require("crypto").randomUUID();
  const quote2 = await Quote.create({
    id: quote2Id,
    dealId: deal.id,
    quoteNumber: `QT-TEST-001-R1`,
    version: 2,
    status: "Draft",
    totalAmount: 475000,
    isFinalAgreed: false
  });
  await QuoteLineItem.create({
    id: require("crypto").randomUUID(),
    quoteId: quote2.id,
    productId: product.id,
    quantity: 1,
    unitPrice: 475000,
    totalPrice: 475000
  });
  console.log("✓ Created Revision Quote v2 (Parent v1 Superseded):", quote2.version, "Total:", quote2.totalAmount);

  // 5. Create Revision Quote v3
  await quote2.update({ status: "Superseded" });
  const quote3Id = require("crypto").randomUUID();
  const quote3 = await Quote.create({
    id: quote3Id,
    dealId: deal.id,
    quoteNumber: `QT-TEST-001-R2`,
    version: 3,
    status: "Sent",
    totalAmount: 450000,
    isFinalAgreed: false
  });
  console.log("✓ Created Revision Quote v3 (v2 Superseded):", quote3.version, "Total:", quote3.totalAmount);

  // 6. Test Mark as Final on Quote v3
  const { Op } = require("sequelize");
  await Quote.update({ isFinalAgreed: false }, { where: { dealId: deal.id, id: { [Op.ne]: quote3.id } } });
  await quote3.update({ isFinalAgreed: true });
  console.log("✓ Marked Quote v3 as Final Agreed Terms");

  // Reload all quotes for deal
  const allQuotes = await Quote.findAll({
    where: { dealId: deal.id },
    order: [["version", "ASC"]]
  });

  console.log("\n--- Verification Summary ---");
  for (const q of allQuotes) {
    console.log(`- Quote v${q.version} (${q.quoteNumber}): Status=${q.status}, isFinalAgreed=${q.isFinalAgreed}, Amount=${q.totalAmount}`);
  }

  // Assertions
  if (allQuotes.length !== 3) throw new Error(`Expected 3 quotes, got ${allQuotes.length}`);
  if (allQuotes[0].status !== "Superseded") throw new Error("Expected Quote v1 to be Superseded");
  if (allQuotes[1].status !== "Superseded") throw new Error("Expected Quote v2 to be Superseded");
  if (allQuotes[2].isFinalAgreed !== true) throw new Error("Expected Quote v3 to have isFinalAgreed=true");
  if (allQuotes[0].isFinalAgreed === true || allQuotes[1].isFinalAgreed === true) {
    throw new Error("Only one quote should be marked as Final Agreed");
  }

  const oppFinal = {
    ...deal.toJSON(),
    quotes: allQuotes.map((q) => q.toJSON())
  };
  const categoryFinal = deriveCommercialActivity(oppFinal);
  console.log("✓ Final deterministic commercial activity category:", categoryFinal);
  if (categoryFinal !== "NEGOTIATION") {
    throw new Error(`Expected NEGOTIATION for multi-revision final quote, got ${categoryFinal}`);
  }

  console.log("\n=== ALL NEGOTIATION & QUOTE REVISION TESTS PASSED SUCCESSFULLY! ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
