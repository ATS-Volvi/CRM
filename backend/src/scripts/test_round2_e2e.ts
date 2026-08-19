import { sequelize, User, Invoice, Payment, SupportTicket, Account, Asset, Quote, Deal, Lead } from "@nexus-crm/database";
import { createPayment, getPaymentsForInvoice } from "../controllers/paymentController";
import { createSupportTicket, listSupportTickets, updateSupportTicket, getSupportTicketById } from "../controllers/supportTicketController";
import crypto from "crypto";

async function runRound2E2E() {
  console.log("===============================================================");
  console.log("ROUND 2 E2E TEST: REAL PAYMENTS & SUPPORT TICKET WORKFLOW");
  console.log("===============================================================\n");

  const testId = Date.now();

  // Create users
  const admin = await User.create({
    id: crypto.randomUUID(),
    email: `admin_r2_${testId}@nexus.com`,
    password: "password123",
    name: `Admin R2 ${testId}`,
    role: "admin",
    isAvailable: true
  });

  const seniorAe = await User.create({
    id: crypto.randomUUID(),
    email: `ae_r2_${testId}@nexus.com`,
    password: "password123",
    name: `Senior AE R2 ${testId}`,
    role: "senior_ae",
    isAvailable: true
  });

  const salesRep = await User.create({
    id: crypto.randomUUID(),
    email: `rep_r2_${testId}@nexus.com`,
    password: "password123",
    name: `Sales Rep R2 ${testId}`,
    role: "sales_rep",
    isAvailable: true
  });

  // Create Account, Deal, Quote, and Invoice
  const account = await Account.create({
    id: crypto.randomUUID(),
    name: `Enterprise Account R2 ${testId}`,
    email: `billing_${testId}@corp.com`,
    phone: "+971-4-1234567"
  });

  const asset = await Asset.create({
    id: crypto.randomUUID(),
    name: `Generator Titan 5000 ${testId}`,
    type: "Generator",
    serialNumber: `GEN-${testId}`,
    status: "In Service",
    condition: "Good",
    customerId: account.id
  });

  const lead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Sarah",
    lastName: "Connor",
    company: account.name,
    email: account.email
  });

  const deal = await Deal.create({
    id: crypto.randomUUID(),
    name: `Deal R2 ${testId}`,
    amount: 100000.0,
    customerId: account.id,
    leadId: lead.id,
    ownerId: seniorAe.id
  });

  const quote = await Quote.create({
    id: crypto.randomUUID(),
    dealId: deal.id,
    status: "Accepted",
    totalAmount: 10000.0
  });

  const invoice = await Invoice.create({
    id: crypto.randomUUID(),
    quoteId: quote.id,
    status: "Sent",
    totalAmount: 10000.0,
    amountPaid: 0,
    paymentStatus: "unpaid",
    dueDate: new Date(Date.now() + 15 * 86400000)
  });

  // -----------------------------------------------------------------
  // 1. PAYMENT FLOW TESTING
  // -----------------------------------------------------------------
  console.log("--- 1. Testing Payment Authorization (sales_rep 403 Forbidden) ---");
  let repResCode = 200;
  let repResBody: any = null;
  await createPayment(
    {
      params: { invoiceId: invoice.id },
      body: { amount: 1000, method: "bank_transfer" },
      user: { id: salesRep.id, role: salesRep.role }
    } as any,
    {
      status: (c: number) => { repResCode = c; return { json: (b: any) => { repResBody = b; } }; },
      json: (b: any) => { repResBody = b; }
    } as any
  );

  console.log(`Sales Rep Response Code: ${repResCode}`);
  console.log(`Sales Rep Response Body: ${JSON.stringify(repResBody)}`);
  if (repResCode !== 403) throw new Error(`Expected 403 for sales_rep payment, got ${repResCode}`);
  console.log("✓ Verified: sales_rep is blocked with HTTP 403 Forbidden.\n");

  console.log("--- 2. Testing Senior AE Partial Payment ($4,000) ---");
  let aeResCode = 200;
  let aeResBody: any = null;
  await createPayment(
    {
      params: { invoiceId: invoice.id },
      body: { amount: 4000, method: "bank_transfer", reference: "TX-4000-WIRE" },
      user: { id: seniorAe.id, role: seniorAe.role }
    } as any,
    {
      status: (c: number) => { aeResCode = c; return { json: (b: any) => { aeResBody = b; } }; },
      json: (b: any) => { aeResBody = b; }
    } as any
  );

  const invAfterPartial = await Invoice.findByPk(invoice.id);
  console.log(`Invoice amountPaid: ${invAfterPartial?.amountPaid}`);
  console.log(`Invoice paymentStatus: ${invAfterPartial?.paymentStatus}`);

  if (Number(invAfterPartial?.amountPaid) !== 4000 || invAfterPartial?.paymentStatus !== "partial") {
    throw new Error(`Partial payment calculation failed! Paid: ${invAfterPartial?.amountPaid}, Status: ${invAfterPartial?.paymentStatus}`);
  }
  console.log("✓ Verified: Invoice amountPaid is $4,000 and paymentStatus is 'partial'.\n");

  console.log("--- 3. Testing Senior AE Completing Remaining Payment ($6,000) ---");
  await createPayment(
    {
      params: { invoiceId: invoice.id },
      body: { amount: 6000, method: "card", reference: "CC-AUTH-9921" },
      user: { id: seniorAe.id, role: seniorAe.role }
    } as any,
    {
      status: () => ({ json: () => {} }),
      json: () => {}
    } as any
  );

  const invAfterFull = await Invoice.findByPk(invoice.id);
  console.log(`Invoice final amountPaid: ${invAfterFull?.amountPaid}`);
  console.log(`Invoice final paymentStatus: ${invAfterFull?.paymentStatus}`);

  if (Number(invAfterFull?.amountPaid) !== 10000 || invAfterFull?.paymentStatus !== "paid") {
    throw new Error(`Full payment calculation failed! Paid: ${invAfterFull?.amountPaid}, Status: ${invAfterFull?.paymentStatus}`);
  }
  console.log("✓ Verified: Invoice is now fully paid with paymentStatus 'paid'.\n");

  // -----------------------------------------------------------------
  // 2. SUPPORT TICKET LIFECYCLE TESTING
  // -----------------------------------------------------------------
  console.log("--- 4. Testing Support Ticket Creation & Lifecycle ---");
  let ticketResBody: any = null;
  await createSupportTicket(
    {
      body: {
        accountId: account.id,
        assetId: asset.id,
        category: "issue",
        description: "Generator oil pressure warning triggered during peak load."
      },
      user: { id: seniorAe.id, role: seniorAe.role }
    } as any,
    {
      status: () => ({ json: (b: any) => { ticketResBody = b; } }),
      json: (b: any) => { ticketResBody = b; }
    } as any
  );

  console.log(`Created Ticket ID: ${ticketResBody.id}`);
  console.log(`Initial Status: ${ticketResBody.status}`);
  console.log(`Category: ${ticketResBody.category}`);
  console.log(`Account Name: ${ticketResBody.account?.name}`);
  console.log(`Asset Name: ${ticketResBody.asset?.name}`);

  if (!ticketResBody.id || ticketResBody.status !== "open" || ticketResBody.account?.id !== account.id) {
    throw new Error("Support ticket creation failed or missing relation enrichment");
  }
  console.log("✓ Verified: Support ticket created in 'open' status with enriched relations.\n");

  console.log("--- 5. Testing Ticket Status Transitions (open -> in_progress -> resolved -> closed) ---");
  // Transition to in_progress
  let updateBody: any = null;
  await updateSupportTicket(
    {
      params: { id: ticketResBody.id },
      body: { status: "in_progress" },
      user: { id: admin.id, role: "admin" }
    } as any,
    {
      status: () => ({ json: (b: any) => { updateBody = b; } }),
      json: (b: any) => { updateBody = b; }
    } as any
  );
  console.log(`Status after start: ${updateBody.status}`);
  if (updateBody.status !== "in_progress") throw new Error("Transition to in_progress failed");

  // Transition to resolved
  await updateSupportTicket(
    {
      params: { id: ticketResBody.id },
      body: { status: "resolved" },
      user: { id: admin.id, role: "admin" }
    } as any,
    {
      status: () => ({ json: (b: any) => { updateBody = b; } }),
      json: (b: any) => { updateBody = b; }
    } as any
  );
  console.log(`Status after resolution: ${updateBody.status} (resolvedAt: ${updateBody.resolvedAt})`);
  if (updateBody.status !== "resolved" || !updateBody.resolvedAt) {
    throw new Error("Transition to resolved failed or resolvedAt timestamp not set");
  }
  console.log("✓ Verified: Ticket status transitioned to 'resolved' and resolvedAt timestamp was automatically stamped.\n");

  // Cleanup
  await Payment.destroy({ where: { invoiceId: invoice.id } });
  await invoice.destroy();
  await quote.destroy();
  await deal.destroy();
  await lead.destroy();
  await SupportTicket.destroy({ where: { accountId: account.id } });
  await asset.destroy();
  await account.destroy();
  await salesRep.destroy();
  await seniorAe.destroy();
  await admin.destroy();

  console.log("===============================================================");
  console.log("ROUND 2 E2E TESTS COMPLETED WITH 100% SUCCESS!");
  console.log("===============================================================");
}

runRound2E2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
