/**
 * Transactional Data Seeding Script
 * 
 * Seeds realistic leads, activities, deals, quotes, purchase orders, and invoices
 * for all sales representatives so their dynamic KPI target dashboards populate with data.
 * 
 * Run from workspace root:
 *   node database/scripts/seedTransactions.js
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.resolve(__dirname, "../../nexus_crm.sqlite");
const db = new DatabaseSync(DB_PATH);

// Retrieve all users
const users = db.prepare("SELECT id, name, role FROM Users WHERE role IN ('sales_rep', 'sales_manager', 'admin')").all();

// Retrieve customer records to associate with leads/deals
const customers = db.prepare("SELECT id, name FROM Customers").all();
if (customers.length === 0) {
  console.log("No customers found! Please run backend seeder first.");
  db.close();
  process.exit(1);
}

// Clear old transactions to prevent primary key/foreign key bloat during re-seeding
console.log("🗑️ Clearing old transactions to start fresh...");
db.prepare("DELETE FROM Activities").run();
db.prepare("DELETE FROM PurchaseOrders").run();
db.prepare("DELETE FROM Invoices").run();
db.prepare("DELETE FROM Quotes").run();
db.prepare("DELETE FROM Deals").run();
db.prepare("DELETE FROM Leads").run();

// Prepare statements
const insertLead = db.prepare(`
  INSERT INTO Leads (id, firstName, lastName, company, email, phone, status, source, industry, assignedToId, leadScore, leadNumber, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const insertActivity = db.prepare(`
  INSERT INTO Activities (id, leadId, type, outcome, notes, mentioned_user_ids, pinned, createdById, dueDate, priority, isCompleted, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const insertDeal = db.prepare(`
  INSERT INTO Deals (id, name, amount, stageId, ownerId, leadId, customerId, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const insertQuote = db.prepare(`
  INSERT INTO Quotes (id, dealId, status, totalAmount, quoteNumber, version, statusChangedAt, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const insertPO = db.prepare(`
  INSERT INTO PurchaseOrders (id, quoteId, poNumber, amount, status, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const insertInvoice = db.prepare(`
  INSERT INTO Invoices (id, quoteId, totalAmount, status, dueDate, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

// Get a random element from an array
const randomSelect = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Retrieve a mock stage ID for Deal stage (Won, Proposal, etc.)
// We get them from PipelineStages table
const stages = db.prepare("SELECT id, name FROM PipelineStages").all();
const stageWon = stages.find(s => s.name === "Won")?.id || crypto.randomUUID();
const stageProposal = stages.find(s => s.name === "Proposal")?.id || crypto.randomUUID();
const stageDemo = stages.find(s => s.name === "Meeting/Demo")?.id || crypto.randomUUID();

// Performance profile multipliers per rep to generate aligned mock transaction volumes
const PERFORMANCE_PROFILES = {
  "Sophia Martinez": { leads: 48, activities: 280, dealsWon: 4, revenue: 110000 },
  "Marcus Vance":    { leads: 38, activities: 240, dealsWon: 3, revenue: 85000 },
  "Liam Carter":     { leads: 52, activities: 310, dealsWon: 5, revenue: 135000 },
  "Emma Watson":     { leads: 44, activities: 220, dealsWon: 3, revenue: 90000 },
  "Olivia Davis":    { leads: 35, activities: 180, dealsWon: 2, revenue: 65000 },
  "Ethan Hunt":      { leads: 15, activities: 90,  dealsWon: 1, revenue: 35000 },
  "Isabella Rose":   { leads: 40, activities: 230, dealsWon: 3, revenue: 95000 },
  "Noah Bennett":    { leads: 45, activities: 260, dealsWon: 4, revenue: 105000 },
  "Ava Sterling":    { leads: 12, activities: 60,  dealsWon: 0, revenue: 0 },
  "Jackson Pollock": { leads: 32, activities: 170, dealsWon: 2, revenue: 70000 },
};

console.log("🌱 Seeding realistic transactional data for reps...");

let leadSeq = 1;
let poSeq = 1001;
let qtSeq = 5001;
let invSeq = 8001;

for (const user of users) {
  // Find matching profile
  const profileKey = Object.keys(PERFORMANCE_PROFILES).find(k => user.name.includes(k.split(" ")[0]));
  const p = PERFORMANCE_PROFILES[profileKey] || { leads: 20, activities: 100, dealsWon: 1, revenue: 30000 };

  console.log(`  Seeding for ${user.name} (Targeting ~${p.dealsWon} Won Deals, ₹${p.revenue} Revenue)...`);

  const createdLeadIds = [];

  // 1. Seed Leads
  for (let i = 0; i < p.leads; i++) {
    const leadId = crypto.randomUUID();
    const cust = randomSelect(customers);
    const status = i < p.dealsWon ? "Qualified" : randomSelect(["New", "Contacted", "Qualified"]);
    const source = randomSelect(["Website", "Referral", "Cold Call", "LinkedIn", "Social Media", "Trade Show"]);
    
    insertLead.run(
      leadId,
      `Lead_${leadSeq}`,
      `LastName_${leadSeq}`,
      cust.name,
      `lead_${leadSeq}@testcompany.com`,
      `+1-555-00${leadSeq}`,
      status,
      source,
      randomSelect(["Technology", "Manufacturing", "Finance", "Healthcare"]),
      user.id,
      Math.floor(40 + Math.random() * 55), // Lead score
      `LD-2026-${String(leadSeq).padStart(5, '0')}`
    );
    createdLeadIds.push(leadId);
    leadSeq++;
  }

  // 2. Seed Activities (Calls, Emails, Meetings, Demos, Visits)
  // Standard KPI triggers are:
  // Calls Made (type="call")
  // Emails (type="email")
  // Follow-ups (type="follow_up" / activity outcome contains follow-up)
  // Customer Visits (type="visit")
  // Meetings Scheduled (type="meeting")
  // Meetings Completed (type="meeting" & outcome="completed")
  // Product Demo (type="demo")
  // Technical Meeting (type="technical")
  const actTypes = ["call", "email", "meeting", "task", "visit", "demo", "technical"];
  for (let i = 0; i < p.activities; i++) {
    const actId = crypto.randomUUID();
    const type = randomSelect(actTypes);
    const leadId = randomSelect(createdLeadIds);
    let outcome = "Outcome note details";
    let isCompleted = 1;

    if (type === "meeting") {
      outcome = randomSelect(["completed", "scheduled", "cancelled"]);
      isCompleted = outcome === "completed" ? 1 : 0;
    }

    insertActivity.run(
      actId,
      leadId,
      type,
      outcome,
      `Activity logs for representative outreach. Type: ${type}`,
      user.id,
      null, // dueDate
      randomSelect(["low", "medium", "high"]),
      isCompleted
    );
  }

  // 3. Seed Deals, Quotes, Purchase Orders & Invoices to hit Revenue Targets
  const wonDealCount = p.dealsWon;
  const singleDealAmount = wonDealCount > 0 ? Math.round(p.revenue / wonDealCount) : 0;

  for (let i = 0; i < wonDealCount; i++) {
    const dealId = crypto.randomUUID();
    const leadId = randomSelect(createdLeadIds);
    const cust = randomSelect(customers);

    // Create a Won Deal
    insertDeal.run(
      dealId,
      `${cust.name} Prefab Cabin Contract`,
      singleDealAmount,
      stageWon,
      user.id,
      leadId,
      cust.id
    );

    // Create associated accepted Quote
    const quoteId = crypto.randomUUID();
    insertQuote.run(
      quoteId,
      dealId,
      "Accepted",
      singleDealAmount,
      `QT-2026-${String(qtSeq++).padStart(5, '0')}`
    );

    // Create associated Purchase Order (this generates live closed revenue)
    insertPO.run(
      crypto.randomUUID(),
      quoteId,
      `PO-MOCK-${poSeq++}`,
      singleDealAmount,
      "Approved"
    );

    // Create associated Invoice (payment collection)
    const invStatus = randomSelect(["Paid", "Sent", "Pending"]);
    insertInvoice.run(
      crypto.randomUUID(),
      quoteId,
      singleDealAmount,
      invStatus,
      new Date(Date.now() + 30 * 86400000).toISOString()
    );
  }

  // Seed 2-3 pending deals (Proposal/Demo stage)
  const pendingDeals = p.dealsWon > 0 ? 2 : 0;
  for (let i = 0; i < pendingDeals; i++) {
    const dealId = crypto.randomUUID();
    const leadId = randomSelect(createdLeadIds);
    const cust = randomSelect(customers);

    insertDeal.run(
      dealId,
      `${cust.name} Office Expansion`,
      Math.round(20000 + Math.random() * 30000),
      randomSelect([stageProposal, stageDemo]),
      user.id,
      leadId,
      cust.id
    );
  }
}

console.log("\n✅ Transactional database seeding completed successfully!");
db.close();
