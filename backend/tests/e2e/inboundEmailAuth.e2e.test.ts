import request from "supertest";
import crypto from "crypto";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";

const app = createServer();

describe("E2E: Inbound Email Webhook Authentication Security", () => {
  const TEST_SHARED_SECRET = "inbound_shared_secret_e2e_verified";
  const TEST_MAILGUN_SIGNING_KEY = "mailgun_signing_key_e2e_verified";

  let defaultAdmin: any;

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = TEST_SHARED_SECRET;
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = TEST_MAILGUN_SIGNING_KEY;

    // Ensure default user exists for Activity / foreign key constraints
    try {
      const hashedPassword = await require("bcryptjs").hash("password123", 10);
      defaultAdmin = await sequelize.models.User.findOne({ where: { email: "admin@nexus.com" } });
      if (!defaultAdmin) {
        defaultAdmin = await sequelize.models.User.create({
          id: crypto.randomUUID(),
          name: "Default Admin",
          email: "admin@nexus.com",
          password: hashedPassword,
          role: "admin"
        });
      }
    } catch (e) {}

    // Ensure lead_acknowledgement template exists
    try {
      const existing = await sequelize.models.MessageTemplate.findOne({
        where: { name: "lead_acknowledgement", channel: "email" }
      });
      if (!existing) {
        await sequelize.models.MessageTemplate.create({
          id: crypto.randomUUID(),
          name: "lead_acknowledgement",
          channel: "email",
          subject: "Welcome to Nexus CRM",
          body: "Hi {{lead_name}}, we have received your request."
        });
      }
    } catch (e) {}
  });

  const getCounts = async () => {
    const leads = await sequelize.models.Lead.count();
    const activities = await sequelize.models.Activity.count();
    return { leads, activities };
  };

  const createSamplePayload = (senderTag: string) => ({
    from: `Inbound Sender <sender_${senderTag}_${Date.now()}@example.com>`,
    to: "sales@nexus.com",
    subject: `Inbound Test ${senderTag}`,
    text: `Test body for inbound auth verification (${senderTag})`
  });

  describe("Shared Secret Authentication", () => {
    it("should reject with 401 when no token is provided and create no lead or activity", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("no_token");

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject with 401 when a wrong token is provided in query param and create no lead or activity", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("wrong_token_query");

      const response = await request(app)
        .post("/api/v1/emails/inbound?auth_token=invalid_token_12345")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject with 401 when a wrong token is provided in header and create no lead or activity", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("wrong_token_header");

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .set("X-Inbound-Secret", "wrong_header_secret_xyz")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject former hard-coded default 'nexus_inbound_email_secret_2026' with 401 and create no lead or activity", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("former_default_1");

      const queryRes = await request(app)
        .post("/api/v1/emails/inbound?auth_token=nexus_inbound_email_secret_2026")
        .send(payload);

      expect(queryRes.status).toBe(401);
      expect(queryRes.body.error).toContain("Unauthorized");

      const headerRes = await request(app)
        .post("/api/v1/emails/inbound")
        .set("X-Inbound-Secret", "nexus_inbound_email_secret_2026")
        .send(payload);

      expect(headerRes.status).toBe(401);
      expect(headerRes.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject former hard-coded default 'dev_secret' with 401 and create no lead or activity", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("former_default_2");

      const queryRes = await request(app)
        .post("/api/v1/emails/inbound?auth_token=dev_secret")
        .send(payload);

      expect(queryRes.status).toBe(401);
      expect(queryRes.body.error).toContain("Unauthorized");

      const headerRes = await request(app)
        .post("/api/v1/emails/inbound")
        .set("X-Inbound-Secret", "dev_secret")
        .send(payload);

      expect(headerRes.status).toBe(401);
      expect(headerRes.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should authorize with 201 when correct secret is provided via query param", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("correct_secret_query");

      const response = await request(app)
        .post(`/api/v1/emails/inbound?auth_token=${TEST_SHARED_SECRET}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Inbound email ingested successfully");
      expect(response.body.leadId).toBeDefined();

      const after = await getCounts();
      expect(after.leads).toBe(before.leads + 1);
    });

    it("should authorize with 201 when correct secret is provided via X-Inbound-Secret header", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("correct_secret_header");

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .set("X-Inbound-Secret", TEST_SHARED_SECRET)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Inbound email ingested successfully");
      expect(response.body.leadId).toBeDefined();

      const after = await getCounts();
      expect(after.leads).toBe(before.leads + 1);
    });

    it("should authorize with 201 when correct secret is provided via Authorization Bearer header", async () => {
      const before = await getCounts();
      const payload = createSamplePayload("correct_secret_bearer");

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .set("Authorization", `Bearer ${TEST_SHARED_SECRET}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Inbound email ingested successfully");
      expect(response.body.leadId).toBeDefined();

      const after = await getCounts();
      expect(after.leads).toBe(before.leads + 1);
    });
  });

  describe("Mailgun Signature Authentication", () => {
    const generateMailgunSignature = (timestamp: number, token: string, key = TEST_MAILGUN_SIGNING_KEY) => {
      return crypto
        .createHmac("sha256", key)
        .update(`${timestamp}${token}`)
        .digest("hex");
    };

    it("should authorize with 201 when request carries a valid Mailgun signature in form-data", async () => {
      const before = await getCounts();
      const timestamp = Math.floor(Date.now() / 1000);
      const token = crypto.randomBytes(16).toString("hex");
      const signature = generateMailgunSignature(timestamp, token);
      const uniqueSender = `mg_form_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .field("from", `Mailgun Client <${uniqueSender}>`)
        .field("to", "sales@nexus.com")
        .field("subject", "Mailgun Valid Sig Test")
        .field("stripped-text", "Valid Mailgun inbound payload")
        .field("timestamp", String(timestamp))
        .field("token", token)
        .field("signature", signature);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Inbound email ingested successfully");
      expect(response.body.leadId).toBeDefined();

      const after = await getCounts();
      expect(after.leads).toBe(before.leads + 1);
    });

    it("should authorize with 201 when request carries a valid Mailgun signature in nested signature object", async () => {
      const before = await getCounts();
      const timestamp = Math.floor(Date.now() / 1000);
      const token = crypto.randomBytes(16).toString("hex");
      const signature = generateMailgunSignature(timestamp, token);
      const uniqueSender = `mg_nested_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;

      const payload = {
        from: `Mailgun Nested <${uniqueSender}>`,
        to: "sales@nexus.com",
        subject: "Mailgun Nested Sig Test",
        text: "Nested signature payload",
        signature: {
          timestamp,
          token,
          signature
        }
      };

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Inbound email ingested successfully");
      expect(response.body.leadId).toBeDefined();

      const after = await getCounts();
      expect(after.leads).toBe(before.leads + 1);
    });

    it("should reject with 401 when Mailgun timestamp is older than 5 minutes (stale) and create no lead or activity", async () => {
      const before = await getCounts();
      // 305 seconds ago (> 300 seconds / 5 minutes)
      const staleTimestamp = Math.floor(Date.now() / 1000) - 305;
      const token = crypto.randomBytes(16).toString("hex");
      const signature = generateMailgunSignature(staleTimestamp, token);

      const payload = {
        from: "Mailgun Stale <stale@example.com>",
        to: "sales@nexus.com",
        subject: "Mailgun Stale Sig Test",
        text: "Stale timestamp payload",
        timestamp: staleTimestamp,
        token,
        signature
      };

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject with 401 when Mailgun timestamp is skewed into future by > 5 minutes and create no lead or activity", async () => {
      const before = await getCounts();
      // 305 seconds into the future
      const futureTimestamp = Math.floor(Date.now() / 1000) + 305;
      const token = crypto.randomBytes(16).toString("hex");
      const signature = generateMailgunSignature(futureTimestamp, token);

      const payload = {
        from: "Mailgun Future <future@example.com>",
        to: "sales@nexus.com",
        subject: "Mailgun Future Sig Test",
        text: "Future timestamp payload",
        timestamp: futureTimestamp,
        token,
        signature
      };

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject with 401 when Mailgun signature is invalid / signed with wrong key and create no lead or activity", async () => {
      const before = await getCounts();
      const timestamp = Math.floor(Date.now() / 1000);
      const token = crypto.randomBytes(16).toString("hex");
      // Generated with completely wrong key
      const wrongSignature = generateMailgunSignature(timestamp, token, "wrong_signing_key_999");

      const payload = {
        from: "Mailgun Invalid <invalid@example.com>",
        to: "sales@nexus.com",
        subject: "Mailgun Invalid Sig Test",
        text: "Invalid signature payload",
        timestamp,
        token,
        signature: wrongSignature
      };

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });

    it("should reject with 401 when Mailgun signature is malformed hex and create no lead or activity", async () => {
      const before = await getCounts();
      const timestamp = Math.floor(Date.now() / 1000);
      const token = crypto.randomBytes(16).toString("hex");

      const payload = {
        from: "Mailgun Malformed <malformed@example.com>",
        to: "sales@nexus.com",
        subject: "Mailgun Malformed Sig Test",
        text: "Malformed signature payload",
        timestamp,
        token,
        signature: "not_a_valid_hex_signature"
      };

      const response = await request(app)
        .post("/api/v1/emails/inbound")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Unauthorized");

      const after = await getCounts();
      expect(after.leads).toBe(before.leads);
      expect(after.activities).toBe(before.activities);
    });
  });

  describe("Fail-closed behavior when neither secret is configured", () => {
    it("should fail closed (401) when neither INBOUND_EMAIL_SECRET nor MAILGUN_WEBHOOK_SIGNING_KEY is set", async () => {
      const origSecret = process.env.INBOUND_EMAIL_SECRET;
      const origMgKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

      delete process.env.INBOUND_EMAIL_SECRET;
      delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

      const before = await getCounts();
      const payload = createSamplePayload("unconfigured_env");

      try {
        const response = await request(app)
          .post("/api/v1/emails/inbound?auth_token=some_token")
          .send(payload);

        expect(response.status).toBe(401);
        expect(response.body.error).toContain("Unauthorized");

        const after = await getCounts();
        expect(after.leads).toBe(before.leads);
        expect(after.activities).toBe(before.activities);
      } finally {
        process.env.INBOUND_EMAIL_SECRET = origSecret;
        process.env.MAILGUN_WEBHOOK_SIGNING_KEY = origMgKey;
      }
    });
  });
});
