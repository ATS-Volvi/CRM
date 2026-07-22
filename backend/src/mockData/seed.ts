import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Helper function to pick random element from array
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
// Helper function to pick random number between min and max
const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
// Helper function to generate realistic dates relative to now
const daysAgo = (days: number): Date => new Date(Date.now() - days * 86400000);
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 86400000);

async function seedEnterpriseDatabase() {
  try {
    await Database.createConnection();
    console.log("Syncing database schema cleanly (force: true)...");
    await sequelize.query("PRAGMA foreign_keys = OFF;");
    await sequelize.sync({ force: true });
    await sequelize.query("PRAGMA foreign_keys = ON;");
    console.log("Truncating data...");
    
    // Clear all existing data in safe order
    const tables = [
      'LeadReassignmentHistories', 'WebhookEvents', 'ScheduledEmails', 'Notifications', 
      'MessageTemplates', 'InvoiceLineItems', 'Invoices', 'Activities', 'AssignmentRules',
      'ApprovalRequests', 'PurchaseOrders', 'QuoteLineItems', 'PriceBookEntries',
      'Quotes', 'Deals', 'LeadStageHistories', 'PipelineStages', 'Leads', 'Users',
      'ConstructionItems', 'LineItems', 'Requirements', 'Customers', 'LeadSources',
      'Tasks', 'CallLogs', 'Documents', 'Meetings', 'EmailMessages', 'KpiTargets',
      'KpiTargetHistories', 'KpiMasters', 'ApprovalTiers'
    ];

    for (const table of tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}";`);
      } catch (e) {
        try {
          await sequelize.query(`DELETE FROM ${table};`);
        } catch (e2) {}
      }
    }
    
    const models = sequelize.models;
    const hashedPassword = await bcrypt.hash("password123", 10);

    // ==========================================
    // 1. MASTER DATA: Lead Sources & Categories & PriceBook & BOM
    // ==========================================
    console.log("Seeding Master Data & Reference Sets...");

    const sourceNames = [
      "Website Organic", "LinkedIn Outreach", "Cold Inbound", "Trade Show Expo 2025",
      "Executive Referral", "Google Search Ads", "Webinar Series", "Partner Referral",
      "G2 Crowd Lead", "Direct Mail Campaign"
    ];
    const seededSources: any[] = [];
    for (const name of sourceNames) {
      seededSources.push(await models.LeadSource.create({
        id: crypto.randomUUID(),
        name,
        isActive: true
      }));
    }

    // Pipeline Stages
    const stageNames = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"];
    const stageProbabilities = [10, 20, 40, 60, 75, 90, 100, 0];
    const seededStages: any[] = [];
    for (let i = 0; i < stageNames.length; i++) {
      seededStages.push(await models.PipelineStage.create({
        id: crypto.randomUUID(),
        name: stageNames[i],
        order: i + 1,
        probability: stageProbabilities[i]
      }));
    }

    // Products / PriceBook Entries
    const productsData = [
      { sku: "NEX-ENT-001", name: "Enterprise CRM Platform Core (Annual)", category: "Software Licensing", unitPrice: 48000, description: "Unlimited user license with multi-org governance & dedicated infrastructure." },
      { sku: "NEX-CLD-002", name: "Cloud Infrastructure & Data Lake Node", category: "Cloud Services", unitPrice: 24000, description: "Managed AWS data warehouse sync with 99.99% uptime SLA." },
      { sku: "NEX-AI-003", name: "Nexus Predictive AI & Forecasting Module", category: "AI Addons", unitPrice: 18000, description: "Machine learning revenue prediction engine and automated lead scoring." },
      { sku: "NEX-INT-004", name: "Custom ERP & SAP Integration Suite", category: "Professional Services", unitPrice: 35000, description: "Two-way bi-directional synchronization for financial ledger & stock items." },
      { sku: "NEX-SEC-005", name: "SOC2 & HIPAA Compliance Security Enclave", category: "Security", unitPrice: 15000, description: "End-to-end payload encryption with audit-grade access controls." },
      { sku: "NEX-SUP-006", name: "24/7 Dedicated Account Director & Platinum SLA", category: "Support Services", unitPrice: 12000, description: "15-minute response window, monthly executive review, custom reporting." },
      { sku: "NEX-TRN-007", name: "On-Site Enterprise Training & Change Mgmt", category: "Professional Services", unitPrice: 8500, description: "4-day immersive workshop for sales ops, reps, and executives." },
      { sku: "NEX-MOB-008", name: "Mobile Field Force Geolocation & Dispatch", category: "Mobile Addons", unitPrice: 9500, description: "Real-time rep location tracking, offline quotes, and signature capture." },
      { sku: "NEX-ANA-009", name: "Executive Business Intelligence Suite", category: "Analytics", unitPrice: 14000, description: "PowerBI and Tableau direct connectors with custom executive dashboards." },
      { sku: "NEX-MKT-010", name: "Omnichannel Marketing Automation Hub", category: "Marketing", unitPrice: 22000, description: "Email nurture workflows, WhatsApp broadcast API, and SMS tracking." }
    ];
    const seededProducts: any[] = [];
    for (const p of productsData) {
      seededProducts.push(await models.PriceBookEntry.create({
        id: crypto.randomUUID(),
        ...p,
        minPrice: p.unitPrice * 0.85,
        maxPrice: p.unitPrice * 1.15
      }));
    }

    // Requirements & BOM Line Items
    const req1 = await models.Requirement.create({ id: crypto.randomUUID(), name: "Standard Enterprise Deployment", category: "Deployment", description: "Standard turnkey setup for mid-market enterprise clients." }) as any;
    const req2 = await models.Requirement.create({ id: crypto.randomUUID(), name: "High-Security Defense & Healthcare Spec", category: "Security", description: "Dedicated isolated cluster with encryption compliance." }) as any;
    
    const lineItem1 = await models.LineItem.create({ id: crypto.randomUUID(), requirementId: req1.id, name: "Core Server Provisioning", unit: "Instance", defaultQuantity: 1 }) as any;
    const lineItem2 = await models.LineItem.create({ id: crypto.randomUUID(), requirementId: req1.id, name: "User Onboarding & License Pack", unit: "User", defaultQuantity: 50 }) as any;

    await models.ConstructionItem.create({ id: crypto.randomUUID(), lineItemId: lineItem1.id, name: "AWS EC2 r6i.4xlarge Node", category: "equipment", unit: "Hours", quantityPerLineItem: 720, unitCost: 1.20, unitPrice: 2.50 });
    await models.ConstructionItem.create({ id: crypto.randomUUID(), lineItemId: lineItem1.id, name: "DevOps Integration Lead", category: "labor", unit: "Hours", quantityPerLineItem: 40, unitCost: 80.00, unitPrice: 150.00 });

    // KPI Masters
    const kpiMasters = [
      { name: "Monthly Revenue Target", category: "Sales", targetValue: 150000, frequency: "monthly", weightage: 30 },
      { name: "Quarterly Closed Deals Count", category: "Sales", targetValue: 12, frequency: "quarterly", weightage: 25 },
      { name: "Lead Response Time (< 2 Hours)", category: "Activity", targetValue: 95, frequency: "monthly", weightage: 20 },
      { name: "Customer Retention & Renewal Rate", category: "Account Mgmt", targetValue: 92, frequency: "quarterly", weightage: 25 }
    ];
    for (const km of kpiMasters) {
      await models.KpiMaster.create({ id: crypto.randomUUID(), ...km });
    }

    // ==========================================
    // 2. USERS: 25 Sales Representatives & Admins
    // ==========================================
    console.log("Seeding 25 Sales Representatives & Managers...");

    const admin = await models.User.create({
      id: crypto.randomUUID(),
      name: "Sophia Martinez",
      email: "admin@nexus.com",
      password: hashedPassword,
      role: "admin",
      department: "Executive Management",
      territory: "Global Headquarters",
      isAvailable: true,
      maxOpenLeads: 100
    }) as any;

    const manager1 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Marcus Vance",
      email: "marcus@nexus.com",
      password: hashedPassword,
      role: "sales_manager",
      department: "North America Sales",
      territory: "North America",
      isAvailable: true,
      maxOpenLeads: 50
    }) as any;

    const manager2 = await models.User.create({
      id: crypto.randomUUID(),
      name: "Helena Rostova",
      email: "helena@nexus.com",
      password: hashedPassword,
      role: "sales_manager",
      department: "EMEA & APAC Sales",
      territory: "EMEA / APAC",
      isAvailable: true,
      maxOpenLeads: 50
    }) as any;

    const repNames = [
      { name: "Liam Carter", region: "North America - East", mgr: manager1.id },
      { name: "Emma Watson", region: "North America - West", mgr: manager1.id },
      { name: "Olivia Davis", region: "North America - Central", mgr: manager1.id },
      { name: "Ethan Hunt", region: "North America - East", mgr: manager1.id },
      { name: "Isabella Rose", region: "North America - West", mgr: manager1.id },
      { name: "Noah Bennett", region: "EMEA - UK & Ireland", mgr: manager2.id },
      { name: "Ava Sterling", region: "EMEA - DACH Region", mgr: manager2.id },
      { name: "Jackson Pollock", region: "EMEA - Southern Europe", mgr: manager2.id },
      { name: "Sophia Chen", region: "APAC - Greater China", mgr: manager2.id },
      { name: "Lucas Tanaka", region: "APAC - Japan & Korea", mgr: manager2.id },
      { name: "Mia Al-Mansoor", region: "EMEA - Middle East", mgr: manager2.id },
      { name: "Benjamin Thorne", region: "North America - Canada", mgr: manager1.id },
      { name: "Charlotte DuBois", region: "EMEA - France & Benelux", mgr: manager2.id },
      { name: "Amelia Rodriguez", region: "LATAM - Brazil & Mexico", mgr: manager1.id },
      { name: "Harper Vance", region: "North America - West", mgr: manager1.id },
      { name: "Evelyn Zhang", region: "APAC - Southeast Asia", mgr: manager2.id },
      { name: "Daniel Kim", region: "APAC - Australia & NZ", mgr: manager2.id },
      { name: "Alexander Wright", region: "North America - Central", mgr: manager1.id },
      { name: "Scarlett Johansson", region: "North America - East", mgr: manager1.id },
      { name: "Henry Cavill", region: "EMEA - Nordics", mgr: manager2.id },
      { name: "Grace Kelly", region: "North America - South", mgr: manager1.id },
      { name: "Sebastian Stan", region: "EMEA - Eastern Europe", mgr: manager2.id },
      { name: "Chloe O'Connor", region: "EMEA - UK & Ireland", mgr: manager2.id }
    ];

    const seededUsers: any[] = [admin, manager1, manager2];
    for (const r of repNames) {
      const email = r.name.toLowerCase().replace(/[^a-z]/g, "") + "@nexus.com";
      const repUser = await models.User.create({
        id: crypto.randomUUID(),
        name: r.name,
        email,
        password: hashedPassword,
        role: "sales_rep",
        department: "Direct Enterprise Sales",
        territory: r.region,
        managerId: r.mgr,
        isAvailable: true,
        maxOpenLeads: 35
      }) as any;
      seededUsers.push(repUser);

      // KPI target for each rep
      await models.KpiTarget.create({
        id: crypto.randomUUID(),
        salespersonId: repUser.id,
        kpiName: "Monthly Revenue Target",
        targetValue: randomInt(80000, 160000),
        currentValue: randomInt(60000, 180000),
        frequency: "monthly",
        weightage: 40,
        status: "Active"
      });
    }

    const repsOnly = seededUsers.filter(u => u.role === "sales_rep");

    // ==========================================
    // 3. COMPANIES: 100 Enterprise Accounts
    // ==========================================
    console.log("Seeding 100 Enterprise Companies across key industries...");

    const industryList = ["Manufacturing", "Automotive", "Pharmaceutical", "Food & Beverage", "FMCG", "Logistics", "Construction", "Technology", "Retail", "Healthcare"];
    const cityList = [
      { city: "New York", country: "United States" }, { city: "San Francisco", country: "United States" },
      { city: "Chicago", country: "United States" }, { city: "London", country: "United Kingdom" },
      { city: "Frankfurt", country: "Germany" }, { city: "Tokyo", country: "Japan" },
      { city: "Toronto", country: "Canada" }, { city: "Paris", country: "France" },
      { city: "Singapore", country: "Singapore" }, { city: "Sydney", country: "Australia" }
    ];

    const companyPrefixes = [
      "Apex", "Vanguard", "Genesis", "Horizon", "Pinnacle", "Titan", "Quantum", "Nexus", "Starlight", "Beacon",
      "Sterling", "Synergy", "Velocity", "Omni", "Prism", "Matrix", "Helios", "Aegis", "Dynamic", "Global",
      "Infinitum", "Orion", "Equinox", "Paramount", "Crestview", "Summit", "Astral", "Veritas", "Ironclad", "Catalyst"
    ];
    const companySuffixes = [
      "Technologies", "Logistics", "Pharmaceuticals", "Solutions", "Industries", "Holdings", "Global",
      "Networks", "Systems", "Manufacturing", "Health", "Energy", "Financial", "Retail", "Robotics"
    ];

    const seededCompanies: any[] = [];

    for (let i = 0; i < 100; i++) {
      const prefix = companyPrefixes[i % companyPrefixes.length];
      const suffix = companySuffixes[(i * 3 + 2) % companySuffixes.length];
      const compName = `${prefix} ${suffix} ${i > 30 ? "Group" : "Inc."}`;
      const ind = industryList[i % industryList.length];
      const loc = cityList[i % cityList.length];
      const owner = pick(repsOnly);

      const customerRecord = await models.Customer.create({
        id: crypto.randomUUID(),
        name: compName,
        industry: ind,
        address: `${randomInt(100, 9999)} Business Avenue, Suite ${randomInt(100, 800)}, ${loc.city}, ${loc.country}`,
        primaryContactName: `Contact ${i + 1}`,
        email: `info@${compName.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        phone: `+1 (${randomInt(200, 999)}) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
      }) as any;

      seededCompanies.push({
        ...customerRecord.toJSON(),
        ownerId: owner.id,
        revenue: randomInt(5, 450) * 1000000,
        employees: randomInt(250, 12000)
      });
    }

    // ==========================================
    // 4. CUSTOMERS / CONTACTS: 250 Contacts
    // ==========================================
    console.log("Seeding 250 Enterprise Contacts linked to Companies...");

    const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Donald", "Sandra", "Mark", "Ashley", "Paul", "Kimberly", "Steven", "Emily", "Andrew", "Donna", "Kenneth", "Michelle"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"];
    const jobTitles = ["Chief Technology Officer", "VP of Global Supply Chain", "Director of Procurement", "VP of Information Technology", "Chief Operating Officer", "Director of Enterprise Infrastructure", "Head of Digital Transformation", "Senior Purchasing Manager", "Director of Business Systems", "Chief Financial Officer"];

    const seededContacts: any[] = [];

    for (let i = 0; i < 250; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 7) % lastNames.length];
      const company = seededCompanies[i % seededCompanies.length];
      const title = jobTitles[i % jobTitles.length];
      const contactEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}@${company.name.toLowerCase().replace(/[^a-z]/g, "")}.com`;

      seededContacts.push({
        id: crypto.randomUUID(),
        fullName: `${fn} ${ln}`,
        companyId: company.id,
        companyName: company.name,
        email: contactEmail,
        phone: `+1 (${randomInt(200, 999)}) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
        jobTitle: title,
        ownerId: company.ownerId,
        industry: company.industry
      });
    }

    // Update customer primaryContactName with actual full names
    for (let i = 0; i < seededCompanies.length; i++) {
      const contact = seededContacts[i];
      await models.Customer.update(
        { primaryContactName: contact.fullName, email: contact.email, phone: contact.phone },
        { where: { id: seededCompanies[i].id } }
      );
    }

    // ==========================================
    // 5. LEADS: 500 Enterprise Sales Leads
    // ==========================================
    console.log("Seeding 500 Enterprise Leads with detailed tracking history...");

    const leadStatuses = ["New", "Contacted", "Qualified", "Meeting Scheduled", "Proposal Sent", "Unqualified"];
    const campaigns = ["Q1 Enterprise Tech Expo", "Cloud Transformation Webinar", "Executive CXO Summit", "Inbound Google Organic", "LinkedIn Account Based Marketing", "Direct Executive Outreach"];

    const seededLeads: any[] = [];

    for (let i = 0; i < 500; i++) {
      const fn = firstNames[(i * 3 + 1) % firstNames.length];
      const ln = lastNames[(i * 5 + 3) % lastNames.length];
      const comp = seededCompanies[i % seededCompanies.length];
      const rep = pick(repsOnly);
      const src = pick(seededSources);
      const status = leadStatuses[i % leadStatuses.length];
      const created = daysAgo(randomInt(5, 365));

      const leadRecord = await models.Lead.create({
        id: crypto.randomUUID(),
        leadNumber: `LD-2025-${String(i + 1001).padStart(5, '0')}`,
        firstName: fn,
        lastName: ln,
        company: comp.name,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${comp.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        phone: `+1 (${randomInt(200, 999)}) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
        status: status === "Meeting Scheduled" ? "Contacted" : status === "Proposal Sent" ? "Qualified" : status,
        source: src.name,
        industry: comp.industry,
        assignedToId: rep.id,
        leadScore: randomInt(35, 98),
        campaign: pick(campaigns),
        budgetRange: `$${randomInt(50, 500)}k`,
        isStrategic: i % 7 === 0,
        customerId: comp.id,
        createdAt: created,
        updatedAt: daysAgo(randomInt(0, 4))
      }) as any;

      seededLeads.push(leadRecord);
    }

    // ==========================================
    // 6. DEALS & PIPELINE: 200 Deals Across All 8 Stages
    // ==========================================
    console.log("Seeding Deals & Pipeline across all 8 stages...");

    const dealNames = [
      "Enterprise Cloud Migration & Data Suite", "Global Multi-Site ERP Integration", "Predictive Analytics & AI Deployment",
      "Automated Supply Chain Orchestration", "SOC2 Compliance & Infrastructure Hardening", "Field Operations Mobile Suite",
      "Executive Business Intelligence Hub", "Omnichannel Customer Experience Engine", "Annual SaaS Platform Expansion",
      "Next-Gen Digital Transformation Deal"
    ];

    const seededDeals: any[] = [];

    for (let i = 0; i < 200; i++) {
      const comp = seededCompanies[i % seededCompanies.length];
      const lead = seededLeads[i % seededLeads.length];
      const stage = seededStages[i % seededStages.length];
      const rep = pick(repsOnly);
      const amount = randomInt(40, 450) * 1000;
      const created = daysAgo(randomInt(10, 300));
      const expectedClose = stage.name === "Won" ? daysAgo(randomInt(5, 180)) : daysFromNow(randomInt(10, 90));

      const dealRecord = await models.Deal.create({
        id: crypto.randomUUID(),
        name: `${comp.name} - ${pick(dealNames)}`,
        amount,
        expectedCloseDate: expectedClose,
        stageId: stage.id,
        leadId: lead.id,
        customerId: comp.id,
        ownerId: rep.id,
        probability: stage.probability,
        lossReason: stage.name === "Lost" ? pick(["Budget frozen for Q3", "Selected incumbent provider", "Project postponed to next fiscal year", "Price too high for current scope"]) : null,
        competitors: stage.name === "Negotiation" || stage.name === "Lost" ? pick(["Salesforce", "Microsoft Dynamics 365", "Oracle NetSuite", "SAP Customer Experience"]) : null,
        createdAt: created,
        updatedAt: daysAgo(randomInt(0, 3))
      }) as any;

      seededDeals.push(dealRecord);
    }

    // ==========================================
    // 7. QUOTATIONS & PURCHASE ORDERS: 150 Quotes
    // ==========================================
    console.log("Seeding 150 Quotations & Purchase Orders with detailed Line Items...");

    const quoteStatuses = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];

    for (let i = 0; i < 150; i++) {
      const deal = seededDeals[i % seededDeals.length];
      const status = quoteStatuses[i % quoteStatuses.length];
      const created = daysAgo(randomInt(5, 200));
      const expDate = daysFromNow(randomInt(15, 60));

      const quoteNum = `QT-2025-${String(i + 5001).padStart(5, '0')}`;
      const prod1 = seededProducts[i % seededProducts.length];
      const prod2 = seededProducts[(i + 3) % seededProducts.length];
      const qty1 = randomInt(1, 4);
      const qty2 = randomInt(2, 10);
      const total = (prod1.unitPrice * qty1) + (prod2.unitPrice * qty2);

      const quoteRecord = await models.Quote.create({
        id: crypto.randomUUID(),
        dealId: deal.id,
        quoteNumber: quoteNum,
        status,
        totalAmount: total,
        expirationDate: expDate,
        version: 1,
        sentAt: status !== "Draft" ? daysAgo(randomInt(3, 30)) : null,
        viewedAt: status === "Accepted" || status === "Rejected" ? daysAgo(randomInt(2, 25)) : null,
        acceptedAt: status === "Accepted" ? daysAgo(randomInt(1, 20)) : null,
        createdAt: created
      }) as any;

      // Line items
      await models.QuoteLineItem.create({
        id: crypto.randomUUID(),
        quoteId: quoteRecord.id,
        productId: prod1.id,
        quantity: qty1,
        unitPrice: prod1.unitPrice,
        totalPrice: prod1.unitPrice * qty1,
        isOptional: false
      });

      await models.QuoteLineItem.create({
        id: crypto.randomUUID(),
        quoteId: quoteRecord.id,
        productId: prod2.id,
        quantity: qty2,
        unitPrice: prod2.unitPrice,
        totalPrice: prod2.unitPrice * qty2,
        isOptional: true
      });

      // Generate PO for Accepted quotes
      if (status === "Accepted") {
        const poNum = `PO-${deal.name.substring(0, 3).toUpperCase()}-${randomInt(1000, 9999)}`;
        await models.PurchaseOrder.create({
          id: crypto.randomUUID(),
          quoteId: quoteRecord.id,
          poNumber: poNum,
          amount: total,
          status: "Verified",
          generatedDate: quoteRecord.acceptedAt || new Date()
        });

        // Generate Invoice for Accepted quote POs
        const invRecord = await models.Invoice.create({
          id: crypto.randomUUID(),
          quoteId: quoteRecord.id,
          status: i % 2 === 0 ? "Paid" : "Sent",
          totalAmount: total,
          dueDate: daysFromNow(30),
          notes: `Standard NET 30 Invoice for ${deal.name}`
        }) as any;

        await models.InvoiceLineItem.create({
          id: crypto.randomUUID(),
          invoiceId: invRecord.id,
          productId: prod1.id,
          quantity: qty1,
          unitPrice: prod1.unitPrice,
          totalPrice: prod1.unitPrice * qty1
        });
      }
    }

    // ==========================================
    // 8. ACTIVITIES, TASKS, CALLS, MEETINGS, EMAILS (500 each)
    // ==========================================
    console.log("Seeding 500 Tasks, 250 Meetings, 500 Call Logs, 500 Emails & Timeline Activities...");

    const taskTitles = [
      "Send updated technical Architecture diagram", "Follow up regarding SOC2 security audit questions",
      "Schedule Q3 executive review demo", "Send customized pricing grid proposal",
      "Review contract legal redlines with legal council", "Prepare ROI calculation sheet for CFO",
      "Confirm technical proof of concept scope", "Send customer referral case studies"
    ];

    const meetingTitles = [
      "Q3 Architecture & Security Deep Dive", "Executive Product Demonstration & Roadmap Review",
      "Commercial Terms & Pricing Negotiation", "Technical Discovery & Requirement Gathering",
      "Partner Solution Sync & Integration Workshop", "Post-Deployment Success Review"
    ];

    const callOutcomes = ["Connected - High Interest", "Left Voicemail", "Connected - Requested Follow up", "Connected - Objection on Price", "Connected - Demo Scheduled"];
    const callNotes = [
      "Discussed enterprise scaling options. Client requested breakdown of implementation timeline.",
      "Spoke with Director of IT. Confirmed budget is approved for Q3 rollout.",
      "Outlined API integration requirements. Client will send sample payload data.",
      "Reviewed security compliance checklist. All requirements met."
    ];

    const emailSubjects = [
      "Follow up: Nexus CRM Platform Architecture Overview", "Proposal & Commercial Offer for Enterprise Suite",
      "Thank you for joining our Technical Product Demo", "Revised Quote with Custom ERP Integration SLA",
      "Executive Summary & Business ROI Breakdown"
    ];

    for (let i = 0; i < 500; i++) {
      const lead = seededLeads[i % seededLeads.length];
      const comp = seededCompanies[i % seededCompanies.length];
      const rep = pick(repsOnly);
      const created = daysAgo(randomInt(1, 180));

      // Task
      await models.Task.create({
        id: crypto.randomUUID(),
        title: `${pick(taskTitles)} - ${comp.name}`,
        description: `Follow up with ${lead.firstName} ${lead.lastName} regarding enterprise deployment timelines.`,
        priority: pick(["High", "Medium", "Low"]),
        status: pick(["Completed", "Pending", "Overdue"]),
        dueDate: i % 3 === 0 ? daysAgo(randomInt(1, 10)) : daysFromNow(randomInt(1, 14)),
        ownerId: rep.id,
        leadId: lead.id,
        customerId: comp.id,
        createdAt: created
      });

      // Call Log
      await models.CallLog.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        customerId: comp.id,
        userId: rep.id,
        direction: i % 4 === 0 ? "Inbound" : "Outbound",
        durationSeconds: randomInt(120, 1800),
        outcome: pick(callOutcomes),
        notes: pick(callNotes),
        followUpDate: daysFromNow(randomInt(2, 10)),
        createdAt: created
      });

      // Email Message
      await models.EmailMessage.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        customerId: comp.id,
        senderId: rep.id,
        toEmail: lead.email,
        subject: `${pick(emailSubjects)} - ${comp.name}`,
        body: `Dear ${lead.firstName},\n\nThank you for taking the time to speak with our team. As discussed, please find attached the details regarding ${lead.company}'s requirements.\n\nBest regards,\n${rep.name}\nNexus Enterprise Suite`,
        status: "Sent",
        openedAt: i % 2 === 0 ? daysAgo(randomInt(0, 10)) : null,
        clickedAt: i % 3 === 0 ? daysAgo(randomInt(0, 5)) : null,
        createdAt: created
      });

      // Activity Timeline Entry
      await models.Activity.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        createdById: rep.id,
        type: pick(["call", "email", "meeting", "task", "note", "stage_change"]),
        outcome: `${pick(taskTitles)} for ${comp.name}`,
        notes: pick(callNotes),
        isCompleted: true,
        createdAt: created
      });

      // Meetings (250 items, every 2nd iteration)
      if (i % 2 === 0) {
        await models.Meeting.create({
          id: crypto.randomUUID(),
          title: `${pick(meetingTitles)} w/ ${comp.name}`,
          date: created.toISOString().split("T")[0],
          time: `${randomInt(9, 16)}:00 EST`,
          attendees: `${lead.email}, ${rep.email}`,
          location: "Microsoft Teams Video Enclave",
          videoLink: `https://teams.microsoft.com/l/meetup-join/nexus-${i}`,
          agenda: `1. Platform overview\n2. Security & SOC2 Review\n3. Commercial pricing discussion`,
          notes: pick(callNotes),
          outcome: pick(callOutcomes),
          leadId: lead.id,
          customerId: comp.id,
          organizerId: rep.id,
          createdAt: created
        });
      }
    }

    // ==========================================
    // 9. NOTIFICATIONS & APPROVALS
    // ==========================================
    console.log("Seeding realistic System Notifications & Executive Approvals...");

    const notifTitles = [
      "High Value Lead Assigned", "Executive Meeting Scheduled in 30 Mins",
      "Task Overdue Alert", "Quotation Accepted by Client", "PO Verified by Finance Team",
      "Monthly Revenue Target Milestone Achieved"
    ];

    for (let i = 0; i < 40; i++) {
      const rep = pick(repsOnly);
      await models.Notification.create({
        id: crypto.randomUUID(),
        userId: rep.id,
        type: pick(["lead_assigned", "meeting_reminder", "quote_approved", "target_achieved"]),
        title: pick(notifTitles),
        message: `System notification regarding active enterprise pipeline account ${seededCompanies[i % seededCompanies.length].name}.`,
        isRead: i % 3 === 0,
        createdAt: daysAgo(randomInt(0, 10))
      });
    }

    // Approval Tiers & Requests
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Standard Discount (< 15%)", thresholdValue: 25000, requiredRole: "sales_manager" });
    await models.ApprovalTier.create({ id: crypto.randomUUID(), name: "Executive VP Discount (> 15%)", thresholdValue: 100000, requiredRole: "admin" });

    for (let i = 0; i < 15; i++) {
      const deal = seededDeals[i];
      const rep = pick(repsOnly);
      await models.ApprovalRequest.create({
        id: crypto.randomUUID(),
        targetId: deal.id,
        type: "Quote Discount Approval",
        status: i % 2 === 0 ? "Approved" : "Pending",
        requestedById: rep.id,
        assignedApproverId: manager1.id,
        approvedById: i % 2 === 0 ? manager1.id : null,
        comments: "Requesting 12% enterprise multi-year bundle discount for key account."
      });
    }

    console.log("==========================================");
    console.log("ENTERPRISE DEMO SEEDING COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  }
}

seedEnterpriseDatabase();
