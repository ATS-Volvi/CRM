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
    nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport();
    
    // Create a default user to satisfy Activity foreign key constraint
    try {
      await sequelize.models.User.create({
        id: require('crypto').randomUUID(),
        name: "Default Admin",
        email: "admin@nexus.com",
        password: "password123",
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

  it("should assign lead directly to salesperson if email is addressed to their email address", async () => {
    // Create a known salesperson
    const userEmail = `sales_rep_${require('crypto').randomUUID()}@nexus.com`;
    const salesperson = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Test Rep Direct",
      email: userEmail,
      password: "password123",
      role: "sales_rep"
    }) as any;

    const payload = {
      from: "Client <client@example.com>",
      to: `Test Rep <${userEmail}>`,
      subject: "Direct Help",
      text: "Need your direct assistance."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.assignedToId).toBe(salesperson.id);

    // Verify recipientEmail field is saved
    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.recipientEmail).toBe(userEmail);
  });

  it("should fallback to default routing if recipient email does not match a known salesperson", async () => {
    const payload = {
      from: "Client <client@example.com>",
      to: "generic-inbox@nexus-crm.com",
      subject: "General Query",
      text: "Need general info."
    };

    const response = await request(app)
      .post("/api/v1/emails/inbound")
      .send(payload);

    expect(response.status).toBe(201);
    
    // Verify recipientEmail field is saved even if fallback is used
    const createdLead = await sequelize.models.Lead.findByPk(response.body.leadId) as any;
    expect(createdLead.recipientEmail).toBe("generic-inbox@nexus-crm.com");
  });
});
