/**
 * Seed script — adds department/territory/team to all Users
 * and inserts realistic KPI target rows for every sales rep.
 *
 * Run from project root:
 *   node database/scripts/seedSalesReps.js
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.resolve(__dirname, "../../nexus_crm.sqlite");
const db = new DatabaseSync(DB_PATH);

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

// ── 2. Update Users with org fields ─────────────────────────────────────────
const updateUser = db.prepare(
  "UPDATE Users SET department=?, territory=?, team=?, maxOpenLeads=? WHERE name LIKE ?"
);

console.log("\n📝 Updating user org fields...");
for (const u of USER_ORG) {
  const changes = updateUser.run(u.dept, u.territory, u.team, u.max, `%${u.name.split(" ")[0]}%`);
  console.log(`  ${u.name}: ${changes.changes} row(s) updated`);
}

// ── 3. KPI definitions with realistic current values per rep ─────────────────
const STANDARD_KPIS = [
  // { name, category, target, freq, weight }
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

// Realistic achievement multipliers per rep (0.0–1.2 range)
const REP_PERFORMANCE = {
  "Sophia Martinez": 1.05,   // admin — slightly over target
  "Marcus Vance":    0.95,   // manager — solid
  "Liam Carter":     1.12,   // top performer
  "Emma Watson":     0.88,   // slightly under
  "Olivia Davis":    0.72,   // needs improvement
  "Ethan Hunt":      0.45,   // struggling (OOO)
  "Isabella Rose":   0.98,   // on track
  "Noah Bennett":    1.08,   // strong performer
  "Ava Sterling":    0.32,   // at risk (OOO)
  "Jackson Pollock": 0.83,   // steady
};

// ── 4. Seed KPI targets ────────────────────────────────────────────────────
const insertKpi = db.prepare(`
  INSERT OR IGNORE INTO KpiTargets
    (id, salespersonId, kpiName, targetValue, currentValue, frequency, weightage,
     effectiveDate, expiryDate, notes, status, createdAt, updatedAt)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const users = db.prepare("SELECT id, name FROM Users").all();

const now = new Date();
const effectiveDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const expiryDate    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

let totalInserted = 0;

console.log("\n🎯 Seeding KPI targets...");
for (const user of users) {
  const nameKey = Object.keys(REP_PERFORMANCE).find(k =>
    user.name.toLowerCase().includes(k.split(" ")[0].toLowerCase())
  );
  const multiplier = nameKey ? REP_PERFORMANCE[nameKey] : 0.7;

  for (const kpi of STANDARD_KPIS) {
    // Skip computed meta-KPIs — they get set dynamically by the API
    const isComputed = ["Monthly Achievement", "Quarterly Achievement", "Performance Score"].includes(kpi.name);

    let currentVal;
    if (isComputed) {
      // Set a pre-computed % value roughly matching multiplier
      currentVal = Math.round(kpi.target * multiplier);
    } else if (kpi.name.includes("%")) {
      // Percentage KPIs: clamp to reasonable range
      currentVal = Math.min(100, Math.round(kpi.target * multiplier * (0.8 + Math.random() * 0.4)));
    } else {
      // Numeric KPIs: vary by ±15%
      const jitter = 0.85 + Math.random() * 0.3;
      currentVal = Math.round(kpi.target * multiplier * jitter);
    }

    const id = crypto.randomUUID();
    const result = insertKpi.run(
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
    totalInserted += result.changes;
  }

  console.log(`  ${user.name} (mult: ${multiplier.toFixed(2)}) — ${STANDARD_KPIS.length} KPIs seeded`);
}

console.log(`\n✅ Done! ${totalInserted} KPI target rows inserted.`);

// ── 5. Verify ────────────────────────────────────────────────────────────────
const count = db.prepare("SELECT COUNT(*) as c FROM KpiTargets").get();
console.log(`   Total KPI rows in DB: ${count.c}`);

const sample = db.prepare(
  `SELECT u.name, k.kpiName, k.currentValue, k.targetValue
   FROM KpiTargets k JOIN Users u ON k.salespersonId = u.id
   WHERE k.kpiName = 'Revenue Closed'
   ORDER BY k.currentValue DESC`
).all();
console.log("\n📊 Revenue Closed snapshot:");
for (const r of sample) {
  const pct = Math.round((r.currentValue / r.targetValue) * 100);
  console.log(`   ${r.name.padEnd(20)} ₹${String(r.currentValue).padStart(8)} / ₹${r.targetValue}   (${pct}%)`);
}

db.close();
