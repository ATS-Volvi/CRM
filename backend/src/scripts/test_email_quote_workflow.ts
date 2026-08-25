import { sequelize } from "@nexus-crm/database";
import { processInboundIntakeEvent, parseInboundCustomerResponse } from "../services/leadIntakeAutomationEngine";
import { resolveDeliveryChannel, deliverQuote, sendFinalAgreedQuoteEmail } from "../services/quoteDeliveryService";
import crypto from "crypto";

async function runEmailQuoteWorkflowTest() {
  console.log("=================================================");
  console.log("TEST: EMAIL QUOTATION COMMUNICATION & EXTRACTION");
  console.log("=================================================");

  // 1. Test Email Extraction Parser on various responses
  console.log("\n[Step 1] Testing Email Extraction Parser on Various Automated Response Formats...");
  const samples = [
    "My email is ahmed.alqahtani@saudiglobal.com and we need 50 valves",
    "Ahmed, ahmed@aramco-supplier.sa, looking for solar inverters",
    "Please send quote to email: procurement@redseaconstruction.com",
    "contact at info@riyadhtech.com.sa for our warehouse project",
    "john.doe at acme dot com is my email"
  ];

  for (const text of samples) {
    const parsed = parseInboundCustomerResponse(text, "whatsapp");
    console.log(`  Input: "${text}"`);
    console.log(`  -> Extracted Email: "${parsed.email || 'NONE'}"`);
    if (!parsed.email) {
      throw new Error(`Failed to extract email from text: "${text}"`);
    }
  }
  console.log("✅ Step 1 Passed: Inbound response email extraction verified.");

  // 2. Simulate Inbound WhatsApp Lead without Email
  console.log("\n[Step 2] Ingesting WhatsApp Lead without Email...");
  const waPhone = `+96655${Math.floor(1000000 + Math.random() * 9000000)}`;
  const initialIntake = await processInboundIntakeEvent({
    channel: "whatsapp",
    senderPhone: waPhone,
    senderName: "Tariq Mansoor",
    message: "Hi, I need quotation for 25 commercial distribution panels for our project.",
    attribution: {
      source: "WhatsApp",
      sourceChannel: "whatsapp"
    }
  });

  console.log(`  Created Lead ID: ${initialIntake.leadId}, Status: ${initialIntake.intakeStatus}`);
  const leadBefore: any = await sequelize.models.Lead.findByPk(initialIntake.leadId);
  console.log(`  Lead initial email: ${leadBefore.email}, isComplete: ${initialIntake.isComplete}`);

  // 3. Simulate Automated Message Response containing Email
  console.log("\n[Step 3] Customer replies to automated prompt with their Email Address...");
  const customerEmail = `tariq.mansoor.${Date.now()}@mansoorgroup.sa`;
  const responseIntake = await processInboundIntakeEvent({
    channel: "whatsapp",
    leadId: initialIntake.leadId,
    senderPhone: waPhone,
    message: `My email is ${customerEmail} and company is Mansoor Industrial Group`,
    attribution: {
      source: "WhatsApp",
      sourceChannel: "whatsapp"
    }
  });

  const leadAfter: any = await sequelize.models.Lead.findByPk(initialIntake.leadId);
  console.log(`  Lead updated email: ${leadAfter.email}, emailVerified: ${leadAfter.emailVerified}`);
  
  if (leadAfter.email !== customerEmail.toLowerCase()) {
    throw new Error(`Email was not correctly saved to lead! Expected ${customerEmail.toLowerCase()}, got ${leadAfter.email}`);
  }
  console.log("✅ Step 3 Passed: Email successfully extracted and bound to Lead record from automated response.");

  // 4. Create Deal and Quote for this Lead
  console.log("\n[Step 4] Creating Opportunity and Quote for the Lead...");
  const deal = await sequelize.models.Deal.create({
    id: crypto.randomUUID(),
    name: "Mansoor Panels Project",
    leadId: leadAfter.id,
    amount: 125000,
    status: "Open"
  } as any);

  const quote = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    dealId: (deal as any).id,
    quoteNumber: `QT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    version: 1,
    status: "Draft",
    totalAmount: 125000
  } as any);

  // 5. Test Quotation Delivery Channel Resolution
  console.log("\n[Step 5] Resolving Quotation Delivery Channel...");
  const { contact, leadContext } = await require("../services/quoteDeliveryService").getQuoteContact(quote);
  console.log(`  Resolved Contact: name=${contact?.name}, email=${contact?.email}, phone=${contact?.phone}`);
  
  const resolution = resolveDeliveryChannel(contact, null, leadContext);
  console.log(`  Channel Resolution: channel=${resolution.channel}, recipient=${resolution.recipient}`);
  console.log(`  Resolution Reason: "${resolution.reason}"`);

  if (resolution.channel !== "EMAIL" || resolution.recipient !== customerEmail.toLowerCase()) {
    throw new Error(`Quotation delivery did not resolve to EMAIL! Got ${resolution.channel} -> ${resolution.recipient}`);
  }
  console.log("✅ Step 5 Passed: Quote delivery strictly routes to Email.");

  // 6. Deliver Quote via Email
  console.log("\n[Step 6] Delivering Quote via Email...");
  const deliveryResult = await deliverQuote((quote as any).id, {
    channel: "EMAIL",
    messageCustomization: "Please find attached our official proposal for your 25 distribution panels."
  });
  console.log(`  Delivery result: channel=${deliveryResult.channel}, recipient=${deliveryResult.recipient}, status=${deliveryResult.status}`);

  const updatedQuote: any = await sequelize.models.Quote.findByPk((quote as any).id);
  console.log(`  Quote status after send: ${updatedQuote.status}, sentVia: ${updatedQuote.sentVia}`);
  if (updatedQuote.status !== "Sent" || updatedQuote.sentVia !== "EMAIL") {
    throw new Error(`Quote was not properly marked as Sent via EMAIL!`);
  }
  console.log("✅ Step 6 Passed: Quote delivered via Email.");

  // 7. Quotation Negotiation & Revision
  console.log("\n[Step 7] Testing Quotation Negotiation Revision...");
  const revision = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    dealId: (deal as any).id,
    quoteNumber: updatedQuote.quoteNumber,
    version: 2,
    status: "Draft",
    totalAmount: 118750 // 5% discount negotiated
  } as any);

  const revisionResolution = resolveDeliveryChannel(contact, null, leadContext);
  console.log(`  Revision v2 Delivery Channel: ${revisionResolution.channel} -> ${revisionResolution.recipient}`);
  if (revisionResolution.channel !== "EMAIL") {
    throw new Error("Revision did not route through EMAIL!");
  }
  console.log("✅ Step 7 Passed: Negotiation quote revision routes through Email.");

  // 8. Final Agreed Quote Confirmation Email
  console.log("\n[Step 8] Testing Final Agreed Quotation Email Dispatch...");
  const finalEmailRes = await sendFinalAgreedQuoteEmail((revision as any).id, {
    notes: "Agreed terms after final commercial alignment."
  });
  console.log(`  Final email result: success=${finalEmailRes.success}, recipient=${finalEmailRes.recipient}`);
  if (!finalEmailRes.success || finalEmailRes.recipient !== customerEmail.toLowerCase()) {
    throw new Error(`Failed to dispatch final agreed quote email!`);
  }
  console.log("✅ Step 8 Passed: Final Agreed Quote confirmation sent via Email.");

  console.log("\n=================================================");
  console.log("🎉 ALL TESTS PASSED: Email Quote Workflow Verified!");
  console.log("=================================================\n");
}

runEmailQuoteWorkflowTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  });
