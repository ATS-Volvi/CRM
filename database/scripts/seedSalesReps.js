/**
 * Seed script — adds department/territory/team to all Users
 * and inserts realistic KPI target rows for every sales rep.
 *
 * Run from project root:
 *   node database/scripts/seedSalesReps.js
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.resolve(__dirname, "../../nexus_crm.sqlite");
const db = new sqlite3.Database(DB_PATH);

// ── 1. Org data per user ─────────────────────────────────────────────────────
const USER_ORG = [
  // name (partial match), department, territory, team, maxOpenLeads
  { name: "Sophia Martinez",  dept: "Sales",         territory: "MEA",        team: "Phoenix",  max: 50 },
  { name: "Marcus Vance",     dept: "Enterprise",    territory: "EMEA",       team: "Global",   max: 40 },
  { name: "Liam Carter",      dept: "SMB",           territory: "Americas",   team: "Aces",     max: 25 },
  { name: "Emma Watson",      dept: "Enterprise",    territory: "APAC",       team: "Global",   max: 30 },
  { name: "Olivia Davis",     dept: "Commercial",    territory: "EMEA",       team: "Velocity", max: 28 },
  { name: "Ethan Hunt",       dept: "Inside Sales",  territory: "Americas",   team: "Aces",     max: 35 },
  { name: "Isabella Rose",    dept: "SMB",           territory: "South Asia", team: "Hawks",    max: 22 },
  { name: "Noah Bennett",     dept: "Commercial",    territory: "Dubai",      team: "Phoenix",  max: 30 },
  { name: "Ava Sterling",     dept: "Enterprise",    territory: "MEA",        team: "Global",   max: 20 },
  { name: "Jackson Pollock",  dept: "Inside Sales",  territory: "APAC",       team: "Velocity", max: 32 },
];

// KPI definitions with realistic targets
const STANDARD_KPIS = [
  { name: "New Leads",              target: 50,     freq: "monthly",    weight: 10 },
  { name: "Qualified Leads",        target: 20,     freq: "monthly",    weight: 15 },
  { name: "Assigned Leads",         target: 60,     freq: "monthly",    weight: 5  },
  { name: "Calls Made",             target: 200,    freq: "monthly",    weight: 10 },
  { name: "Follow-ups",             target: 150,    freq: "monthly",    weight: 10 },
  { name: "Emails",                 target: 300,    freq: "monthly",    weight: 5  },
  { name: "Customer Visits",        target: 12,     freq: "monthly",    weight: 15 },
  { name: "Meetings Scheduled",     target: 15,     freq: "monthly",    weight: 10 },
  { name: "Meetings Completed",     target: 10,     freq: "monthly",    weight: 15 },
  { name: "Product Demo",           target: 8,      freq: "monthly",    weight: 10 },
  { name: "Technical Meeting",      target: 4,      freq: "monthly",    weight: 10 },
  { name: "Quotations Sent",        target: 15,     freq: "monthly",    weight: 10 },
  { name: "Quotations Approved",    target: 5,      freq: "monthly",    weight: 20 },
  { name: "Purchase Orders",        target: 5,      freq: "monthly",    weight: 20 },
  { name: "Revenue Closed",         target: 100000, freq: "monthly",    weight: 30 },
  { name: "Lead → Meeting %",       target: 20,     freq: "monthly",    weight: 15 },
  { name: "Meeting → Proposal %",   target: 60,     freq: "monthly",    weight: 15 },
  { name: "Proposal → PO %",        target: 40,     freq: "monthly",    weight: 15 },
  { name: "Lead → Customer %",      target: 10,     freq: "monthly",    weight: 20 },
  { name: "Invoice Clearance",      target: 5,      freq: "monthly",    weight: 10 },
  { name: "Payment Collection",     target: 80000,  freq: "monthly",    weight: 20 },
  { name: "Outstanding Collections",target: 20000,  freq: "monthly",    weight: 10 },
  { name: "New Clients",            target: 5,      freq: "monthly",    weight: 15 },
  { name: "Repeat Clients",         target: 2,      freq: "monthly",    weight: 10 },
  { name: "Monthly Achievement",    target: 80,     freq: "monthly",    weight: 10 },
  { name: "Quarterly Achievement",  target: 85,     freq: "quarterly",  weight: 10 },
  { name: "Performance Score",      target: 75,     freq: "monthly",    weight: 10 },
];

const REP_PERFORMANCE = {
  "Sophia Martinez": 1.05,
  "Marcus Vance":    0.95,
  "Liam Carter":     1.12,
  "Emma Watson":     0.88,
  "Olivia Davis":    0.72,
  "Ethan Hunt":      0.45,
  "Isabella Rose":   0.98,
  "Noah Bennett":    1.08,
  "Ava Sterling":    0.32,
  "Jackson Pollock": 0.83,
};

const now = new Date();
const effectiveDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const expiryDate    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

db.serialize(() => {
  console.log("\n📝 Updating user org fields...");
  const updateUser = db.prepare(
    "UPDATE Users SET department=?, territory=?, team=?, maxOpenLeads=? WHERE name LIKE ?"
  );
  for (const u of USER_ORG) {
    updateUser.run(u.dept, u.territory, u.team, u.max, `%${u.name.split(" ")[0]}%`);
    console.log(`  ${u.name} org updated`);
  }
  updateUser.finalize();

  console.log("\n🎯 Seeding KPI targets...");
  db.all("SELECT id, name FROM Users", (err, users) => {
    if (err) {
      console.error(err);
      return;
    }

    const insertKpi = db.prepare(`
      INSERT OR IGNORE INTO KpiTargets
        (id, salespersonId, kpiName, targetValue, currentValue, frequency, weightage,
         effectiveDate, expiryDate, notes, status, createdAt, updatedAt)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const user of users) {
      const nameKey = Object.keys(REP_PERFORMANCE).find(k =>
        user.name.toLowerCase().includes(k.split(" ")[0].toLowerCase())
      );
      const multiplier = nameKey ? REP_PERFORMANCE[nameKey] : 0.7;

      for (const kpi of STANDARD_KPIS) {
        const isComputed = ["Monthly Achievement", "Quarterly Achievement", "Performance Score"].includes(kpi.name);

        let currentVal;
        if (isComputed) {
          currentVal = Math.round(kpi.target * multiplier);
        } else if (kpi.name.includes("%")) {
          currentVal = Math.min(100, Math.round(kpi.target * multiplier * (0.8 + Math.random() * 0.4)));
        } else {
          const jitter = 0.85 + Math.random() * 0.3;
          currentVal = Math.round(kpi.target * multiplier * jitter);
        }

        const id = crypto.randomUUID();
        insertKpi.run(
          id,
          user.id,
          kpi.name,
          kpi.target,
          currentVal,
          kpi.freq,
          kpi.weight,
          effectiveDate,
          expiryDate,
          `${now.toLocaleString("default", { month: "long" })} target`
        );
      }
      console.log(`  ${user.name} targets generated`);
    }
    insertKpi.finalize();
    
    // Complete
    console.log(`\n✅ Seeding complete.`);
    db.close();
  });
});
