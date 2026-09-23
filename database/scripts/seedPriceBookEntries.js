/**
 * Seed script — loads 225 PriceBookEntry items from customMasterData + productsData
 * into local SQLite idempotently (non-destructively).
 *
 * Usage:
 *   node database/scripts/seedPriceBookEntries.js
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

async function seedPriceBookEntries() {
  const sqlite3 = require("sqlite3").verbose();
  const dbPath = path.resolve(__dirname, "../../nexus_crm.sqlite");

  if (!fs.existsSync(dbPath)) {
    console.error("Local database not found at:", dbPath);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);

  // Load customMasterData
  const cmdPath = fs.existsSync(path.resolve(__dirname, "../../backend/build/src/mockData/customMasterData.js"))
    ? path.resolve(__dirname, "../../backend/build/src/mockData/customMasterData.js")
    : path.resolve(__dirname, "../../backend/build/backend/src/mockData/customMasterData.js");

  const { customMasterData } = require(cmdPath);

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

  console.log(`Starting seed for PriceBookEntries... (${customMasterData.length} master data + ${productsData.length} core products = ${customMasterData.length + productsData.length} total)`);

  const now = new Date().toISOString();

  db.serialize(() => {
    const stmt = db.prepare(`
      INSERT INTO PriceBookEntries (id, sku, name, category, unitPrice, minPrice, maxPrice, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    // Check existing SKUs
    db.all("SELECT sku FROM PriceBookEntries", (err, rows) => {
      if (err) {
        console.error("Error checking existing PriceBookEntries:", err);
        db.close();
        return;
      }

      const existingSkus = new Set(rows.map(r => r.sku));

      for (const item of customMasterData) {
        if (!existingSkus.has(item.sku)) {
          stmt.run(
            crypto.randomUUID(),
            item.sku,
            item.lineItem,
            item.category,
            item.rate,
            Math.round(item.rate * 0.85),
            Math.round(item.rate * 1.15),
            `Unit: ${item.unit} | Estimated Rate: ₹${item.rate.toLocaleString('en-IN')}`,
            now,
            now
          );
          inserted++;
          existingSkus.add(item.sku);
        } else {
          skipped++;
        }
      }

      for (const p of productsData) {
        if (!existingSkus.has(p.sku)) {
          stmt.run(
            crypto.randomUUID(),
            p.sku,
            p.name,
            p.category,
            p.unitPrice,
            Math.round(p.unitPrice * 0.85),
            Math.round(p.unitPrice * 1.15),
            p.description,
            now,
            now
          );
          inserted++;
          existingSkus.add(p.sku);
        } else {
          skipped++;
        }
      }

      stmt.finalize(() => {
        db.get("SELECT count(*) as count FROM PriceBookEntries", (countErr, countRow) => {
          if (countErr) console.error("Error counting PriceBookEntries:", countErr);
          else console.log(`✓ PriceBookEntries seeded: ${inserted} inserted, ${skipped} skipped. Total table count: ${countRow.count}`);
          db.close();
        });
      });
    });
  });
}

seedPriceBookEntries();
