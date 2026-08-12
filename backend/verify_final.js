const axios = require('axios');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const db = new sqlite3.Database('../nexus_crm.sqlite');
const get = promisify(db.get.bind(db));
const all = promisify(db.all.bind(db));
const API_URL = 'http://localhost:5506/api/v1';
const ts = Date.now();

async function run() {
  console.log("=== 1. WHATSAPP & 2. EMAIL ===");
  try {
    const l = await axios.post(`${API_URL}/public/leads`, { firstName: "WA", lastName: "Email", email: `waem@test${ts}.com`, phone: "+966512345678", source: "Website" });
    const id = l.data.leadId;
    console.log("Created Lead:", id);
    
    // WHATSAPP OUTBOUND
    await axios.post(`${API_URL}/leads/${id}/whatsapp`, { message: "WA Outbound Test" });
    const waOut = await all(`SELECT id, type, direction, outcome FROM Activities WHERE leadId='${id}' AND type='whatsapp'`);
    console.log("WA Outbound DB:", waOut);
    
    // EMAIL OUTBOUND
    await axios.post(`${API_URL}/leads/${id}/email`, { subject: "Email Test", body: "Email Outbound Test" });
    const emOut = await all(`SELECT id, type, direction, outcome FROM Activities WHERE leadId='${id}' AND type='email'`);
    console.log("Email Outbound DB:", emOut);
  } catch(e) { console.log(e.response?.data || e.message); }

  console.log("\n=== 3. DUPLICATE-CONTACT DETECTION ===");
  try {
    console.log("Submitting John...");
    await axios.post(`${API_URL}/public/leads`, { firstName: "John", lastName: "Doe", email: `john@testcorp${ts}.com`, company: "TestCorp", source: "Website" });
    console.log("Submitting Sarah (different email, same domain, slight company spelling diff)...");
    await axios.post(`${API_URL}/public/leads`, { firstName: "Sarah", lastName: "Connor", email: `sarah@testcorp${ts}.com`, company: "Test Corp.", source: "Website" });
    
    console.log("Leads created for this domain:");
    const leads = await all(`SELECT id, email, company FROM Leads WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log(leads);
    
    console.log("LeadContacts created for this domain:");
    const contacts = await all(`SELECT id, email, firstName, lastName, leadId FROM LeadContacts WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log(contacts);
  } catch(e) { console.log(e.response?.data || e.message); }

  console.log("\n=== 4. TEMPERATURE TEST ===");
  try {
    const l = await axios.post(`${API_URL}/public/leads`, { firstName: "Temp", lastName: "Test", email: `temp@test${ts}.com`, source: "Website" });
    const id = l.data.leadId;
    
    console.log("Lead Before:");
    console.log(await get(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${id}'`));
    
    // Directly insert Activities mimicking old and new interactions to test the scoring function
    const db = require('sqlite3').verbose();
    const sqlDb = new db.Database('../nexus_crm.sqlite');
    
    // 1 hour ago ping
    sqlDb.run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'email', 'outbound', 'Ping', datetime('now', '-1 hours'), datetime('now'))`);
    
    // 50 minutes ago reply (10 minute gap -> +15 score)
    sqlDb.run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'email', 'inbound', 'Reply', datetime('now', '-50 minutes'), datetime('now'))`, async () => {
       // Since the internal cron isn't easy to trigger manually via HTTP, we'll manually invoke the recalculation via an inbound webhook that simulates it. Wait, the webhook triggers it for the specific lead matched by email.
       await axios.post(`${API_URL}/webhooks/inbound-email`, { from: `temp@test${ts}.com`, to: "inbound@nexus.com", subject: "Ping", text: "Ping", html: "Ping" });
       
       console.log("Lead After Fast Reply:");
       console.log(await get(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${id}'`));
    });
  } catch(e) { console.log(e.response?.data || e.message); }
}

run();
