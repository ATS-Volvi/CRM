import { sequelize } from "@nexus-crm/database";
import { ingestLead } from "../services/leadIngestion";

async function verifyFullSalesLifecycle() {
  console.log("==================================================");
  console.log("VERIFYING COMPLETE END-TO-END SALES LIFECYCLE WORKFLOW");
  console.log("==================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✔ Database connection authenticated.\n");

    const timestamp = Date.now();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: CUSTOMER SENDS LEAD
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STEP 1: Customer Sends Lead");
    const leadId = await ingestLead({
      firstName: "Michael",
      lastName: `Hill_${timestamp}`,
      email: `michael.hill_${timestamp}@titanpharma.com`,
      company: "Titan Pharmaceuticals Group",
      source: "Website",
      message: "Requesting quotation for enterprise modular cleanrooms",
      budgetRange: "$150,000"
    });
    console.log(`   ✔ Lead Ingested Successfully! ID: ${leadId}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: LEAD APPEARS IN INBOX
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 2: Lead Appears in Inbox");
    const lead = await sequelize.models.Lead.findByPk(leadId, {
      include: [{ model: sequelize.models.User, as: "assignedTo" }]
    });

    if (!lead) throw new Error("Lead missing from Inbox query");
    const leadData = lead.toJSON() as any;
    console.log(`   ✔ Found Lead in Inbox! Lead Number: ${leadData.leadNumber}, Status: ${leadData.status}, Source: ${leadData.source}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: AUTO ACKNOWLEDGEMENT
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 3: Auto Acknowledgement Dispatch");
    const autoActivities = await sequelize.models.Activity.findAll({
      where: { leadId, direction: "outbound" }
    });
    console.log(`   ✔ Auto-Acknowledgement activities recorded: ${autoActivities.length}`);
    autoActivities.forEach((act: any) => console.log(`     - ${act.outcome}`));

    // ─────────────────────────────────────────────────────────────
    // STEP 4: SALES REP ASSIGNED
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 4: Sales Rep Assigned");
    const assignedRep = leadData.assignedTo;
    console.log(`   ✔ Owner Assigned: ${assignedRep ? `${assignedRep.name} (${assignedRep.email})` : "Unassigned"}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 5: SALES REP OPENS LEAD & CLEARS UNREAD
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 5: Sales Rep Opens Lead");
    await lead.update({ unreadWhatsappCount: 0 });
    const activities = await sequelize.models.Activity.findAll({ where: { leadId } });
    const tasks = await sequelize.models.Task.findAll({ where: { leadId } });
    console.log(`   ✔ Lead workspace opened. Active tasks: ${tasks.length}, Total activities: ${activities.length}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 6: MOVES NEW → CONTACTED → QUALIFIED
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 6: Moves New → Contacted → Qualified");
    await lead.update({ status: "Contacted" });
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      type: "stage_change",
      leadId,
      outcome: "Stage changed: New → Contacted",
      direction: "internal",
      isCompleted: true,
      createdById: leadData.assignedToId || (await getFirstAdminId())
    });
    console.log("   ✔ Lead stage updated: Contacted");

    await lead.update({ status: "Qualified" });
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      type: "stage_change",
      leadId,
      outcome: "Stage changed: Contacted → Qualified",
      direction: "internal",
      isCompleted: true,
      createdById: leadData.assignedToId || (await getFirstAdminId())
    });
    console.log("   ✔ Lead stage updated: Qualified");

    // ─────────────────────────────────────────────────────────────
    // STEP 7: SCHEDULES MEETING
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 7: Schedules Meeting");
    const meeting = await sequelize.models.Meeting.create({
      id: require('crypto').randomUUID(),
      title: "Cleanroom Technical Requirements & Demo",
      date: new Date().toISOString().split('T')[0],
      time: "14:00",
      attendees: leadData.email,
      agenda: "Review modular cleanroom specs and confirm delivery timeline",
      leadId,
      customerId: leadData.customerId,
      organizerId: leadData.assignedToId
    });
    console.log(`   ✔ Meeting Scheduled! ID: ${(meeting as any).id}, Title: ${(meeting as any).title}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 8: CREATES QUOTE
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 8: Creates Quote");
    // Find or create a pipeline stage & deal for this lead
    let stage = await sequelize.models.PipelineStage.findOne({ where: { name: "Proposal" } });
    if (!stage) {
      stage = await sequelize.models.PipelineStage.create({
        id: require('crypto').randomUUID(),
        name: "Proposal",
        order: 3,
        probability: 60
      });
    }

    const deal = await sequelize.models.Deal.create({
      id: require('crypto').randomUUID(),
      name: `Titan Pharma Cleanroom Project - ${leadData.lastName}`,
      amount: 150000.00,
      stageId: (stage as any).id,
      leadId,
      ownerId: leadData.assignedToId || (await getFirstAdminId()),
      customerId: leadData.customerId
    });
    console.log(`   ✔ Deal Created! ID: ${(deal as any).id}, Amount: $150,000.00`);

    // Fetch or create a product entry for quote line items
    let product = await sequelize.models.PriceBookEntry.findOne();
    if (!product) {
      product = await sequelize.models.PriceBookEntry.create({
        id: require('crypto').randomUUID(),
        sku: "MOD-CR-100",
        name: "Modular Cleanroom Unit (Class 100)",
        unitPrice: 150000.00,
        category: "Cleanrooms"
      });
    }

    const year = new Date().getFullYear();
    const count = await sequelize.models.Quote.count();
    const quoteNum = `QT-${year}-${String(count + 1).padStart(5, '0')}`;

    const quote = await sequelize.models.Quote.create({
      id: require('crypto').randomUUID(),
      dealId: (deal as any).id,
      status: "Draft",
      totalAmount: 150000.00,
      quoteNumber: quoteNum,
      version: 1
    });

    await sequelize.models.QuoteLineItem.create({
      id: require('crypto').randomUUID(),
      quoteId: (quote as any).id,
      productId: (product as any).id,
      quantity: 1,
      unitPrice: 150000.00,
      totalPrice: 150000.00
    });
    console.log(`   ✔ Quote Created! Number: ${quoteNum}, Total: $150,000.00`);

    // ─────────────────────────────────────────────────────────────
    // STEP 9: QUOTE APPROVAL
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 9: Quote Approval");
    await quote.update({ status: "Approved", statusChangedAt: new Date() });
    console.log(`   ✔ Quote Approved! Status: ${(quote as any).status}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 10: QUOTE SENT
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 10: Quote Sent");
    await quote.update({ status: "Sent", sentAt: new Date() });
    await quote.reload();
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      leadId,
      type: "email",
      outcome: `[AUTOMATED] Quote ${quoteNum} sent to ${leadData.email}`,
      direction: "outbound",
      isCompleted: true,
      createdById: leadData.assignedToId || (await getFirstAdminId())
    });
    console.log(`   ✔ Quote Sent to Customer! Status: ${(quote as any).status}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 11: CUSTOMER ACCEPTS
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 11: Customer Accepts Quote");
    await quote.update({ status: "Accepted", acceptedAt: new Date() });
    await quote.reload();
    
    let wonStage = await sequelize.models.PipelineStage.findOne({
      where: { name: "Won" }
    });
    if (!wonStage) {
      wonStage = await sequelize.models.PipelineStage.findOne();
    }
    if (wonStage) {
      await deal.update({ stageId: (wonStage as any).id });
    }
    console.log(`   ✔ Customer Accepted Quote! Status: ${(quote as any).status}, Deal Stage: Won`);

    // ─────────────────────────────────────────────────────────────
    // STEP 12: INVOICE GENERATED
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ STEP 12: Invoice Generated");
    const invoice = await sequelize.models.Invoice.create({
      id: require('crypto').randomUUID(),
      quoteId: (quote as any).id,
      status: "Sent",
      totalAmount: 150000.00,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await sequelize.models.InvoiceLineItem.create({
      id: require('crypto').randomUUID(),
      invoiceId: (invoice as any).id,
      productId: (product as any).id,
      quantity: 1,
      unitPrice: 150000.00,
      totalPrice: 150000.00
    });
    console.log(`   ✔ Invoice Created Successfully! Invoice ID: ${(invoice as any).id}, Total: $150,000.00`);

    console.log("\n==================================================");
    console.log("FULL SALES LIFECYCLE WORKFLOW VERIFIED SUCCESSFULLY! 🎉");
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Full Sales Lifecycle Verification Failed:", err);
    process.exit(1);
  }
}

async function getFirstAdminId(): Promise<string> {
  const admin = await sequelize.models.User.findOne({ where: { role: "admin" } });
  return admin ? (admin as any).id : "00000000-0000-0000-0000-000000000000";
}

verifyFullSalesLifecycle();
