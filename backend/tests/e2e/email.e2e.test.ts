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
});
