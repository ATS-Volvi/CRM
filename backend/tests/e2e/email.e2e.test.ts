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
    
    // Create a default user to satisfy Activity foreign key constraint
    try {
      const hashedPassword = await require("bcrypt").hash("password123", 10);
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
      from: "Client <client@example.com>",
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
      where: { leadId: response.body.leadId }
    }) as any;
    expect(activity).not.toBeNull();
    expect(activity.outcome).toContain("Gwen Stacy");
  });

  it("should fall through to least-workload when multiple names are mentioned (ambiguous match)", async () => {
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
      from: "Client <client@example.com>",
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
    
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
      from: "Client <client@example.com>",
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
    const hashedPassword = await require("bcrypt").hash("password123", 10);
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
