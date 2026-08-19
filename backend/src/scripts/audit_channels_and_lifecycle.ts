import { sequelize, Lead, Deal, DealSplit, Quote, Invoice, Payment, SupportTicket, Account, Contact, User, Activity, WorkspaceSetting } from "@nexus-crm/database";
import jwt from "jsonwebtoken";
import { ingestLead, processGmailConnector, processMetaConnector, processLinkedInConnector } from "../services/leadIngestion";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const API_URL = "http://127.0.0.1:5506/api/v1";

async function runAudit() {
  console.log("================================================================================");
  console.log("             NEXUS CRM COMPREHENSIVE PLATFORM HEALTH-CHECK & AUDIT              ");
  console.log("================================================================================");

  const timestamp = Date.now();

  // 0. Setup Auth Context
  let admin = await User.findOne({ where: { role: "admin" } });
  if (!admin) {
    throw new Error("No admin user found in database");
  }
  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: "1h" });
  console.log(`[AUTH] Authenticated as Admin: ${admin.name} (${admin.email}) | ID: ${admin.id}`);

  // ============================================================================
  // SECTION 1: CHANNEL-BY-CHANNEL TESTING WITH RAW DATABASE QUERIES
  // ============================================================================
  
  // 1. WEBSITE LEAD CAPTURE
  console.log("\n--------------------------------------------------------------------------------");
  console.log("1. TESTING INBOUND CHANNEL: WEBSITE LEAD CAPTURE (/api/v1/public/leads)");
  console.log("--------------------------------------------------------------------------------");
  const webLeadEmail = `audit_web_${timestamp}@acmeindustrial.com`;
  const webRes = await fetch(`${API_URL}/public/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "AuditWeb",
      lastName: "Tester",
      email: webLeadEmail,
      phone: "+971501234567",
      company: "Acme Industrial UAE",
      message: "Urgent quote request for 10x industrial generators",
      source: "Website",
      utmCampaign: "audit_campaign_q3"
    })
  });
  const webJson = await webRes.json() as any;
  console.log("HTTP Response Status:", webRes.status, JSON.stringify(webJson));

  const [webLeadRow] = await sequelize.query(`
    SELECT id, "leadNumber", "firstName", "lastName", email, phone, company, source, "leadScore", "assignedToId", "createdAt"
    FROM "Leads" WHERE email = '${webLeadEmail}'
  `);
  console.log("Raw Database Query Result (Leads):", JSON.stringify(webLeadRow, null, 2));

  // 2. INBOUND EMAIL WEBHOOK (Verifying leadId in response & assignmentMethod persistence)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("2. TESTING INBOUND CHANNEL: INBOUND EMAIL WEBHOOK (/api/v1/emails/inbound)");
  console.log("--------------------------------------------------------------------------------");
  const emailSender = `audit_sender_${timestamp}@petrogulf.sa`;
  const emailRes = await fetch(`${API_URL}/emails/inbound?auth_token=nexus_inbound_email_secret_2026`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Tariq Petro <${emailSender}>`,
      to: `Sales Team <leads@inbound.volvitech.com>`,
      subject: `Attn: ${admin.name.split(" ")[0]} - Tender Inquiry for Petrochemical Tanks`,
      text: `Hello ${admin.name.split(" ")[0]},\nWe would like to request tender documents and pricing for 5 storage tanks.`
    })
  });
  const emailJson = await emailRes.json() as any;
  console.log("HTTP Response Status:", emailRes.status, JSON.stringify(emailJson));
  const emailLeadId = emailJson.leadId || emailJson.dealId;

  const [emailLeadRow] = await sequelize.query(`
    SELECT id, "leadNumber", "firstName", "lastName", email, source, "assignmentMethod", "recipientEmail", "assignedToId", "createdAt"
    FROM "Leads" WHERE id = '${emailLeadId}'
  `);
  console.log("Raw Database Query Result (Leads):", JSON.stringify(emailLeadRow, null, 2));

  const [emailActivityRow] = await sequelize.query(`
    SELECT id, type, outcome, "direction", "createdById", "createdAt"
    FROM "Activities" WHERE "leadId" = '${emailLeadId}'
  `);
  console.log("Raw Database Query Result (Activities):", JSON.stringify(emailActivityRow, null, 2));

  // 3. INSTAGRAM WEBHOOK (Meta Challenge + Ingestion Gateway + leadId response field)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("3. TESTING INBOUND CHANNEL: INSTAGRAM WEBHOOK (/api/v1/instagram/webhook)");
  console.log("--------------------------------------------------------------------------------");
  // 3A. Meta Verification Challenge (GET)
  const igVerifyRes = await fetch(`${API_URL}/instagram/webhook?hub.mode=subscribe&hub.verify_token=nexus_instagram_verify_secret_2026&hub.challenge=ig_challenge_7788`);
  const igChallengeText = await igVerifyRes.text();
  console.log("GET /instagram/webhook Verification Status:", igVerifyRes.status, "Challenge Echo:", igChallengeText);

  // 3B. Inbound Message (POST with gateway auth token)
  const igSenderId = `ig_audit_${timestamp}`;
  const igRes = await fetch(`${API_URL}/instagram/webhook?auth_token=nexus_instagram_gateway_secret_2026`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderId: igSenderId,
      senderName: "Farhan Instagram Inquiry",
      username: `farhan_ig_${timestamp.toString().slice(-4)}`,
      text: "Hello! What is the price and delivery timeline for prefabricated office containers?"
    })
  });
  const igJson = await igRes.json() as any;
  console.log("POST /instagram/webhook HTTP Response Status:", igRes.status, JSON.stringify(igJson));
  const igLeadId = igJson.leads?.[0]?.leadId || igJson.leads?.[0]?.dealId;

  const [igLeadRow] = await sequelize.query(`
    SELECT id, "leadNumber", "firstName", "lastName", email, company, source, "sourceDetail", "createdAt"
    FROM "Leads" WHERE id = '${igLeadId}'
  `);
  console.log("Raw Database Query Result (Leads):", JSON.stringify(igLeadRow, null, 2));

  const [igActivityRow] = await sequelize.query(`
    SELECT id, type, outcome, "leadId", "createdAt"
    FROM "Activities" WHERE "leadId" = '${igLeadId}'
  `);
  console.log("Raw Database Query Result (Activities):", JSON.stringify(igActivityRow, null, 2));

  // 4. WHATSAPP / SMS WEBHOOK (Meta Cloud API + Twilio SMS + whatsappPhone verification)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("4. TESTING INBOUND CHANNEL: WHATSAPP / SMS WEBHOOK (/api/v1/whatsapp/webhook)");
  console.log("--------------------------------------------------------------------------------");
  // 4A. Meta Verification Challenge (GET)
  const waVerifyRes = await fetch(`${API_URL}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nexus_whatsapp_verify_secret_2026&hub.challenge=wa_challenge_9900`);
  const waChallengeText = await waVerifyRes.text();
  console.log("GET /whatsapp/webhook Verification Status:", waVerifyRes.status, "Challenge Echo:", waChallengeText);

  // 4B. Inbound Meta WhatsApp Message (POST)
  const waSenderPhone = `9715${String(timestamp).slice(-7)}`;
  const waMsgId = `wamid.audit.${timestamp}`;
  const waRes = await fetch(`${API_URL}/whatsapp/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{
        id: "wa_account_9988",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "+9714000111", phone_number_id: "phone_id_99" },
            contacts: [{ profile: { name: "Zaid Al-Harbi" }, wa_id: waSenderPhone }],
            messages: [{
              from: waSenderPhone,
              id: waMsgId,
              timestamp: String(Math.floor(timestamp / 1000)),
              type: "text",
              text: { body: "Hi Nexus team, need pricing for site toilet cabins rental for 6 months." }
            }]
          },
          field: "messages"
        }]
      }]
    })
  });
  const waResText = await waRes.text();
  console.log("POST /whatsapp/webhook HTTP Response Status:", waRes.status, "Body:", waResText);

  const [waLeadRow] = await sequelize.query(`
    SELECT id, "leadNumber", "firstName", "lastName", email, phone, "whatsappPhone", source, "sourceDetail", "createdAt"
    FROM "Leads" WHERE "sourceDetail" LIKE '%${waMsgId}%' OR phone LIKE '%${waSenderPhone}%' OR "whatsappPhone" LIKE '%${waSenderPhone}%'
  `);
  console.log("Raw Database Query Result (Leads):", JSON.stringify(waLeadRow, null, 2));
  const waLeadId = (waLeadRow[0] as any)?.id;

  if (waLeadId) {
    const [waActivityRow] = await sequelize.query(`
      SELECT id, type, outcome, "leadId", "createdAt"
      FROM "Activities" WHERE "leadId" = '${waLeadId}'
    `);
    console.log("Raw Database Query Result (Activities):", JSON.stringify(waActivityRow, null, 2));
  }

  // 5. VOICE TRANSCRIPT PARSER (Verifying Name, Company, Budget, Industry extraction)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("5. TESTING VOICE TRANSCRIPT PARSER (/api/v1/leads/parse-voice)");
  console.log("--------------------------------------------------------------------------------");
  const voiceRes = await fetch(`${API_URL}/leads/parse-voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      transcript: "This is Mansoor from Emirates Global Steel, my email is mansoor@egsteel.ae and phone is 0509988776. We have a budget of SAR 350,000 for heavy structural fabrication."
    })
  });
  const voiceJson = await voiceRes.json() as any;
  console.log("HTTP Response Status:", voiceRes.status, "Extracted JSON:", JSON.stringify(voiceJson, null, 2));

  // 6. SIMULATED INGESTION CONNECTORS (GMAIL, META, LINKEDIN)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("6. TESTING SIMULATED INGESTION CONNECTORS (GMAIL, META, LINKEDIN)");
  console.log("--------------------------------------------------------------------------------");
  const gmailLeadId = await processGmailConnector();
  const metaLeadId = await processMetaConnector();
  const linkedInLeadId = await processLinkedInConnector();

  console.log("Simulated Connector Ingestion Result IDs:", { gmailLeadId, metaLeadId, linkedInLeadId });
  const [connectorsRows] = await sequelize.query(`
    SELECT id, "leadNumber", "firstName", "lastName", email, company, source, "sourceDetail", "createdAt"
    FROM "Leads" WHERE id IN ('${gmailLeadId}', '${metaLeadId}', '${linkedInLeadId}')
  `);
  console.log("Raw Database Query Result (Connector Leads):", JSON.stringify(connectorsRows, null, 2));

  // ============================================================================
  // SECTION 2: CONTINUOUS END-TO-END CRM FLOW TOP-TO-BOTTOM
  // ============================================================================
  console.log("\n================================================================================");
  console.log(" SECTION 2: END-TO-END CRM LIFECYCLE VERIFICATION (1 CONTINUOUS WORKFLOW)       ");
  console.log("================================================================================");

  // Step 1: Create Lead
  console.log("\n[E2E STEP 1] Ingesting New Inbound Lead...");
  const e2eLeadEmail = `e2e_client_${timestamp}@apexindustries.com`;
  const leadId = await ingestLead({
    firstName: "Nasser",
    lastName: "Al-Ghamdi",
    email: e2eLeadEmail,
    phone: "+966507778899",
    company: "Apex Heavy Industries KSA",
    source: "Website",
    message: "Seeking turnkey modular site camp facility for 200 engineers."
  });
  const [e2eLead] = await sequelize.query(`SELECT id, "leadNumber", "firstName", "lastName", company, email, status, "assignedToId" FROM "Leads" WHERE id = '${leadId}'`);
  console.log("E2E Step 1 DB Record (Lead Created):", JSON.stringify(e2eLead, null, 2));

  // Step 2: Convert Lead to Opportunity (Verifying Deal.accountId is NOT null)
  console.log("\n[E2E STEP 2] Converting Lead to Opportunity / Deal...");
  const convertRes = await fetch(`${API_URL}/leads/${leadId}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      estimatedValue: 450000,
      requirement: "Turnkey 200-Person Modular Site Camp Facility",
      timeline: "Q4 2026",
      decisionMaker: "Nasser Al-Ghamdi",
      probability: 60
    })
  });
  const convertJson = await convertRes.json() as any;
  console.log("Conversion HTTP Response:", convertRes.status, JSON.stringify(convertJson));

  const oppId = convertJson.opportunity?.id || convertJson.dealId || convertJson.opportunityId;
  const accId = convertJson.account?.id || convertJson.accountId;
  const [oppRow] = await sequelize.query(`SELECT id, name, amount, "ownerId", "accountId", "customerId", "stageId", "createdAt" FROM "Deals" WHERE id = '${oppId}'`);
  console.log("E2E Step 2 DB Record (Opportunity/Deal with accountId):", JSON.stringify(oppRow, null, 2));
  const [accRow] = await sequelize.query(`SELECT id, name, industry, "createdAt" FROM "Accounts" WHERE id = '${accId}'`);
  console.log("E2E Step 2 DB Record (Account):", JSON.stringify(accRow, null, 2));

  // Step 3: Verify DealSplit
  console.log("\n[E2E STEP 3] Querying Auto-Created DealSplit Commission Record...");
  const [splitRows] = await sequelize.query(`SELECT id, "dealId", "userId", "splitPercentage", "createdAt" FROM "DealSplits" WHERE "dealId" = '${oppId}'`);
  console.log("E2E Step 3 DB Record (DealSplits):", JSON.stringify(splitRows, null, 2));

  // Step 4: Create Quote (Verifying totalAmount is populated from line items)
  console.log("\n[E2E STEP 4] Generating Quote for Opportunity...");
  const quoteRes = await fetch(`${API_URL}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      dealId: oppId,
      customerId: accId,
      title: "Quotation - 200 Person Site Camp Facility",
      totalAmount: 450000,
      status: "Draft",
      lineItems: [
        { description: "Prefabricated Accommodation Blocks (x10 units)", quantity: 10, unitPrice: 35000, totalPrice: 350000 },
        { description: "Central Kitchen & Mess Hall Unit", quantity: 1, unitPrice: 100000, totalPrice: 100000 }
      ]
    })
  });
  const quoteJson = await quoteRes.json() as any;
  console.log("Quote Creation HTTP Response:", quoteRes.status, JSON.stringify(quoteJson));
  const quoteId = quoteJson.quote?.id || quoteJson.id;
  const [quoteRow] = await sequelize.query(`SELECT id, "dealId", "totalAmount", status, "quoteNumber", "createdAt" FROM "Quotes" WHERE id = '${quoteId}'`);
  console.log("E2E Step 4 DB Record (Quote with real totalAmount):", JSON.stringify(quoteRow, null, 2));

  // Step 5: Convert Quote to Invoice (Verifying invoice inherits quote totalAmount)
  console.log("\n[E2E STEP 5] Converting Accepted Quote to Invoice...");
  const invoiceRes = await fetch(`${API_URL}/invoices/from-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      quoteId: quoteId,
      paymentTerms: "NET 30",
      notes: "Initial Commercial Billing for Site Camp Deployment"
    })
  });
  const invoiceJson = await invoiceRes.json() as any;
  console.log("Invoice Generation HTTP Response:", invoiceRes.status, JSON.stringify(invoiceJson));
  const invoiceId = invoiceJson.invoice?.id || invoiceJson.id;
  const [invoiceRow] = await sequelize.query(`SELECT id, "quoteId", "totalAmount", "amountPaid", "paymentStatus", status, "createdAt" FROM "Invoices" WHERE id = '${invoiceId}'`);
  console.log("E2E Step 5 DB Record (Invoice Created with totalAmount):", JSON.stringify(invoiceRow, null, 2));

  // Step 6: Record Payments (Verifying unpaid -> partial -> paid transition)
  console.log("\n[E2E STEP 6A] Recording Partial Payment ($150,000 via Bank Transfer)...");
  const pay1Res = await fetch(`${API_URL}/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      amount: 150000,
      method: "bank_transfer",
      paymentDate: new Date().toISOString().split("T")[0],
      reference: "SWIFT-TX-APEX-001"
    })
  });
  const pay1Json = await pay1Res.json() as any;
  console.log("Partial Payment HTTP Response:", pay1Res.status, JSON.stringify(pay1Json));

  const [invPartialRow] = await sequelize.query(`SELECT id, "totalAmount", "amountPaid", "paymentStatus", status FROM "Invoices" WHERE id = '${invoiceId}'`);
  console.log("E2E Step 6A DB Record (Invoice after Partial Payment -> 'partial'):", JSON.stringify(invPartialRow, null, 2));

  console.log("\n[E2E STEP 6B] Recording Final Balance Payment ($300,000 via Card)...");
  const pay2Res = await fetch(`${API_URL}/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      amount: 300000,
      method: "card",
      paymentDate: new Date().toISOString().split("T")[0],
      reference: "CC-VISA-APEX-002"
    })
  });
  const pay2Json = await pay2Res.json() as any;
  console.log("Full Payment HTTP Response:", pay2Res.status, JSON.stringify(pay2Json));

  const [invPaidRow] = await sequelize.query(`SELECT id, "totalAmount", "amountPaid", "paymentStatus", status FROM "Invoices" WHERE id = '${invoiceId}'`);
  console.log("E2E Step 6B DB Record (Invoice after Full Payment -> 'paid'):", JSON.stringify(invPaidRow, null, 2));

  const [paymentsRows] = await sequelize.query(`SELECT id, "invoiceId", amount, method, reference, "recordedBy", "createdAt" FROM "Payments" WHERE "invoiceId" = '${invoiceId}'`);
  console.log("E2E Step 6 DB Records (Payments Ledger):", JSON.stringify(paymentsRows, null, 2));

  // Step 7: Support Ticket Lifecycle
  console.log("\n[E2E STEP 7A] Raising Support Ticket Against Account...");
  const ticketRes = await fetch(`${API_URL}/support-tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      accountId: accId,
      category: "maintenance",
      description: "Routine 30-day HVAC filtration and electrical inspection required for block 4."
    })
  });
  const ticketJson = await ticketRes.json() as any;
  console.log("Support Ticket Creation HTTP Response:", ticketRes.status, JSON.stringify(ticketJson));
  const ticketId = ticketJson.ticket?.id || ticketJson.id;

  const [ticketOpenRow] = await sequelize.query(`SELECT id, "accountId", category, status, description, "raisedBy", "resolvedAt", "createdAt" FROM "SupportTickets" WHERE id = '${ticketId}'`);
  console.log("E2E Step 7A DB Record (Ticket Open):", JSON.stringify(ticketOpenRow, null, 2));

  console.log("\n[E2E STEP 7B] Transitioning Support Ticket: OPEN -> IN_PROGRESS...");
  await fetch(`${API_URL}/support-tickets/${ticketId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ status: "in_progress" })
  });
  const [ticketProgRow] = await sequelize.query(`SELECT id, status, "resolvedAt" FROM "SupportTickets" WHERE id = '${ticketId}'`);
  console.log("E2E Step 7B DB Record (Ticket In Progress):", JSON.stringify(ticketProgRow, null, 2));

  console.log("\n[E2E STEP 7C] Transitioning Support Ticket: IN_PROGRESS -> RESOLVED...");
  await fetch(`${API_URL}/support-tickets/${ticketId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ status: "resolved" })
  });
  const [ticketResolvedRow] = await sequelize.query(`SELECT id, status, "resolvedAt" FROM "SupportTickets" WHERE id = '${ticketId}'`);
  console.log("E2E Step 7C DB Record (Ticket Resolved with Auto resolvedAt):", JSON.stringify(ticketResolvedRow, null, 2));

  console.log("\n================================================================================");
  console.log("                 AUDIT & VERIFICATION EXECUTION COMPLETE                        ");
  console.log("================================================================================");
}

runAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit Execution Error:", err);
    process.exit(1);
  });
