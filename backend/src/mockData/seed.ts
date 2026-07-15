import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function seedDatabase() {
  try {
    await Database.createConnection();
    console.log("Syncing database...");
    console.log("Truncating data...");
    const tables = [
      'WebhookEvents', 'ScheduledEmails', 'Notifications', 'MessageTemplates',
      'InvoiceLineItems', 'Invoices', 'Activities', 'AssignmentRules',
      'ApprovalRequests', 'PurchaseOrders', 'QuoteLineItems', 'PriceBookEntries',
      'Quotes', 'Deals', 'LeadStageHistories', 'PipelineStages', 'Leads', 'Users',
      'Requirements', 'LineItems', 'ConstructionItems'
    ];
    for (const table of tables) {
      try {
        await sequelize.query(`DELETE FROM ${table};`);
      } catch (e) {}
    }
    
    const models = sequelize.models;

    console.log("Seeding Users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const admin = await models.User.create({
      id: crypto.randomUUID(),
      name: "Sophia Martinez",
      email: "admin@nexus.com",
      password: hashedPassword,
      role: "admin",
      isAvailable: true,
      maxOpenLeads: 50
    }) as any;

    const manager = await models.User.create({
      id: crypto.randomUUID(),
      name: "Marcus Vance",
      email: "marcus@nexus.com",
      password: hashedPassword,
      role: "sales_manager",
      isAvailable: true,
      maxOpenLeads: 40
    }) as any;

    const rep1 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Liam Carter",
      email: "liam@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 30
    }) as any;

    const rep2 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Emma Watson",
      email: "emma@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 30
    }) as any;

    const rep3 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Olivia Davis",
      email: "olivia@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 25
    }) as any;

    const rep4 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Ethan Hunt",
      email: "ethan@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: false,
      maxOpenLeads: 35
    }) as any;

    const rep5 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Isabella Rose",
      email: "isabella@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 30
    }) as any;

    const rep6 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Noah Bennett",
      email: "noah@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 28
    }) as any;

    const rep7 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Ava Sterling",
      email: "ava@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: false,
      maxOpenLeads: 30
    }) as any;

    const rep8 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Jackson Pollock",
      email: "jackson@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true,
      maxOpenLeads: 40
    }) as any;

    console.log("Seeding PriceBook Catalog...");
    const products = [
      { name: "Enterprise Cloud Suite Premium", sku: "SKU-CLOUD-ENT", category: "Enterprise VIP", unitPrice: 25000, minPrice: 19000, maxPrice: 35000 },
      { name: "Advanced Analytics Platform Addon", sku: "SKU-ANALYTICS-ADV", category: "Standard Tier", unitPrice: 8500, minPrice: 6000, maxPrice: 12000 },
      { name: "Priority Support Plan Pro (Annual)", sku: "SKU-SUPPORT-PRO", category: "Standard Tier", unitPrice: 5000, minPrice: 4000, maxPrice: 7000 },
      { name: "Nexus CRM Starter Package", sku: "SKU-CRM-START", category: "SME Starter", unitPrice: 2500, minPrice: 1800, maxPrice: 3500 },
      { name: "Global Security Integration Patch", sku: "SKU-SEC-INT", category: "Enterprise VIP", unitPrice: 15000, minPrice: 12000, maxPrice: 20000 },
      { name: "Data Warehouse Module", sku: "SKU-DW-MOD", category: "Enterprise VIP", unitPrice: 18000, minPrice: 14000, maxPrice: 24000 },
      { name: "API Integration Bundle", sku: "SKU-API-BND", category: "Standard Tier", unitPrice: 7500, minPrice: 5500, maxPrice: 10000 },
      { name: "Mobile CRM App License (Per Seat)", sku: "SKU-MOB-CRM", category: "SME Starter", unitPrice: 1200, minPrice: 900, maxPrice: 1800 },
    ];

    const seededProducts: any[] = [];
    for (const p of products) {
      seededProducts.push(await models.PriceBookEntry.create({
        id: crypto.randomUUID(),
        ...p,
        segmentPricing: JSON.stringify({ SME: p.unitPrice * 0.95, Enterprise: p.unitPrice, Government: p.unitPrice * 1.05 })
      }));
    }

    console.log("Seeding Pipeline Stages...");
    const stages = [
      { name: "New", probability: 10 },
      { name: "Contacted", probability: 20 },
      { name: "Qualified", probability: 40 },
      { name: "Meeting/Demo", probability: 60 },
      { name: "Proposal", probability: 70 },
      { name: "Negotiation", probability: 80 },
      { name: "Won", probability: 100 },
      { name: "Lost", probability: 0 },
      { name: "On Hold", probability: 5 }
    ];
    const stageRecords: any[] = [];
    for (let i = 0; i < stages.length; i++) {
      stageRecords.push(await models.PipelineStage.create({
        id: crypto.randomUUID(),
        name: stages[i].name,
        order: i + 1,
        probability: stages[i].probability
      }));
    }

    const stageNew = stageRecords[0];
    const stageContacted = stageRecords[1];
    const stageQualified = stageRecords[2];
    const stageDemo = stageRecords[3];
    const stageProposal = stageRecords[4];
    const stageNegotiation = stageRecords[5];
    const stageWon = stageRecords[6];
    const stageLost = stageRecords[7];
    const stageOnHold = stageRecords[8];

    console.log("Seeding Leads...");
    const leadsData = [
      { firstName: "Robert", lastName: "Chen", company: "Alibaba Global", email: "robert@alibaba.com", phone: "1-555-0192", status: "Qualified", source: "Website", leadScore: 88, assignedToId: rep1.id, industry: "Technology" },
      { firstName: "Sarah", lastName: "Jenkins", company: "Tesla Motors", email: "s.jenkins@tesla.com", phone: "1-555-0183", status: "Contacted", source: "Referral", leadScore: 95, assignedToId: rep1.id, industry: "Automotive" },
      { firstName: "James", lastName: "Morgan", company: "SpaceX Inc.", email: "jmorgan@spacex.com", phone: "1-555-0211", status: "Qualified", source: "Cold Call", leadScore: 72, assignedToId: rep1.id, industry: "Aerospace" },
      { firstName: "Charlotte", lastName: "King", company: "Adobe Systems", email: "cking@adobe.com", phone: "1-555-0198", status: "New", source: "LinkedIn", leadScore: 61, assignedToId: rep1.id, industry: "Software" },
      { firstName: "David", lastName: "Miller", company: "Walmart Inc.", email: "david.miller@walmart.com", phone: "1-555-0144", status: "Qualified", source: "Cold Call", leadScore: 79, assignedToId: rep2.id, industry: "Retail" },
      { firstName: "Sophia", lastName: "Loren", company: "Netflix Studios", email: "loren@netflix.com", phone: "1-555-0112", status: "Qualified", source: "Website", leadScore: 90, assignedToId: rep2.id, industry: "Entertainment" },
      { firstName: "Michael", lastName: "Scott", company: "Dunder Mifflin", email: "mscott@dundermifflin.com", phone: "1-555-0166", status: "Contacted", source: "Trade Show", leadScore: 55, assignedToId: rep2.id, industry: "Manufacturing" },
      { firstName: "Oliver", lastName: "Kahn", company: "BMW Group", email: "kahn@bmw.de", phone: "1-555-0177", status: "New", source: "Social Media", leadScore: 60, assignedToId: rep3.id, industry: "Automotive" },
      { firstName: "Priya", lastName: "Sharma", company: "Infosys Ltd.", email: "p.sharma@infosys.com", phone: "1-555-0201", status: "Qualified", source: "Referral", leadScore: 85, assignedToId: rep3.id, industry: "Technology" },
      { firstName: "Leo", lastName: "Fischer", company: "SAP SE", email: "leo.f@sap.com", phone: "1-555-0215", status: "Contacted", source: "Website", leadScore: 74, assignedToId: rep3.id, industry: "Software" },
      { firstName: "Hannah", lastName: "Kim", company: "Samsung Electronics", email: "h.kim@samsung.com", phone: "1-555-0188", status: "New", source: "Cold Call", leadScore: 48, assignedToId: rep4.id, industry: "Electronics" },
      { firstName: "Lucas", lastName: "Pierre", company: "LVMH Group", email: "l.pierre@lvmh.com", phone: "1-555-0225", status: "Contacted", source: "LinkedIn", leadScore: 77, assignedToId: rep4.id, industry: "Luxury Goods" },
      { firstName: "Aisha", lastName: "Patel", company: "Reliance Industries", email: "a.patel@reliance.com", phone: "1-555-0234", status: "Qualified", source: "Referral", leadScore: 92, assignedToId: rep5.id, industry: "Energy" },
      { firstName: "Connor", lastName: "Walsh", company: "Boston Dynamics", email: "cwalsh@bostondynamics.com", phone: "1-555-0241", status: "New", source: "Trade Show", leadScore: 66, assignedToId: rep5.id, industry: "Robotics" },
      { firstName: "Elena", lastName: "Musk", company: "Boring Company", email: "elena@boring.co", phone: "1-555-0253", status: "Contacted", source: "Social Media", leadScore: 83, assignedToId: rep5.id, industry: "Infrastructure" },
      { firstName: "Marcus", lastName: "Webb", company: "Goldman Sachs", email: "m.webb@gs.com", phone: "1-555-0262", status: "Qualified", source: "Referral", leadScore: 89, assignedToId: rep6.id, industry: "Finance" },
      { firstName: "Sofia", lastName: "Greco", company: "Ferrari S.p.A", email: "s.greco@ferrari.com", phone: "1-555-0271", status: "New", source: "Website", leadScore: 70, assignedToId: rep6.id, industry: "Automotive" },
      { firstName: "Tyler", lastName: "Brooks", company: "Shopify Inc.", email: "t.brooks@shopify.com", phone: "1-555-0279", status: "Contacted", source: "Cold Call", leadScore: 58, assignedToId: rep7.id, industry: "E-commerce" },
      { firstName: "Nadia", lastName: "Volkov", company: "Kaspersky Lab", email: "n.volkov@kaspersky.com", phone: "1-555-0287", status: "Qualified", source: "LinkedIn", leadScore: 76, assignedToId: rep7.id, industry: "Cybersecurity" },
      { firstName: "Ahmed", lastName: "Al-Rashid", company: "ADNOC Group", email: "a.rashid@adnoc.ae", phone: "1-555-0296", status: "Qualified", source: "Referral", leadScore: 94, assignedToId: rep8.id, industry: "Energy" },
      { firstName: "Yuki", lastName: "Tanaka", company: "Toyota Motor Corp.", email: "y.tanaka@toyota.co.jp", phone: "1-555-0304", status: "Contacted", source: "Trade Show", leadScore: 81, assignedToId: rep8.id, industry: "Automotive" },
      { firstName: "Grace", lastName: "O'Brien", company: "Stripe Inc.", email: "g.obrien@stripe.com", phone: "1-555-0312", status: "New", source: "Website", leadScore: 69, assignedToId: rep8.id, industry: "FinTech" },
    ];

    const seededLeads: any[] = [];
    for (const l of leadsData) {
      seededLeads.push(await models.Lead.create({
        id: crypto.randomUUID(),
        ...l
      }));
    }

    console.log("Seeding Deals...");
    const dealsData = [
      { name: "Alibaba Cloud Expansion", amount: 48000, stageId: stageProposal.id, ownerId: rep1.id, leadId: seededLeads[0].id },
      { name: "Tesla Advanced Data Suite", amount: 25000, stageId: stageDemo.id, ownerId: rep1.id, leadId: seededLeads[1].id },
      { name: "SpaceX Mission Analytics", amount: 75000, stageId: stageNegotiation.id, ownerId: rep1.id, leadId: seededLeads[2].id },
      { name: "Walmart CRM Rollout", amount: 150000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[4].id },
      { name: "Netflix Analytics Sync", amount: 35000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[5].id },
      { name: "Dunder Mifflin CRM Pilot", amount: 12500, stageId: stageContacted.id, ownerId: rep2.id, leadId: seededLeads[6].id },
      { name: "BMW Group Enterprise Suite", amount: 95000, stageId: stageProposal.id, ownerId: rep3.id, leadId: seededLeads[7].id },
      { name: "Infosys Platform Integration", amount: 42000, stageId: stageWon.id, ownerId: rep3.id, leadId: seededLeads[8].id },
      { name: "Samsung Mobile CRM Fleet", amount: 55000, stageId: stageQualified.id, ownerId: rep4.id, leadId: seededLeads[10].id },
      { name: "Reliance Energy Dashboard", amount: 88000, stageId: stageNegotiation.id, ownerId: rep5.id, leadId: seededLeads[12].id },
      { name: "Boston Dynamics Field Suite", amount: 32000, stageId: stageDemo.id, ownerId: rep5.id, leadId: seededLeads[13].id },
      { name: "Goldman Sachs Analytics Hub", amount: 120000, stageId: stageWon.id, ownerId: rep6.id, leadId: seededLeads[15].id },
      { name: "Ferrari Custom CRM Build", amount: 45000, stageId: stageProposal.id, ownerId: rep6.id, leadId: seededLeads[16].id },
      { name: "Shopify Commerce Integration", amount: 28000, stageId: stageOnHold.id, ownerId: rep7.id, leadId: seededLeads[17].id },
      { name: "ADNOC Enterprise Bundle", amount: 185000, stageId: stageWon.id, ownerId: rep8.id, leadId: seededLeads[19].id },
      { name: "Toyota Dealer Network CRM", amount: 67000, stageId: stageProposal.id, ownerId: rep8.id, leadId: seededLeads[20].id },
    ];

    const seededDeals: any[] = [];
    for (const d of dealsData) {
      seededDeals.push(await models.Deal.create({
        id: crypto.randomUUID(),
        ...d
      }));
    }

    console.log("Seeding Quotes & Purchase Orders...");

    const quote1 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[3].id, status: "Accepted", totalAmount: 150000, quoteNumber: "QT-2026-00001", version: 1, acceptedAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote1.id, productId: seededProducts[0].id, quantity: 6, unitPrice: 25000, totalPrice: 150000 });
    await models.PurchaseOrder.create({ id: crypto.randomUUID(), quoteId: quote1.id, poNumber: "PO-WMT-9921", amount: 150000, status: "Verified" });

    const quote2 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[4].id, status: "Accepted", totalAmount: 35000, quoteNumber: "QT-2026-00002", version: 1, acceptedAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote2.id, productId: seededProducts[2].id, quantity: 7, unitPrice: 5000, totalPrice: 35000 });
    await models.PurchaseOrder.create({ id: crypto.randomUUID(), quoteId: quote2.id, poNumber: "PO-NFX-8842", amount: 35000, status: "Verified" });

    const quote3 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[0].id, status: "Sent", totalAmount: 48000, quoteNumber: "QT-2026-00003", version: 1, sentAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote3.id, productId: seededProducts[1].id, quantity: 4, unitPrice: 12000, totalPrice: 48000 });

    const quote4 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[7].id, status: "Accepted", totalAmount: 42000, quoteNumber: "QT-2026-00004", version: 1, acceptedAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote4.id, productId: seededProducts[6].id, quantity: 5, unitPrice: 8400, totalPrice: 42000 });
    await models.PurchaseOrder.create({ id: crypto.randomUUID(), quoteId: quote4.id, poNumber: "PO-INFO-7731", amount: 42000, status: "Verified" });

    const quote5 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[11].id, status: "Accepted", totalAmount: 120000, quoteNumber: "QT-2026-00005", version: 1, acceptedAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote5.id, productId: seededProducts[5].id, quantity: 6, unitPrice: 20000, totalPrice: 120000 });
    await models.PurchaseOrder.create({ id: crypto.randomUUID(), quoteId: quote5.id, poNumber: "PO-GS-6612", amount: 120000, status: "Approved" });

    const quote6 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[14].id, status: "Accepted", totalAmount: 185000, quoteNumber: "QT-2026-00006", version: 1, acceptedAt: new Date() }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote6.id, productId: seededProducts[0].id, quantity: 5, unitPrice: 25000, totalPrice: 125000 });
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote6.id, productId: seededProducts[4].id, quantity: 4, unitPrice: 15000, totalPrice: 60000 });
    await models.PurchaseOrder.create({ id: crypto.randomUUID(), quoteId: quote6.id, poNumber: "PO-ADNOC-5503", amount: 185000, status: "Verified" });

    const quote7 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[2].id, status: "Draft", totalAmount: 75000, quoteNumber: "QT-2026-00007", version: 2 }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote7.id, productId: seededProducts[5].id, quantity: 3, unitPrice: 18000, totalPrice: 54000 });
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote7.id, productId: seededProducts[1].id, quantity: 1, unitPrice: 8500, totalPrice: 8500 });

    const quote8 = await models.Quote.create({ id: crypto.randomUUID(), dealId: seededDeals[9].id, status: "Pending Approval", totalAmount: 88000, quoteNumber: "QT-2026-00008", version: 1 }) as any;
    await models.QuoteLineItem.create({ id: crypto.randomUUID(), quoteId: quote8.id, productId: seededProducts[0].id, quantity: 3, unitPrice: 25000, totalPrice: 75000 });
    await models.ApprovalRequest.create({ id: crypto.randomUUID(), targetId: quote8.id, type: "Quote", status: "Pending", requestedById: rep5.id, comments: "Needs 12% discount approval for strategic account." });

    console.log("Seeding Activities & Tasks...");
    const activityData = [
      { leadId: seededLeads[0].id, createdById: rep1.id, type: "task", outcome: "Send cloud suite proposal to Robert Chen at Alibaba", dueDate: new Date(Date.now() + 86400000), priority: "high", isCompleted: false },
      { leadId: seededLeads[1].id, createdById: rep1.id, type: "meeting", outcome: "Show advanced analytics presentation to Sarah Jenkins", isCompleted: true },
      { leadId: seededLeads[2].id, createdById: rep1.id, type: "call", outcome: "Follow up with SpaceX on data suite pricing", dueDate: new Date(Date.now() + 172800000), priority: "medium", isCompleted: false },
      { leadId: seededLeads[4].id, createdById: rep2.id, type: "note", outcome: "Walmart PO signed and submitted to finance team", isCompleted: true, pinned: true },
      { leadId: seededLeads[8].id, createdById: rep3.id, type: "task", outcome: "Schedule product demo with Infosys procurement", dueDate: new Date(Date.now() + 259200000), priority: "high", isCompleted: false },
      { leadId: seededLeads[12].id, createdById: rep5.id, type: "call", outcome: "Negotiate final pricing with Reliance Energy", dueDate: new Date(Date.now() + 86400000), priority: "high", isCompleted: false },
      { leadId: seededLeads[15].id, createdById: rep6.id, type: "note", outcome: "Goldman Sachs contract finalized, PO received", isCompleted: true, pinned: true },
      { leadId: seededLeads[19].id, createdById: rep8.id, type: "meeting", outcome: "ADNOC executive presentation and contract sign-off", isCompleted: true },
      { leadId: seededLeads[5].id, createdById: rep2.id, type: "email", outcome: "Sent revised pricing deck to Netflix Studios procurement team", isCompleted: true },
      { leadId: seededLeads[9].id, createdById: rep3.id, type: "call", outcome: "Initial discovery call with SAP SE — good fit for analytics module", isCompleted: true },
    ];
    for (const a of activityData) {
      await models.Activity.create({ id: crypto.randomUUID(), ...a });
    }

    console.log("Seeding KPI Targets...");
    const kpiData = [
      { userId: rep1.id, kpiName: "revenue", targetValue: 80000, period: "monthly" },
      { userId: rep1.id, kpiName: "deals_closed", targetValue: 5, period: "monthly" },
      { userId: rep2.id, kpiName: "revenue", targetValue: 120000, period: "monthly" },
      { userId: rep2.id, kpiName: "deals_closed", targetValue: 6, period: "monthly" },
      { userId: rep3.id, kpiName: "revenue", targetValue: 75000, period: "monthly" },
      { userId: rep4.id, kpiName: "revenue", targetValue: 60000, period: "monthly" },
      { userId: rep5.id, kpiName: "revenue", targetValue: 90000, period: "monthly" },
      { userId: rep6.id, kpiName: "revenue", targetValue: 100000, period: "monthly" },
      { userId: rep7.id, kpiName: "revenue", targetValue: 55000, period: "monthly" },
      { userId: rep8.id, kpiName: "revenue", targetValue: 150000, period: "monthly" },
    ];
    for (const k of kpiData) {
      await models.KpiTarget.create({ id: crypto.randomUUID(), ...k });
    }

    console.log("Seeding Approval Tiers...");
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Level 1 - Manager", thresholdValue: 50000, requiredRole: "sales_manager" });
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Level 2 - Director", thresholdValue: 150000, requiredRole: "admin" });
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Level 3 - Executive", thresholdValue: 9999999, requiredRole: "admin" });

    console.log("Seeding Assignment Rules...");
    await models.AssignmentRule.create({
      id: crypto.randomUUID(),
      criteria: JSON.stringify([{ field: "industry", operator: "equals", value: "Technology" }]),
      assignToId: rep1.id,
      priority: 1,
      isActive: true,
      ruleType: "Criteria"
    });
    await models.AssignmentRule.create({
      id: crypto.randomUUID(),
      criteria: JSON.stringify([{ field: "leadScore", operator: "greaterThan", value: 85 }]),
      assignToId: rep8.id,
      priority: 2,
      isActive: true,
      ruleType: "Criteria"
    });
    await models.AssignmentRule.create({
      id: crypto.randomUUID(),
      criteria: JSON.stringify([{ field: "industry", operator: "equals", value: "Automotive" }]),
      assignToId: rep2.id,
      priority: 3,
      isActive: true,
      ruleType: "Criteria"
    });

    console.log("Seeding complete successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  }
}

seedDatabase();

