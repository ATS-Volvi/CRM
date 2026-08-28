import request from "supertest";
import crypto from "crypto";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";

const app = createServer();

function computeSignature(payload: any, secret: string): string {
  const jsonStr = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(Buffer.from(jsonStr));
  return `sha256=${hmac.digest("hex")}`;
}

describe("E2E: Instagram Webhook Ingestion & Routing", () => {
  const APP_SECRET = "test_instagram_app_secret";
  const VERIFY_TOKEN = "test_instagram_verify_token";

  beforeAll(async () => {
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET;
    process.env.INSTAGRAM_VERIFY_TOKEN = VERIFY_TOKEN;

    try {
      const hashedPassword = await require("bcryptjs").hash("password123", 10);
      await sequelize.models.User.create({
        id: require("crypto").randomUUID(),
        name: "Default Admin",
        email: "admin_ig@nexus.com",
        password: hashedPassword,
        role: "admin"
      });
    } catch (e) {}
  });

  // -------------------------------------------------------------
  // GET Webhook Verification Handshake
  // -------------------------------------------------------------
  it("should return 200 plain text challenge on successful verification handshake without any Authorization header", async () => {
    const response = await request(app)
      .get("/api/v1/instagram/webhook")
      .unset("Authorization") // Assert zero user-session Authorization header present
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1158201444"
      });

    expect(response.status).toBe(200);
    expect(response.text).toBe("1158201444");
  });

  it("should return 403 when verify_token is invalid or missing during GET handshake", async () => {
    const wrongTokenRes = await request(app)
      .get("/api/v1/instagram/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_verify_token",
        "hub.challenge": "1158201444"
      });

    expect(wrongTokenRes.status).toBe(403);
    expect(wrongTokenRes.text).toContain("Forbidden");
  });

  // -------------------------------------------------------------
  // Fail-closed Signature Verification Checks
  // -------------------------------------------------------------
  it("should return 401 when signature header is missing or invalid", async () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "user_ig_101" },
              recipient: { id: "17841400000000000" },
              message: { text: "Hello team" }
            }
          ]
        }
      ]
    };

    // Missing signature header
    const noSigRes = await request(app)
      .post("/api/v1/instagram/webhook")
      .send(payload);

    expect(noSigRes.status).toBe(401);
    expect(noSigRes.body.error).toContain("Unauthorized: Invalid or missing Meta signature");

    // Invalid signature header
    const badSigRes = await request(app)
      .post("/api/v1/instagram/webhook")
      .set("x-hub-signature-256", "sha256=invalid_hex_signature")
      .send(payload);

    expect(badSigRes.status).toBe(401);
    expect(badSigRes.body.error).toContain("Unauthorized: Invalid or missing Meta signature");
  });

  it("should fail closed (401) when INSTAGRAM_APP_SECRET is unset, even if valid-looking signature is provided", async () => {
    const originalSecret = process.env.INSTAGRAM_APP_SECRET;
    delete process.env.INSTAGRAM_APP_SECRET;

    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "user_ig_102" },
              recipient: { id: "17841400000000000" },
              message: { text: "Unset secret test" }
            }
          ]
        }
      ]
    };

    const sig = computeSignature(payload, "some_secret");

    const response = await request(app)
      .post("/api/v1/instagram/webhook")
      .set("x-hub-signature-256", sig)
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("Unauthorized: Invalid or missing Meta signature");

    // Restore environment variable
    process.env.INSTAGRAM_APP_SECRET = "test_instagram_app_secret";
  });

  // -------------------------------------------------------------
  // Message Ingestion & Routing Checks
  // -------------------------------------------------------------
  it("should route Instagram DM by explicit Attn: mention to target salesperson", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const attnRep = await sequelize.models.User.create({
      id: require("crypto").randomUUID(),
      name: "Marcus Aurelius",
      email: `marcus_ig_${require("crypto").randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep"
    }) as any;

    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "user_ig_201" },
              recipient: { id: "17841400000000000" },
              message: { text: "Attn: Marcus I would like a quote for prefabricated cabins" }
            }
          ]
        }
      ]
    };

    const sig = computeSignature(payload, APP_SECRET);

    const response = await request(app)
      .post("/api/v1/instagram/webhook")
      .set("x-hub-signature-256", sig)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.processedCount).toBe(1);
    expect(response.body.leads[0].assignedToId).toBe(attnRep.id);
    expect(response.body.leads[0].assignmentMethod).toBe("attn-tag");

    // Verify lead attributes in database
    const createdLead = (await sequelize.models.Lead.findByPk(response.body.leads[0].leadId)) as any;
    expect(createdLead.source).toBe("instagram");
    expect(createdLead.email).toBeNull();
    expect(createdLead.sourceDetail).toBe("@user_ig_201");
    expect(createdLead.body).toBe("Attn: Marcus I would like a quote for prefabricated cabins");
  });

  it("should fall through to least-workload when multiple names are mentioned (ambiguous match)", async () => {
    const hashedPassword = await require("bcryptjs").hash("password123", 10);
    const repA = await sequelize.models.User.create({
      id: "10000000-0000-0000-0000-00000000000a",
      name: "Alice Rep",
      email: `alice_ig_${require("crypto").randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true
    }) as any;

    const repB = await sequelize.models.User.create({
      id: "10000000-0000-0000-0000-00000000000b",
      name: "Bob Rep",
      email: `bob_ig_${require("crypto").randomUUID()}@nexus.com`,
      password: hashedPassword,
      role: "sales_rep",
      isAvailable: true
    }) as any;

    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "user_ig_202" },
              recipient: { id: "17841400000000000" },
              message: { text: "Should I speak with Alice or Bob for pricing?" }
            }
          ]
        }
      ]
    };

    const sig = computeSignature(payload, APP_SECRET);

    const response = await request(app)
      .post("/api/v1/instagram/webhook")
      .set("x-hub-signature-256", sig)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.leads[0].assignmentMethod).toBe("least-workload");
    expect(response.body.leads[0].assignedToId).toBeTruthy();
  });

  it("should fall through to least-workload when no name is mentioned at all", async () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            {
              sender: { id: "user_ig_203" },
              recipient: { id: "17841400000000000" },
              message: { text: "Hi, please send catalog and pricing sheet." }
            }
          ]
        }
      ]
    };

    const sig = computeSignature(payload, APP_SECRET);

    const response = await request(app)
      .post("/api/v1/instagram/webhook")
      .set("x-hub-signature-256", sig)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.leads[0].assignmentMethod).toBe("least-workload");

    const createdLead = (await sequelize.models.Lead.findByPk(response.body.leads[0].leadId)) as any;
    expect(createdLead.source).toBe("instagram");
    expect(createdLead.email).toBeNull();
  });
  // -------------------------------------------------------------
  // Gateway Ingestion Checks (Zapier, Make, ManyChat, MessageBird)
  // -------------------------------------------------------------
  it("should return 401 when gateway secret is missing or invalid", async () => {
    process.env.INSTAGRAM_GATEWAY_SECRET = "test_gateway_secret";

    const payload = {
      senderId: "123",
      name: "Jane Doe",
      username: "jane.ig",
      text: "hi"
    };

    // Missing auth_token
    const noAuthRes = await request(app)
      .post("/api/v1/instagram/webhook")
      .send(payload);

    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.error).toContain("Invalid or missing gateway secret");

    // Invalid auth_token
    const badAuthRes = await request(app)
      .post("/api/v1/instagram/webhook?auth_token=wrong_token")
      .send(payload);

    expect(badAuthRes.status).toBe(401);
    expect(badAuthRes.body.error).toContain("Invalid or missing gateway secret");
  });

  it("should process flat JSON payload from third-party gateway when authenticated", async () => {
    process.env.INSTAGRAM_GATEWAY_SECRET = "test_gateway_secret";

    const payload = {
      senderId: "gateway_user_123",
      name: "Gateway Jane",
      username: "jane.gateway",
      text: "Hello from Zapier gateway!"
    };

    const response = await request(app)
      .post(`/api/v1/instagram/webhook?auth_token=test_gateway_secret`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.processedCount).toBe(1);

    const leadId = response.body.leads[0].leadId;
    const createdLead = (await sequelize.models.Lead.findByPk(leadId)) as any;
    
    expect(createdLead.source).toBe("instagram");
    expect(createdLead.sourceDetail).toBe("@jane.gateway");
    expect(createdLead.body).toBe("Hello from Zapier gateway!");
    
    const activity = (await sequelize.models.Activity.findOne({
      where: { leadId, type: "instagram_dm" }
    })) as any;
    
    expect(activity).not.toBeNull();
    expect(activity.notes).toBe("Hello from Zapier gateway!");
  });
});
