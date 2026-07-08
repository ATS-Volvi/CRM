import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function seedDatabase() {
  try {
    await Database.createConnection();
    console.log("Syncing database...");
    await sequelize.sync({ force: true });
    
    const models = sequelize.models;

    console.log("Seeding Users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const admin = await models.User.create({
      id: crypto.randomUUID(),
      name: "Sophia Martinez",
      email: "sophia@nexus.com",
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

    console.log("Seeding PriceBook Catalog...");
    const products = [
      { name: "Enterprise Cloud Suite Premium", sku: "SKU-CLOUD-ENT", category: "Enterprise VIP", unitPrice: 25000, minPrice: 19000, maxPrice: 35000 },
      { name: "Advanced Analytics Platform Addon", sku: "SKU-ANALYTICS-ADV", category: "Standard Tier", unitPrice: 8500, minPrice: 6000, maxPrice: 12000 },
      { name: "Priority Support Plan Pro (Annual)", sku: "SKU-SUPPORT-PRO", category: "Standard Tier", unitPrice: 5000, minPrice: 4000, maxPrice: 7000 },
      { name: "Nexus CRM Starter Package", sku: "SKU-CRM-START", category: "SME Starter", unitPrice: 2500, minPrice: 1800, maxPrice: 3500 },
      { name: "Global Security Integration Patch", sku: "SKU-SEC-INT", category: "Enterprise VIP", unitPrice: 15000, minPrice: 12000, maxPrice: 20000 }
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
    const stageWon = stageRecords[6];

    console.log("Seeding Leads...");
    const leadsData = [
      { firstName: "Robert", lastName: "Chen", company: "Alibaba Global", email: "robert@alibaba.com", phone: "1-555-0192", status: "Qualified", source: "Website", leadScore: 88, assignedToId: rep1.id, industry: "Technology" },
      { firstName: "Sarah", lastName: "Jenkins", company: "Tesla Motors", email: "s.jenkins@tesla.com", phone: "1-555-0183", status: "Contacted", source: "Referral", leadScore: 95, assignedToId: rep1.id, industry: "Automotive" },
      { firstName: "David", lastName: "Miller", company: "Walmart Inc.", email: "david.miller@walmart.com", phone: "1-555-0144", status: "New", source: "Cold Call", leadScore: 45, assignedToId: rep2.id, industry: "Retail" },
      { firstName: "Sophia", lastName: "Loren", company: "Netflix Studios", email: "loren@netflix.com", phone: "1-555-0112", status: "Qualified", source: "Website", leadScore: 90, assignedToId: rep2.id, industry: "Entertainment" },
      { firstName: "Oliver", lastName: "Kahn", company: "BMW Group", email: "kahn@bmw.de", phone: "1-555-0177", status: "New", source: "Social Media", leadScore: 60, assignedToId: admin.id, industry: "Automotive" }
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
      { name: "Walmart CRM Rollout", amount: 150000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[2].id },
      { name: "Netflix Analytics Sync", amount: 35000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[3].id }
    ];

    const seededDeals: any[] = [];
    for (const d of dealsData) {
      seededDeals.push(await models.Deal.create({
        id: crypto.randomUUID(),
        ...d
      }));
    }

    console.log("Seeding Quotes & Purchase Orders...");
    // 1. Walmart Won Deal PO
    const quote1 = await models.Quote.create({
      id: crypto.randomUUID(),
      dealId: seededDeals[2].id,
      status: "Accepted",
      totalAmount: 150000,
      quoteNumber: "QT-2026-00001",
      version: 1,
      acceptedAt: new Date()
    }) as any;
    
    await models.QuoteLineItem.create({
      id: crypto.randomUUID(),
      quoteId: quote1.id,
      productId: seededProducts[0].id,
      quantity: 6,
      unitPrice: 25000,
      totalPrice: 150000
    });

    await models.PurchaseOrder.create({
      id: crypto.randomUUID(),
      quoteId: quote1.id,
      poNumber: "PO-WALMART-9921",
      amount: 150000,
      status: "Verified"
    });

    // 2. Netflix Won Deal PO
    const quote2 = await models.Quote.create({
      id: crypto.randomUUID(),
      dealId: seededDeals[3].id,
      status: "Accepted",
      totalAmount: 35000,
      quoteNumber: "QT-2026-00002",
      version: 1,
      acceptedAt: new Date()
    }) as any;

    await models.QuoteLineItem.create({
      id: crypto.randomUUID(),
      quoteId: quote2.id,
      productId: seededProducts[2].id,
      quantity: 7,
      unitPrice: 5000,
      totalPrice: 35000
    });

    await models.PurchaseOrder.create({
      id: crypto.randomUUID(),
      quoteId: quote2.id,
      poNumber: "PO-NETFLIX-8842",
      amount: 35000,
      status: "Verified"
    });

    // 3. Alibaba Proposal Quote
    const quote3 = await models.Quote.create({
      id: crypto.randomUUID(),
      dealId: seededDeals[0].id,
      status: "Sent",
      totalAmount: 48000,
      quoteNumber: "QT-2026-00003",
      version: 1,
      sentAt: new Date()
    }) as any;

    await models.QuoteLineItem.create({
      id: crypto.randomUUID(),
      quoteId: quote3.id,
      productId: seededProducts[1].id,
      quantity: 4,
      unitPrice: 12000, // custom price
      totalPrice: 48000
    });

    console.log("Seeding Activities & Tasks...");
    await models.Activity.create({
      id: crypto.randomUUID(),
      leadId: seededLeads[0].id,
      createdById: rep1.id,
      type: "task",
      content: "Send cloud suite proposal details to Robert",
      dueDate: new Date(Date.now() + 86400000), // tomorrow
      priority: "high",
      isCompleted: false
    });

    await models.Activity.create({
      id: crypto.randomUUID(),
      leadId: seededLeads[1].id,
      createdById: rep1.id,
      type: "meeting",
      content: "Show advanced analytics presentation to Sarah",
      isCompleted: true
    });

    console.log("Seeding KPI Targets...");
    await models.KpiTarget.create({
      id: crypto.randomUUID(),
      userId: rep1.id,
      kpiName: "revenue",
      targetValue: 80000,
      period: "monthly"
    });

    await models.KpiTarget.create({
      id: crypto.randomUUID(),
      userId: rep2.id,
      kpiName: "revenue",
      targetValue: 120000,
      period: "monthly"
    });

    console.log("Seeding complete successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  }
}

seedDatabase();
