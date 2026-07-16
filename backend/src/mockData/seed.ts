import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function seedDatabase() {
  try {
    await Database.createConnection();
    console.log("Syncing database...");
    console.log("Truncating data...");
    
    // Ordered to prevent foreign key constraint violations
    const tables = [
      'LeadReassignmentHistories', 'WebhookEvents', 'ScheduledEmails', 'Notifications', 
      'MessageTemplates', 'InvoiceLineItems', 'Invoices', 'Activities', 'AssignmentRules',
      'ApprovalRequests', 'PurchaseOrders', 'QuoteLineItems', 'PriceBookEntries',
      'Quotes', 'Deals', 'LeadStageHistories', 'PipelineStages', 'Leads', 'Users',
      'ConstructionItems', 'LineItems', 'Requirements', 'Customers', 'LeadSources'
    ];
    for (const table of tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}";`);
      } catch (e) {
        // Fallback for SQLite table name wrapping differences
        try {
          await sequelize.query(`DELETE FROM ${table};`);
        } catch (e2) {}
      }
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

    console.log("Seeding Lead Sources...");
    const sources = ["Website", "Referral", "Cold Call", "LinkedIn", "Social Media", "Trade Show"];
    const sourceRecords: any[] = [];
    for (const name of sources) {
      sourceRecords.push(await models.LeadSource.create({
        id: crypto.randomUUID(),
        name,
        isActive: true
      }));
    }

    console.log("Seeding Customers...");
    const companies = [
      { name: "Alibaba Global", primaryContactName: "Robert Chen", email: "robert@alibaba.com", phone: "1-555-0192", industry: "Technology" },
      { name: "Tesla Motors", primaryContactName: "Sarah Jenkins", email: "s.jenkins@tesla.com", phone: "1-555-0183", industry: "Automotive" },
      { name: "SpaceX Inc.", primaryContactName: "James Morgan", email: "jmorgan@spacex.com", phone: "1-555-0211", industry: "Aerospace" },
      { name: "Adobe Systems", primaryContactName: "Charlotte King", email: "cking@adobe.com", phone: "1-555-0198", industry: "Software" },
      { name: "Walmart Inc.", primaryContactName: "David Miller", email: "david.miller@walmart.com", phone: "1-555-0144", industry: "Retail" },
      { name: "Netflix Studios", primaryContactName: "Sophia Loren", email: "loren@netflix.com", phone: "1-555-0112", industry: "Entertainment" },
      { name: "Dunder Mifflin", primaryContactName: "Michael Scott", email: "mscott@dundermifflin.com", phone: "1-555-0166", industry: "Manufacturing" },
      { name: "BMW Group", primaryContactName: "Oliver Kahn", email: "kahn@bmw.de", phone: "1-555-0177", industry: "Automotive" },
      { name: "Infosys Ltd.", primaryContactName: "Priya Sharma", email: "p.sharma@infosys.com", phone: "1-555-0201", industry: "Technology" },
      { name: "SAP SE", primaryContactName: "Leo Fischer", email: "leo.f@sap.com", phone: "1-555-0215", industry: "Software" }
    ];
    const customerRecords: any[] = [];
    for (const c of companies) {
      customerRecords.push(await models.Customer.create({
        id: crypto.randomUUID(),
        ...c,
        address: "HQ Office Boulevard"
      }));
    }

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

    console.log("Seeding Requirements, LineItems, ConstructionItems (Face Contracting)...");
    
    // Top-Level Requirements
    const reqsData = [
      { name: "Prefab Structures", category: "Structural", description: "Portable cabins, site offices, and security units" },
      { name: "Site Utilities & MEP", category: "Utility", description: "Electrical wiring, air conditioning, and water systems" },
      { name: "Manpower Supply", category: "Manpower", description: "Skilled carpenters, electricians, and supervisors" },
      { name: "Material Trading", category: "Trading", description: "Supply of steel framing, plywood, and cement" },
      { name: "Equipment Rental", category: "Rental", description: "Generators, excavators, and dump trucks" }
    ];

    const reqRecords: any[] = [];
    for (const r of reqsData) {
      reqRecords.push(await models.Requirement.create({
        id: crypto.randomUUID(),
        ...r,
        isActive: true
      }));
    }

    // LineItems & ConstructionItems nested
    const prefabLines = [
      { name: "Portable Site Office", unit: "unit", description: "12m x 3m standard portable office cabin", defaultQuantity: 1 },
      { name: "Labor Accommodation Cabin", unit: "unit", description: "Standard bunk house cabin for 8 workers", defaultQuantity: 2 },
      { name: "Security Guard Cabin", unit: "unit", description: "2m x 2m guard house unit", defaultQuantity: 1 }
    ];
    for (const line of prefabLines) {
      const lineItem = await models.LineItem.create({
        id: crypto.randomUUID(),
        requirementId: reqRecords[0].id,
        ...line
      }) as any;

      // Construction Items BOM
      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "Heavy Steel Panel Frame",
        category: "material",
        unit: "pcs",
        quantityPerLineItem: 8,
        unitCost: 450,
        unitPrice: 585,
        isActive: true
      });
      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "1.5 Ton Split AC Unit",
        category: "equipment",
        unit: "nos",
        quantityPerLineItem: 2,
        unitCost: 320,
        unitPrice: 415,
        isActive: true
      });
      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "Cabin Assembly Labor",
        category: "labor",
        unit: "hrs",
        quantityPerLineItem: 24,
        unitCost: 15,
        unitPrice: 20,
        isActive: true
      });
    }

    // Site Utilities MEP
    const mepLines = [
      { name: "Electrical Distribution Panel Setup", unit: "set", description: "Main DB and distribution setup", defaultQuantity: 1 },
      { name: "AC Setup & Ventilation", unit: "nos", description: "AC unit mounts, exhausts, and cabling", defaultQuantity: 4 }
    ];
    for (const line of mepLines) {
      const lineItem = await models.LineItem.create({
        id: crypto.randomUUID(),
        requirementId: reqRecords[1].id,
        ...line
      }) as any;

      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "Copper Cabling Roll",
        category: "material",
        unit: "mtrs",
        quantityPerLineItem: 100,
        unitCost: 4,
        unitPrice: 5.5,
        isActive: true
      });
      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "MEP Engineer Labor",
        category: "labor",
        unit: "hrs",
        quantityPerLineItem: 8,
        unitCost: 35,
        unitPrice: 48,
        isActive: true
      });
    }

    // Manpower lines
    const manpowerLines = [
      { name: "Skilled Carpentry Team", unit: "man-day", description: "Experienced wood/framing carpenters", defaultQuantity: 10 },
      { name: "Industrial Electrician Crew", unit: "man-day", description: "Certified electrical installers", defaultQuantity: 5 }
    ];
    for (const line of manpowerLines) {
      const lineItem = await models.LineItem.create({
        id: crypto.randomUUID(),
        requirementId: reqRecords[2].id,
        ...line
      }) as any;

      await models.ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: "Daily Carpenter Shift",
        category: "labor",
        unit: "hrs",
        quantityPerLineItem: 8,
        unitCost: 12,
        unitPrice: 16,
        isActive: true
      });
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
      { firstName: "Robert", lastName: "Chen", company: "Alibaba Global", email: "robert@alibaba.com", phone: "1-555-0192", status: "Qualified", source: "Website", leadScore: 88, assignedToId: rep1.id, industry: "Technology", leadNumber: "LD-2026-00001", customerId: customerRecords[0].id },
      { firstName: "Sarah", lastName: "Jenkins", company: "Tesla Motors", email: "s.jenkins@tesla.com", phone: "1-555-0183", status: "Contacted", source: "Referral", leadScore: 95, assignedToId: rep1.id, industry: "Automotive", leadNumber: "LD-2026-00002", customerId: customerRecords[1].id },
      { firstName: "James", lastName: "Morgan", company: "SpaceX Inc.", email: "jmorgan@spacex.com", phone: "1-555-0211", status: "Qualified", source: "Cold Call", leadScore: 72, assignedToId: rep1.id, industry: "Aerospace", leadNumber: "LD-2026-00003", customerId: customerRecords[2].id },
      { firstName: "Charlotte", lastName: "King", company: "Adobe Systems", email: "cking@adobe.com", phone: "1-555-0198", status: "New", source: "LinkedIn", leadScore: 61, assignedToId: rep1.id, industry: "Software", leadNumber: "LD-2026-00004", customerId: customerRecords[3].id },
      { firstName: "David", lastName: "Miller", company: "Walmart Inc.", email: "david.miller@walmart.com", phone: "1-555-0144", status: "Qualified", source: "Cold Call", leadScore: 79, assignedToId: rep2.id, industry: "Retail", leadNumber: "LD-2026-00005", customerId: customerRecords[4].id },
      { firstName: "Sophia", lastName: "Loren", company: "Netflix Studios", email: "loren@netflix.com", phone: "1-555-0112", status: "Qualified", source: "Website", leadScore: 90, assignedToId: rep2.id, industry: "Entertainment", leadNumber: "LD-2026-00006", customerId: customerRecords[5].id },
      { firstName: "Michael", lastName: "Scott", company: "Dunder Mifflin", email: "mscott@dundermifflin.com", phone: "1-555-0166", status: "Contacted", source: "Trade Show", leadScore: 55, assignedToId: rep2.id, industry: "Manufacturing", leadNumber: "LD-2026-00007", customerId: customerRecords[6].id },
      { firstName: "Oliver", lastName: "Kahn", company: "BMW Group", email: "kahn@bmw.de", phone: "1-555-0177", status: "New", source: "Social Media", leadScore: 60, assignedToId: rep3.id, industry: "Automotive", leadNumber: "LD-2026-00008", customerId: customerRecords[7].id },
      { firstName: "Priya", lastName: "Sharma", company: "Infosys Ltd.", email: "p.sharma@infosys.com", phone: "1-555-0201", status: "Qualified", source: "Referral", leadScore: 85, assignedToId: rep3.id, industry: "Technology", leadNumber: "LD-2026-00009", customerId: customerRecords[8].id },
      { firstName: "Leo", lastName: "Fischer", company: "SAP SE", email: "leo.f@sap.com", phone: "1-555-0215", status: "Contacted", source: "Website", leadScore: 74, assignedToId: rep3.id, industry: "Software", leadNumber: "LD-2026-00010", customerId: customerRecords[9].id }
    ];

    const seededLeads: any[] = [];
    for (const l of leadsData) {
      seededLeads.push(await models.Lead.create({
        id: crypto.randomUUID(),
        ...l
      }));
    }

    console.log("Seeding Reassignment History...");
    await models.LeadReassignmentHistory.create({
      id: crypto.randomUUID(),
      leadId: seededLeads[0].id,
      oldAssignedToId: rep2.id,
      newAssignedToId: rep1.id,
      changedByUserId: admin.id,
      reason: "Initial assignment correction for tech account."
    });
    await models.LeadReassignmentHistory.create({
      id: crypto.randomUUID(),
      leadId: seededLeads[1].id,
      oldAssignedToId: rep3.id,
      newAssignedToId: rep1.id,
      changedByUserId: admin.id,
      reason: "Account representative workload balance."
    });

    console.log("Seeding Deals...");
    const dealsData = [
      { name: "Alibaba Prefab Site Setup", amount: 48000, stageId: stageProposal.id, ownerId: rep1.id, leadId: seededLeads[0].id, customerId: customerRecords[0].id },
      { name: "Tesla Factory Cabins", amount: 25000, stageId: stageDemo.id, ownerId: rep1.id, leadId: seededLeads[1].id, customerId: customerRecords[1].id },
      { name: "SpaceX Launchpad MEP Setup", amount: 75000, stageId: stageNegotiation.id, ownerId: rep1.id, leadId: seededLeads[2].id, customerId: customerRecords[2].id },
      { name: "Walmart Supply Depot Offices", amount: 150000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[4].id, customerId: customerRecords[4].id },
      { name: "Netflix Production Cabins", amount: 35000, stageId: stageWon.id, ownerId: rep2.id, leadId: seededLeads[5].id, customerId: customerRecords[5].id }
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

    console.log("Seeding Activities & Tasks...");
    const activityData = [
      { leadId: seededLeads[0].id, createdById: rep1.id, type: "task", outcome: "Send cloud suite proposal to Robert Chen at Alibaba", dueDate: new Date(Date.now() + 86400000), priority: "high", isCompleted: false },
      { leadId: seededLeads[1].id, createdById: rep1.id, type: "meeting", outcome: "Show advanced analytics presentation to Sarah Jenkins", isCompleted: true },
      { leadId: seededLeads[2].id, createdById: rep1.id, type: "call", outcome: "Follow up with SpaceX on data suite pricing", dueDate: new Date(Date.now() + 172800000), priority: "medium", isCompleted: false },
      { leadId: seededLeads[4].id, createdById: rep2.id, type: "note", outcome: "Walmart PO signed and submitted to finance team", isCompleted: true, pinned: true }
    ];
    for (const a of activityData) {
      await models.Activity.create({ id: crypto.randomUUID(), ...a });
    }

    console.log("Seeding KPI Targets...");
    const kpiData = [
      { userId: rep1.id, kpiName: "revenue", targetValue: 80000, period: "monthly" },
      { userId: rep1.id, kpiName: "deals_closed", targetValue: 5, period: "monthly" },
      { userId: rep2.id, kpiName: "revenue", targetValue: 120000, period: "monthly" }
    ];
    for (const k of kpiData) {
      await models.KpiTarget.create({ id: crypto.randomUUID(), ...k });
    }

    console.log("Seeding Approval Tiers...");
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Level 1 - Manager", thresholdValue: 50000, requiredRole: "sales_manager" });
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Level 2 - Director", thresholdValue: 150000, requiredRole: "admin" });

    console.log("Seeding Assignment Rules...");
    await models.AssignmentRule.create({
      id: crypto.randomUUID(),
      criteria: JSON.stringify([{ field: "industry", operator: "equals", value: "Technology" }]),
      assignToId: rep1.id,
      priority: 1,
      isActive: true,
      ruleType: "Criteria"
    });

    console.log("Seeding Message Templates...");
    const messageTemplatesData = [
      {
        name: "New Lead Acknowledgement",
        triggerEvent: "new_lead_acknowledgement",
        channel: "email",
        subject: "Thank you for your inquiry",
        body: "Hello {{lead_name}},\n\nThank you for reaching out to {{company_name}}! We have received your enquiry and our representative will contact you shortly.\n\nBest regards,\n{{company_name}} Team",
        isActive: true
      },
      {
        name: "Lead Assigned Intro",
        triggerEvent: "lead_assigned_intro",
        channel: "email",
        subject: "Introduction from your Account Manager",
        body: "Hello {{lead_name}},\n\nMy name is {{salesperson_name}} and I will be your dedicated account manager at {{company_name}}. I look forward to working with you!\n\nBest regards,\n{{salesperson_name}}",
        isActive: true
      },
      {
        name: "Quote Sent",
        triggerEvent: "quote_sent",
        channel: "email",
        subject: "Your Nexis CRM Quote is Ready",
        body: "Hello {{lead_name}},\n\nWe have prepared a new quotation for you totaling {{quote_value}}. Please review the attached details.\n\nBest regards,\n{{salesperson_name}}",
        isActive: true
      },
      {
        name: "Quote Expiry Reminder",
        triggerEvent: "quote_expiry_reminder",
        channel: "email",
        subject: "Action Required: Your quote is expiring soon",
        body: "Hello {{lead_name}},\n\nThis is a friendly reminder that your quotation of value {{quote_value}} is expiring soon. Let us know if you have any questions.\n\nBest regards,\n{{salesperson_name}}",
        isActive: true
      },
      {
        name: "PO Received Thank-You",
        triggerEvent: "po_received",
        channel: "email",
        subject: "We received your Purchase Order",
        body: "Hello {{lead_name}},\n\nWe have received your purchase order of {{quote_value}}. Thank you for your business! We will begin processing it immediately.\n\nBest regards,\n{{company_name}} Team",
        isActive: true
      },
      {
        name: "Deal Lost Feedback Request",
        triggerEvent: "deal_lost_feedback",
        channel: "email",
        subject: "Feedback Request",
        body: "Hello {{lead_name}},\n\nWe are sorry we couldn't partner with you on this project. We would appreciate if you could share any feedback to help us improve.\n\nBest regards,\n{{company_name}} Team",
        isActive: true
      },
      {
        name: "New Lead Assigned Alert",
        triggerEvent: "new_lead_assigned",
        channel: "email",
        subject: "New Lead Assignment",
        body: "Hi {{salesperson_name}},\n\nYou have been assigned a new lead: {{lead_name}} from {{company_name}}.",
        isActive: true
      },
      {
        name: "SLA Breach Escalation",
        triggerEvent: "sla_breach_escalation",
        channel: "email",
        subject: "SLA Breach Alert",
        body: "Warning: Lead {{lead_name}} assigned to {{salesperson_name}} has breached response SLA limit.",
        isActive: true
      },
      {
        name: "High Value Deal Won Broadcast",
        triggerEvent: "high_value_deal_won",
        channel: "email",
        subject: "Deal Closed Successfully!",
        body: "Celebration! {{salesperson_name}} has successfully closed a deal worth {{quote_value}} with {{company_name}}!",
        isActive: true
      },
      {
        name: "KPI Drop Alert",
        triggerEvent: "kpi_drop_alert",
        channel: "email",
        subject: "Performance Alert: KPI Drop",
        body: "Alert: Salesperson {{salesperson_name}}'s close rate has dropped below target threshold.",
        isActive: true
      }
    ];

    for (const temp of messageTemplatesData) {
      await models.MessageTemplate.create({
        id: crypto.randomUUID(),
        ...temp
      });
    }

    console.log("Seeding complete successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  }
}

seedDatabase();
