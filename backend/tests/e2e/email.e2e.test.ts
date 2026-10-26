import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";

const app = createServer();

// We must mock nodemailer at the top level
jest.mock("nodemailer", () => {
  const sendMailMock = jest.fn().mockResolvedValue({ messageId: "mock-message-id" });
  return {
    createTransport: jest.fn().mockReturnValue({
      sendMail: sendMailMock
    })
  };
});

describe("E2E: Email Delivery Automation", () => {
  let nodemailer: any;
  let transporter: any;

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = "test_secret";
    nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport();

    // Mock AI intent classifier for tests so no real LLM calls are made
    const { _setIntentHandler } = require("../../src/lead-security-layer/intentFilter/intentClassifier");
    _setIntentHandler(async () => ({
      label: "new_enquiry",
      leadScore: 85,
      confidence: "high",
      language: "en",
      reason: "Mock test enquiry"
    }));

    // Mock AI moderation so no real LLM calls are made during tests
    const { _setModerationHandler } = require("../../src/lead-security-layer/aiModeration");
    _setModerationHandler(async () => ({ flagged: false, category: "none" }));
    
    // Create a default user to satisfy Activity foreign key constraint
    try {
      const hashedPassword = await require("bcryptjs").hash("password123", 10);
      await sequelize.models.User.create({
        id: require('crypto').randomUUID(),
        name: "Default Admin",
        email: "admin@nexus.com",
        password: hashedPassword,
        role: "admin"
      });
    } catch (e) {}

    // Create the required template for public leads
    await sequelize.models.MessageTemplate.create({
      id: require('crypto').randomUUID(),
      name: "lead_acknowledgement",
      channel: "email",
      subject: "Welcome to Nexus CRM",
      body: "Hi {{lead_name}}, we have received your request."
    });
  });

  beforeEach(() => {
    transporter.sendMail.mockClear();
  });

  it("should trigger an automated email when a new public lead is captured", async () => {
    const payload = {
      firstName: "Email",
      lastName: "Tester",
      email: "email.tester@example.com",
      company: "Mail Co"
    };

    const response = await request(app)
      .post("/api/v1/public/leads")
      .send(payload);

    expect(response.status).toBe(201);

    // Give the async email trigger a small tick to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    
    const sendMailArgs = transporter.sendMail.mock.calls[0][0];
    expect(sendMailArgs.to).toBe("email.tester@example.com");
    expect(sendMailArgs.subject).toBe("Welcome to Nexus CRM");
    expect(sendMailArgs.html).toContain("Hi Email, we have received your request.");
  });

  it("should return 401 when INBOUND_EMAIL_SECRET is unset in the environment even if no token is provided", async () => {
    const originalSecret = process.env.INBOUND_EMAIL_SECRET;
    delete process.env.INBOUND_EMAIL_SECRET;

    const payload = {
      from: "Client <client@example.com>",
      to: "sales@nexus.com",
      subject: "Unset secret test",
      text: "Request while INBOUND_EMAIL_SECRET is unset"
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound")
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET");

    // Restore environment variable
    process.env.INBOUND_EMAIL_SECRET = originalSecret;
  });

  it("should return 401 when calling inbound email with missing or wrong token when secret is set", async () => {
    const payload = {
      from: "Client <client@example.com>",
      to: "sales@nexus.com",
      subject: "Wrong auth token",
      text: "Unauthenticated request"
    };

    // Test missing token
    const missingTokenRes = await request(app)
      .post("/api/v1/emails/inbound")
      .send(payload);

    expect(missingTokenRes.status).toBe(401);
    expect(missingTokenRes.body.error).toContain("Unauthorized");

    // Test wrong token
    const wrongTokenRes = await request(app)
      .post("/api/v1/emails/inbound?auth_token=invalid_token")
      .send(payload);

    expect(wrongTokenRes.status).toBe(401);
    expect(wrongTokenRes.body.error).toContain("Unauthorized");
  });

  it("should assign lead directly to salesperson if email is addressed to their email address", async () => {
    // Create a known salesperson
    const userEmail = `sales_rep_${require('crypto').randomUUID()}@nexus.com`;
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const salesperson = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Test Rep Direct",
      email: userEmail,
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const payload = {
      from: "Client <client@example.com>",
      to: `Test Rep <${userEmail}>`,
      subject: "Direct Help",
      text: "Need your direct assistance."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(salesperson.id);

    // Verify recipientEmail field is saved
    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.recipientEmail).toBe(userEmail);
  });

  it("should fallback to default routing if recipient email does not match a known salesperson", async () => {
    const defaultAdmin = await sequelize.models.User.findOne({
      where: { email: "admin@nexus.com" }
    }) as any;

    const payload = {
      from: "Fallback Client <fallback.client@example.com>",
      to: "generic-inbox@nexus-crm.com",
      subject: "General Query",
      text: "Need general info."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(defaultAdmin.id);
    
    // Verify recipientEmail field is saved even if fallback is used
    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.recipientEmail).toBe("generic-inbox@nexus-crm.com");
  });

  it("should route by plus-addressing tag (e.g. face+alias@123.com)", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const aliasRep = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Alias Tester",
      email: `aliastester_${require('crypto').randomUUID()}@nexus.com`,
      emailAlias: "aliastag",
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const payload = {
      from: "Client <client@example.com>",
      to: "face+aliastag@123.com",
      subject: "Quote via Plus Tag",
      text: "Hello team."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(aliasRep.id);
    expect(response.body.assignmentMethod).toBe("plus-tag");
  });

  it("should route by explicit Attn: or For: convention", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const attnRep = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Marcus Aurelius",
      email: `marcus_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const payload = {
      from: "Client <client@example.com>",
      to: "face@123.com",
      subject: "Attn: Marcus",
      text: "Please send quote."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(attnRep.id);
    expect(response.body.assignmentMethod).toBe("attn-tag");
  });

  it("should route by single confident name mention and record an activity log", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const singleNameRep = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Gwen Stacy",
      email: `gwen_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const payload = {
      from: "Client <client@example.com>",
      to: "face@123.com",
      subject: "Project inquiry",
      text: "I was told Gwen would handle our project."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(singleNameRep.id);
    expect(response.body.assignmentMethod).toBe("name-match");

    // Verify assignment flag activity log was created
    const activity = await sequelize.models.Activity.findOne({
      where: { leadId: response.body.leadId, type: "Assignment Flag" }
    }) as any;
    expect(activity).not.toBeNull();
    expect(activity.outcome).toContain("Gwen Stacy");
  });

  it("should fall through to least-workload when multiple names are mentioned (ambiguous match)", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const repA = await sequelize.models.User.create({
      id: "00000000-0000-0000-0000-00000000000a",
      name: "Alice Rep",
      email: `alice_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true
    }) as any;

    const repB = await sequelize.models.User.create({
      id: "00000000-0000-0000-0000-00000000000b",
      name: "Bob Rep",
      email: `bob_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true
    }) as any;

    const payload = {
      from: "Ambiguous Client <ambig.client@example.com>",
      to: "face@123.com",
      subject: "Comparison Query",
      text: "Should I talk to Alice or Bob for this deal?"
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignmentMethod).toBe("least-workload");
  });

  it("should exclude unavailable users (isAvailable: false) from least-workload even if they have 0 leads", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    
    // Create an unavailable user with 0 leads
    const unavailableRep = await sequelize.models.User.create({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Unavailable Zero Lead Rep",
      email: `unavailable_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: false
    }) as any;

    // Create an available user
    const availableRep = await sequelize.models.User.create({
      id: "00000000-0000-0000-0000-000000000002",
      name: "Available Workhorse",
      email: `available_${require('crypto').randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true
    }) as any;

    const payload = {
      from: "Unavail Client <unavail.client@example.com>",
      to: "face@123.com",
      subject: "Random Inquiry",
      text: "Generic inquiry for team."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignmentMethod).toBe("least-workload");
    expect(response.body.assignedToId).not.toBe(unavailableRep.id);
  });

  it("should process Mailgun multipart/form-data payloads with sender, recipient, stripped-text", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const mailgunRep = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Mailgun Target Rep",
      email: `mailgun_${require('crypto').randomUUID()}@nexus.com`,
      emailAlias: "mgalias",
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .field("sender", "Mailgun Client <mgclient@example.com>")
      .field("recipient", "face+mgalias@123.com")
      .field("subject", "Mailgun Multipart Quote")
      .field("stripped-text", "Hello, this is a test via Mailgun multipart.");

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(mailgunRep.id);
    expect(response.body.assignmentMethod).toBe("plus-tag");

    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.email).toBe("mgclient@example.com");
    expect(createdLead.body).toBe("Hello, this is a test via Mailgun multipart.");
  });

  it("should process Mailgun urlencoded payloads with body-plain fallback", async () => {
    const response = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .type("form")
      .send({
        sender: "UrlEncoded Client <urlclient@example.com>",
        recipient: "face@123.com",
        subject: "UrlEncoded Inquiry",
        "body-plain": "Inquiry text via urlencoded form body."
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Inbound email ingested successfully");

    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.email).toBe("urlclient@example.com");
    expect(createdLead.body).toBe("Inquiry text via urlencoded form body.");
  });
});

describe("E2E: Intent Filter Gate", () => {
  let transporter: any;
  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET || "nexus-jwt-secret-dev";

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = "test_secret";
    process.env.INTENT_FILTER_MODE = "enforce";
    process.env.INTENT_FILTER_CHANNELS = "email";

    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport();

    const { _setModerationHandler } = require("../../src/lead-security-layer/aiModeration");
    _setModerationHandler(async () => ({ flagged: false, category: "none" }));
  });

  beforeEach(() => {
    transporter.sendMail.mockClear();
    process.env.INTENT_FILTER_MODE = "enforce";
    process.env.INTENT_AUTOREPLY_ENABLED = "false";

    const { _setIntentHandler } = require("../../src/lead-security-layer/intentFilter/intentClassifier");
    _setIntentHandler(async () => ({
      label: "new_enquiry",
      leadScore: 85,
      confidence: "high",
      language: "en",
      reason: "Mock default enquiry"
    }));
  });

  it("should archive newsletter with List-Unsubscribe and create no lead", async () => {
    const unsubEmail = `unsub_${require('crypto').randomUUID()}@marketing.com`;
    const payload = {
      from: `Promo Newsletter <${unsubEmail}>`,
      to: "sales@nexus.com",
      subject: "50% Off Everything This Weekend!",
      text: "Check out our weekly specials at https://example.com/specials",
      headers: "Received: from mail.example.com\nList-Unsubscribe: <mailto:unsub@example.com>\nContent-Type: text/plain"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("archived");
    expect(res.body.action).toBe("ARCHIVE");

    const lead = await sequelize.models.Lead.findOne({ where: { email: unsubEmail } });
    expect(lead).toBeNull();

    const flagged = (await sequelize.models.FlaggedLead.findOne({ where: { senderEmail: unsubEmail } })) as any;
    expect(flagged).not.toBeNull();
    expect(flagged.disposition).toBe("archived");
    expect(flagged.intentLabel).toBe("newsletter");
  });

  it("should hold 'hi' email as pending_clarification and create no lead", async () => {
    const hiEmail = `hi_${require('crypto').randomUUID()}@personal.com`;
    const payload = {
      from: `Human <${hiEmail}>`,
      to: "sales@nexus.com",
      subject: "Hi",
      text: "hi"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("held");
    expect(res.body.action).toBe("PENDING_CLARIFY");
    expect(res.body.disposition).toBe("pending_clarification");

    const lead = await sequelize.models.Lead.findOne({ where: { email: hiEmail } });
    expect(lead).toBeNull();

    const flagged = (await sequelize.models.FlaggedLead.findOne({ where: { senderEmail: hiEmail } })) as any;
    expect(flagged).not.toBeNull();
    expect(flagged.disposition).toBe("pending_clarification");
  });

  it("should create lead for genuine prospective enquiry", async () => {
    const buyerEmail = `buyer_${require('crypto').randomUUID()}@construction-corp.com`;
    const { _setIntentHandler } = require("../../src/lead-security-layer/intentFilter/intentClassifier");
    _setIntentHandler(async () => ({
      label: "new_enquiry",
      leadScore: 92,
      confidence: "high",
      language: "en",
      reason: "High intent site cabin enquiry"
    }));

    const payload = {
      from: `Sarah Connor <${buyerEmail}>`,
      to: "sales@nexus.com",
      subject: "Quotation request for 20 prefabricated cabins",
      text: "We require 20 modular site cabins delivered to Riyadh next month. Please send specs and pricing."
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeDefined();

    const lead = (await sequelize.models.Lead.findOne({ where: { email: buyerEmail } })) as any;
    expect(lead).not.toBeNull();
    expect(lead.id).toBe(res.body.leadId);
  });

  it("should attach Activity to existing open lead on reply and create no new lead", async () => {
    const clientEmail = `prospect_${require('crypto').randomUUID()}@company.com`;
    const initialLead = (await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName: "Existing",
      lastName: "Prospect",
      email: clientEmail,
      status: "New",
      source: "email"
    })) as any;

    const payload = {
      from: `Existing Prospect <${clientEmail}>`,
      to: "sales@nexus.com",
      subject: "Re: Following up on our discussion",
      text: "Thanks for the discussion earlier. When can we schedule the site inspection for the modular project?"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("attached");
    expect(res.body.action).toBe("ATTACH_EXISTING");
    expect(res.body.leadId).toBe(initialLead.id);

    // Verify only 1 lead exists for this email
    const count = await sequelize.models.Lead.count({ where: { email: clientEmail } });
    expect(count).toBe(1);

    // Verify activity attached
    const activity = (await sequelize.models.Activity.findOne({
      where: { leadId: initialLead.id, type: "email" }
    })) as any;
    expect(activity).not.toBeNull();
    expect(activity.outcome).toContain("Re: Following up");
  });

  it("should fail-safe to REVIEW when classifier experiences an outage (no lead created, nothing dropped)", async () => {
    const { _setIntentHandler } = require("../../src/lead-security-layer/intentFilter/intentClassifier");
    _setIntentHandler(async () => {
      throw new Error("AI provider upstream 504 Gateway Timeout");
    });

    const outageEmail = `outage_${require('crypto').randomUUID()}@client.com`;
    const payload = {
      from: `Uncertain Client <${outageEmail}>`,
      to: "sales@nexus.com",
      subject: "Question regarding modular solutions",
      text: "Could someone provide more details regarding your industrial cabins?"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("held");
    expect(res.body.action).toBe("REVIEW");

    const lead = await sequelize.models.Lead.findOne({ where: { email: outageEmail } });
    expect(lead).toBeNull();

    const flagged = (await sequelize.models.FlaggedLead.findOne({ where: { senderEmail: outageEmail } })) as any;
    expect(flagged).not.toBeNull();
    expect(flagged.disposition).toBe("review");
    expect(flagged.explanation.toLowerCase()).toContain("timeout");
  });

  it("should log decision with wouldHaveBlocked=true in shadow mode while still creating the lead", async () => {
    process.env.INTENT_FILTER_MODE = "shadow";
    const shadowEmail = `shadow_${require('crypto').randomUUID()}@weeklynewsletter.com`;
    const payload = {
      from: `Weekly Digest <${shadowEmail}>`,
      to: "sales@nexus.com",
      subject: "Industry Insights Weekly",
      text: "Read our weekly articles at https://newsletter.com/read",
      headers: "List-Unsubscribe: <https://newsletter.com/unsub>"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeDefined();

    const decision = (await sequelize.models.IntentDecision.findOne({
      where: { senderEmail: shadowEmail }
    })) as any;
    expect(decision).not.toBeNull();
    expect(decision.wouldHaveBlocked).toBe(true);
    expect(decision.enforced).toBe(false);
    expect(decision.action).toBe("ARCHIVE");

    process.env.INTENT_FILTER_MODE = "enforce";
  });

  it("should send clarification auto-reply respecting cooldown and loop safety", async () => {
    process.env.INTENT_FILTER_MODE = "enforce";
    process.env.INTENT_AUTOREPLY_ENABLED = "true";
    process.env.INTENT_AUTOREPLY_COOLDOWN_DAYS = "7";
    transporter.sendMail.mockClear();

    const autoEmail = `auto_${require('crypto').randomUUID()}@inquirer.com`;

    // 1. First "hi" sends auto-reply
    const res1 = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send({
        from: `Inquirer <${autoEmail}>`,
        to: "sales@nexus.com",
        subject: "Hello",
        text: "hi"
      });
    expect(res1.status).toBe(202);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    const sentArgs = transporter.sendMail.mock.calls[0][0];
    expect(sentArgs.to).toBe(autoEmail);
    expect(sentArgs.headers?.["Auto-Submitted"]).toBe("auto-replied");
    expect(sentArgs.headers?.["X-Auto-Response-Suppress"]).toBe("All");

    transporter.sendMail.mockClear();

    // 2. Second "hello" within cooldown does NOT send duplicate auto-reply
    const res2 = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send({
        from: `Inquirer <${autoEmail}>`,
        to: "sales@nexus.com",
        subject: "Follow-up",
        text: "hello team"
      });
    expect(res2.status).toBe(202);
    expect(transporter.sendMail).not.toHaveBeenCalled();

    // 3. Loop safety: bulk auto-header prevents auto-reply
    transporter.sendMail.mockClear();
    const bulkAutoEmail = `bulkauto_${require('crypto').randomUUID()}@newsletter.com`;
    await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send({
        from: `Promo <${bulkAutoEmail}>`,
        to: "sales@nexus.com",
        subject: "Weekly Promo",
        text: "hi promo",
        headers: "List-Unsubscribe: <https://promo.com/unsub>"
      });
    expect(transporter.sendMail).not.toHaveBeenCalled();

    process.env.INTENT_AUTOREPLY_ENABLED = "false";
  });

  it("should bypass filter for allowlisted sender", async () => {
    const allowEmail = `vip_${require('crypto').randomUUID()}@strategic-partner.com`;
    await sequelize.models.SenderRule.create({
      id: require('crypto').randomUUID(),
      type: "allow",
      matchType: "email",
      value: allowEmail,
      note: "Strategic VIP partner"
    });

    // Send "hi" which would normally be held as pending_clarification
    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send({
        from: `VIP Partner <${allowEmail}>`,
        to: "sales@nexus.com",
        subject: "Hi",
        text: "hi"
      });

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeDefined();

    const lead = await sequelize.models.Lead.findOne({ where: { email: allowEmail } });
    expect(lead).not.toBeNull();
  });

  it("should allow promoting a held email via the promote API and bypass re-filtering", async () => {
    const adminToken = jwt.sign(
      { id: "00000000-0000-0000-0000-000000000000", role: "admin", name: "Admin User" },
      JWT_SECRET
    );

    const heldEmail = `held_${require('crypto').randomUUID()}@customer.com`;
    const flaggedLead = (await sequelize.models.FlaggedLead.create({
      id: require('crypto').randomUUID(),
      source: "email",
      channel: "email",
      disposition: "review",
      intentLabel: "too_vague",
      intentScore: 40,
      reason: "Short inquiry held for review",
      explanation: "Short inquiry held for review",
      senderEmail: heldEmail,
      subject: "Inquiry about cabins",
      payload: {
        from: `Held Prospect <${heldEmail}>`,
        subject: "Inquiry about cabins",
        text: "We are interested in cabins."
      }
    })) as any;

    const promoteRes = await request(app)
      .post(`/api/v1/lead-filter/held/${flaggedLead.id}/promote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ addSenderToAllowlist: true });

    expect([200, 201]).toContain(promoteRes.status);
    expect(promoteRes.body.success).toBe(true);
    expect(promoteRes.body.lead).toBeDefined();
    expect(promoteRes.body.lead.email).toBe(heldEmail);

    // Verify FlaggedLead updated
    const updatedFlagged = (await sequelize.models.FlaggedLead.findByPk(flaggedLead.id)) as any;
    expect(updatedFlagged.disposition).toBe("promoted");
    expect(updatedFlagged.promotedLeadId).toBe(promoteRes.body.lead.id);

    // Verify sender rule created
    const allowRule = await sequelize.models.SenderRule.findOne({
      where: { matchType: "email", value: heldEmail, type: "allow" }
    });
    expect(allowRule).not.toBeNull();
  });
});

describe("E2E: Intent Filter Fail-Safe & Resilience", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.INTENT_FILTER_MODE = "enforce";
  });

  it("should still create lead in shadow mode even if IntentDecisions write throws a DB error", async () => {
    process.env.INTENT_FILTER_MODE = "shadow";
    jest.spyOn(sequelize.models.IntentDecision, "create").mockRejectedValue(
      new Error("Simulated SQLite failure: IntentDecisions table locked")
    );

    const testEmail = `shadow_fail_${require('crypto').randomUUID()}@company.com`;
    const payload = {
      from: `Client <${testEmail}>`,
      to: "sales@nexus.com",
      subject: "Inquiry under DB failure",
      text: "Please send quote for modular units."
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeDefined();

    const created = await sequelize.models.Lead.findOne({ where: { email: testEmail } });
    expect(created).not.toBeNull();
  });

  it("should still create lead in off mode even if IntentDecisions write throws a DB error", async () => {
    process.env.INTENT_FILTER_MODE = "off";
    jest.spyOn(sequelize.models.IntentDecision, "create").mockRejectedValue(
      new Error("Simulated SQLite failure: table missing")
    );

    const testEmail = `off_fail_${require('crypto').randomUUID()}@company.com`;
    const payload = {
      from: `Client <${testEmail}>`,
      to: "sales@nexus.com",
      subject: "Inquiry in off mode",
      text: "Please send quote for modular units."
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeDefined();

    const created = await sequelize.models.Lead.findOne({ where: { email: testEmail } });
    expect(created).not.toBeNull();
  });

  it("should fall back to REVIEW without 5xx in enforce mode even if FlaggedLeads write throws a DB error", async () => {
    process.env.INTENT_FILTER_MODE = "enforce";
    jest.spyOn(sequelize.models.FlaggedLead, "create").mockRejectedValue(
      new Error("Simulated SQLite failure: FlaggedLeads write disk full")
    );

    const testEmail = `enforce_fail_${require('crypto').randomUUID()}@company.com`;
    const payload = {
      from: `Human <${testEmail}>`,
      to: "sales@nexus.com",
      subject: "Hi",
      text: "hi"
    };

    const res = await request(app)
      .post("/api/v1/emails/inbound?auth_token=test_secret")
      .send(payload);

    // Must return 202 without throwing 5xx or unhandled rejection
    expect(res.status).toBe(202);
    expect(["held", "archived"]).toContain(res.body.status);
    expect(res.body.action).toBeDefined();

    // Verify lead was NOT created for content-free greeting
    const created = await sequelize.models.Lead.findOne({ where: { email: testEmail } });
    expect(created).toBeNull();
  });
});
