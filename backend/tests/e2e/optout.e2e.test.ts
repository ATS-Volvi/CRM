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
    // Commit cba67d68a8 & 86a4e64089: Two-step unsubscribe flow where GET returns confirmation form
    const getRes = await request(app).get(`/api/v1/leads/unsubscribe/${leadId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.text).toContain("Unsubscribe Confirmation");
    expect(getRes.text).toContain("Unsubscribe from Emails");

    // Commit cba67d68a8 & 86a4e64089: POST confirms unsubscribe and sets optedOutEmail to true
    const postRes = await request(app).post(`/api/v1/leads/unsubscribe/${leadId}`);
    expect(postRes.status).toBe(200);
    expect(postRes.text).toContain("Unsubscribed Successfully");

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
