import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import { triggerTemplatedEmail } from "../../src/services/emailService";

const app = createServer();

jest.mock("nodemailer", () => {
  const sendMailMock = jest.fn().mockResolvedValue({ messageId: "mock-id" });
  return {
    createTransport: jest.fn().mockReturnValue({ sendMail: sendMailMock })
  };
});

describe("E2E: Unsubscribe Compliance", () => {
  let nodemailer: any;
  let transporter: any;
  let leadId: string;

  beforeAll(async () => {
    nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport();

    const lead = await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName: "Opt",
      lastName: "Out",
      email: "optout.e2e@example.com"
    });
    leadId = (lead as any).id;

    await sequelize.models.MessageTemplate.findOrCreate({
      where: { name: 'test_optout_template' },
      defaults: {
        id: require('crypto').randomUUID(),
        name: 'test_optout_template',
        channel: 'email',
        subject: 'Spam',
        body: 'Spam content'
      }
    });
  });

  beforeEach(() => {
    transporter.sendMail.mockClear();
  });

  it("should mark lead as opted out via public API", async () => {
    const res = await request(app).get(`/api/v1/leads/unsubscribe/${leadId}`);
    
    expect(res.status).toBe(200);
    expect(res.text).toContain("Unsubscribed Successfully");

    const updatedLead = await sequelize.models.Lead.findByPk(leadId);
    expect((updatedLead as any).optedOutEmail).toBe(true);
  });

  it("should block subsequent emails to opted-out lead", async () => {
    // Attempt to send an email using the service directly
    await triggerTemplatedEmail("test_optout_template", "optout.e2e@example.com", {}, leadId);

    // The nodemailer transport should NOT have been called
    expect(transporter.sendMail).toHaveBeenCalledTimes(0);
  });
});
