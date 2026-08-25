import { receiveInstagramMessage } from "../../src/controllers/instagramController";
import { handleIncomingWebhook } from "../../src/controllers/whatsappController";
import { sequelize } from "@nexus-crm/database";

describe("Inbound Messaging & Lead Intake Tests (WhatsApp & Instagram)", () => {
  beforeAll(async () => {
    // Sync models
    sequelize.models.Notification = {
      create: jest.fn().mockResolvedValue({ id: "notif-1" })
    } as any;
    sequelize.models.Activity = {
      create: jest.fn().mockImplementation(async (data: any) => ({ ...data, id: "act-123" })),
      findOne: jest.fn().mockResolvedValue(null)
    } as any;
    sequelize.models.Lead = {
      create: jest.fn().mockImplementation(async (data: any) => ({ ...data, id: "lead-999-inbound" })),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(5)
    } as any;
    sequelize.models.WebhookEvent = {
      create: jest.fn().mockResolvedValue({ id: "evt-1" }),
      update: jest.fn().mockResolvedValue([1])
    } as any;
    sequelize.models.User = {
      findOne: jest.fn().mockResolvedValue({ id: "admin-id-1" }),
      findByPk: jest.fn().mockResolvedValue({ id: "admin-id-1", name: "Admin" })
    } as any;
  });

  test("1. Raw Instagram Webhook message properly creates a Lead with leadId on Activity", async () => {
    const req = {
      body: {
        senderId: "ig_user_12345",
        instagramUsername: "xain_test_user",
        senderName: "Xain Ahmed",
        text: "Hi, interested in commercial equipment quotation"
      },
      query: {
        auth_token: "nexus_instagram_gateway_secret_2026"
      },
      headers: {
        "x-instagram-gateway-secret": "nexus_instagram_gateway_secret_2026"
      }
    } as any;

    let resJsonData: any = null;
    let resStatus: number = 200;
    const res = {
      status: (s: number) => {
        resStatus = s;
        return {
          json: (d: any) => { resJsonData = d; return d; },
          send: (d: any) => { resJsonData = d; return d; }
        };
      }
    } as any;

    await receiveInstagramMessage(req, res);

    expect(resStatus).toBe(200);
    expect(resJsonData.success).toBe(true);
    expect(resJsonData.leads[0].leadId).toBeDefined();
    expect(sequelize.models.Activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "instagram_dm",
        outcome: "message received",
        leadId: expect.any(String),
        direction: "inbound"
      })
    );
  });

  test("2. Twilio WhatsApp Webhook properly creates/finds Lead with leadId on Activity", async () => {
    const req = {
      body: {
        MessageSid: "SM_test_whatsapp_12345",
        From: "whatsapp:+966509998888",
        ProfileName: "Rahul Sharma",
        Body: "Hello, need price quote for industrial equipment"
      },
      headers: {}
    } as any;

    let sentText: string = "";
    let resStatus: number = 200;
    const res = {
      status: (s: number) => {
        resStatus = s;
        return {
          send: (d: any) => { sentText = d; return d; },
          type: () => ({ send: (d: any) => { sentText = d; return d; } })
        };
      },
      headersSent: false
    } as any;

    await handleIncomingWebhook(req, res);

    expect(sequelize.models.Activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "whatsapp_sms",
        outcome: "message received",
        leadId: expect.any(String),
        direction: "inbound"
      })
    );
  });
});
