// Mock external modules before imports to support real controller/service test suites in Jest
jest.mock("sanitize-html", () => {
  return jest.fn((str: string) => str);
});

const mockSendWhatsAppTemplateMessage = jest.fn();
jest.mock("../../../backend/src/services/whatsappService", () => ({
  sendWhatsAppTemplateMessage: (...args: any[]) => mockSendWhatsAppTemplateMessage(...args)
}));

const mockModels = {
  Campaign: {
    findByPk: jest.fn()
  },
  CampaignMessage: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  CampaignRecipient: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Lead: {
    findByPk: jest.fn(),
    findAll: jest.fn()
  },
  LeadAttribution: {
    findAll: jest.fn()
  },
  Activity: {
    create: jest.fn()
  },
  Notification: {
    findOne: jest.fn(),
    create: jest.fn()
  }
};

jest.mock("@nexus-crm/database", () => ({
  sequelize: {
    models: mockModels
  },
  Database: {
    createConnection: jest.fn()
  }
}));

import {
  normalizePhone,
  isValidPhone,
  maskPhone,
  getCampaignWhatsAppConfig,
  renderWhatsAppTemplateVariables,
  filterLeadsForWhatsAppAudience,
  resumeMessageSend,
  processAsyncWhatsAppDelivery
} from "../../../backend/src/services/campaignMessageService";
import {
  sendCampaignMessage,
  resumeCampaignMessage
} from "../../../backend/src/controllers/campaignMessageController";

describe("Phase C: WhatsApp Campaign Messaging & Safety Engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CAMPAIGN_WHATSAPP_BATCH_DELAY_MS = "0";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("1. Phone Normalization & Validation (normalizePhone, isValidPhone, maskPhone)", () => {
    test("normalizes phones by stripping non-digit characters", () => {
      expect(normalizePhone("+1 (555) 234-5678")).toBe("15552345678");
      expect(normalizePhone("971-50-123-4567")).toBe("971501234567");
      expect(normalizePhone("+44 7911 123456")).toBe("447911123456");
      expect(normalizePhone("")).toBe("");
      expect(normalizePhone(null)).toBe("");
      expect(normalizePhone(undefined)).toBe("");
    });

    test("validates phone numbers (minimum 8 digits, maximum 15 digits)", () => {
      expect(isValidPhone("1234567")).toBe(false); // 7 digits
      expect(isValidPhone("+1 (555) 1234")).toBe(true); // 8 digits
      expect(isValidPhone("+971 50 123 4567")).toBe(true); // 12 digits
      expect(isValidPhone("123456789012345")).toBe(true); // 15 digits
      expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits
      expect(isValidPhone("")).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });

    test("masks phone numbers showing only last 4 digits", () => {
      expect(maskPhone("+1 (555) 234-5678")).toBe("•••••••5678");
      expect(maskPhone("1234")).toBe("1234");
      expect(maskPhone("")).toBe("");
    });
  });

  describe("2. Template Variable Rendering & Length Limiting", () => {
    test("renders placeholders {{firstName}}, {{lastName}}, {{company}}, {{campaignName}}", () => {
      const vars = {
        name: "{{firstName}} {{lastName}}",
        org: "{{company}}",
        event: "Welcome to {{campaignName}}"
      };
      const lead = {
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Babbage Engines"
      };
      const rendered = renderWhatsAppTemplateVariables(vars, lead, "Q4 Launch");

      expect(rendered.name).toBe("Ada Lovelace");
      expect(rendered.org).toBe("Babbage Engines");
      expect(rendered.event).toBe("Welcome to Q4 Launch");
    });

    test("handles missing or null lead fields gracefully with empty string", () => {
      const vars = {
        intro: "Hello {{firstName}} from {{company}}"
      };
      const lead = {};
      const rendered = renderWhatsAppTemplateVariables(vars, lead, "Outreach");

      expect(rendered.intro).toBe("Hello  from");
    });

    test("trims values and caps length to 1024 characters per variable", () => {
      const hugeValue = "A".repeat(1200);
      const vars = {
        msg: hugeValue
      };
      const rendered = renderWhatsAppTemplateVariables(vars, {}, "Test");

      expect(rendered.msg.length).toBe(1024);
      expect(rendered.msg).toBe("A".repeat(1024));
    });

    test("parses JSON string templateVariables if provided as text", () => {
      const jsonStr = JSON.stringify({ 1: "{{firstName}}", 2: "{{campaignName}}" });
      const rendered = renderWhatsAppTemplateVariables(jsonStr, { firstName: "Grace" }, "Winter Sale");

      expect(rendered["1"]).toBe("Grace");
      expect(rendered["2"]).toBe("Winter Sale");
    });
  });

  describe("3. WhatsApp Audience Exclusions (filterLeadsForWhatsAppAudience)", () => {
    test("excludes UNSPECIFIED consent leads (only OPTED_IN allowed)", () => {
      const leads = [
        { id: "1", phone: "+15551234567", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "2", phone: "+15551234568", whatsappConsentStatus: "UNSPECIFIED", optedOutWhatsapp: false },
        { id: "3", phone: "+15551234569", whatsappConsentStatus: null, optedOutWhatsapp: false }
      ];

      const result = filterLeadsForWhatsAppAudience(leads);
      expect(result.eligibleLeads.map((l) => l.id)).toEqual(["1"]);
      expect(result.excludedByReason.noConsent).toBe(2);
      expect(result.excludedCount).toBe(2);
    });

    test("excludes OPTED_OUT leads even if consent status is OPTED_IN", () => {
      const leads = [
        { id: "1", phone: "+15551234567", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: true },
        { id: "2", phone: "+15551234568", whatsappConsentStatus: "OPTED_OUT", optedOutWhatsapp: true },
        { id: "3", phone: "+15551234569", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false }
      ];

      const result = filterLeadsForWhatsAppAudience(leads);
      expect(result.eligibleLeads.map((l) => l.id)).toEqual(["3"]);
      expect(result.excludedByReason.optedOut).toBe(2);
      expect(result.excludedByReason.noConsent).toBe(0);
    });

    test("excludes leads with no phone number", () => {
      const leads = [
        { id: "1", phone: "", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "2", phone: null, whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "3", phone: "+15551234567", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false }
      ];

      const result = filterLeadsForWhatsAppAudience(leads);
      expect(result.eligibleLeads.map((l) => l.id)).toEqual(["3"]);
      expect(result.excludedByReason.noPhone).toBe(2);
    });

    test("excludes leads with invalid phone numbers (< 8 digits)", () => {
      const leads = [
        { id: "1", phone: "123-456", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false }, // 6 digits
        { id: "2", phone: "abc-def", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false }, // 0 digits
        { id: "3", phone: "+1 (555) 234-5678", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false } // 11 digits
      ];

      const result = filterLeadsForWhatsAppAudience(leads);
      expect(result.eligibleLeads.map((l) => l.id)).toEqual(["3"]);
      expect(result.excludedByReason.invalidPhone).toBe(2);
    });

    test("deduplicates leads with identical normalized phone numbers", () => {
      const leads = [
        { id: "1", phone: "+1 (555) 234-5678", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "2", phone: "15552345678", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "3", phone: "+1-555-234-5678", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false },
        { id: "4", phone: "+1 (555) 999-0000", whatsappConsentStatus: "OPTED_IN", optedOutWhatsapp: false }
      ];

      const result = filterLeadsForWhatsAppAudience(leads);
      expect(result.eligibleLeads.map((l) => l.id)).toEqual(["1", "4"]);
      expect(result.excludedByReason.duplicate).toBe(2);
    });

    test("excludes CLOSED_LOST and CONVERTED statuses unless explicitly requested", () => {
      const leads = [
        { id: "1", phone: "+15551111111", status: "NEW", whatsappConsentStatus: "OPTED_IN" },
        { id: "2", phone: "+15552222222", status: "CLOSED_LOST", whatsappConsentStatus: "OPTED_IN" },
        { id: "3", phone: "+15553333333", status: "CONVERTED", whatsappConsentStatus: "OPTED_IN" }
      ];

      const resultDefault = filterLeadsForWhatsAppAudience(leads);
      expect(resultDefault.eligibleLeads.map((l) => l.id)).toEqual(["1"]);
      expect(resultDefault.excludedByReason.closedStatus).toBe(2);

      const resultExplicit = filterLeadsForWhatsAppAudience(leads, { leadStatus: ["CONVERTED"] });
      expect(resultExplicit.eligibleLeads.map((l) => l.id)).toEqual(["3"]);
    });
  });

  describe("4. Safety Switches & Allowlist Phone Normalization", () => {
    test("CAMPAIGN_WHATSAPP_DRY_RUN defaults to true when unset or empty", () => {
      delete process.env.CAMPAIGN_WHATSAPP_DRY_RUN;
      expect(getCampaignWhatsAppConfig().dryRun).toBe(true);

      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "";
      expect(getCampaignWhatsAppConfig().dryRun).toBe(true);

      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";
      expect(getCampaignWhatsAppConfig().dryRun).toBe(true);

      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "TRUE";
      expect(getCampaignWhatsAppConfig().dryRun).toBe(true);
    });

    test("CAMPAIGN_WHATSAPP_DRY_RUN is false only when explicitly 'false'", () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "false";
      expect(getCampaignWhatsAppConfig().dryRun).toBe(false);

      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "FALSE";
      expect(getCampaignWhatsAppConfig().dryRun).toBe(false);
    });

    test("normalizes allowlist phone numbers (handles +, spaces, dashes)", () => {
      process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST = "+1 (555) 123-4567, 971-50-999-8888";
      const config = getCampaignWhatsAppConfig();

      expect(config.allowlistActive).toBe(true);
      expect(config.allowlist).toEqual(["15551234567", "971509998888"]);
    });
  });

  describe("5. Dry Run Safety Enforcement (Zero Twilio API Calls)", () => {
    test("never calls sendWhatsAppTemplateMessage when dry run is true", async () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";

      const mockMsg: any = {
        id: "msg-wa-dry-1",
        campaignId: "camp-1",
        channel: "WHATSAPP",
        name: "Test WhatsApp Campaign",
        templateSid: "HX1234567890abcdef",
        templateVariables: { 1: "{{firstName}}" },
        status: "SENDING",
        save: jest.fn()
      };

      const mockRecipient: any = {
        id: "rec-wa-1",
        campaignMessageId: "msg-wa-dry-1",
        leadId: "lead-wa-1",
        phone: "+15552345678",
        status: "QUEUED",
        sentAt: null,
        error: null,
        skipReason: null,
        save: jest.fn()
      };

      const mockLead = {
        id: "lead-wa-1",
        firstName: "Ada",
        phone: "+15552345678",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false
      };

      mockModels.CampaignMessage.findByPk.mockResolvedValue(mockMsg);
      mockModels.CampaignRecipient.findAll.mockResolvedValueOnce([mockRecipient]);
      mockModels.CampaignRecipient.count.mockResolvedValue(0);
      mockModels.Lead.findByPk.mockResolvedValue(mockLead);
      mockModels.CampaignRecipient.update.mockResolvedValue([1]);

      await processAsyncWhatsAppDelivery("camp-1", mockMsg.id, "Test WhatsApp Campaign");

      // Verify real Twilio call function was NEVER called
      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();

      // Recipient marked SENT with note "dry run (not delivered)"
      expect(mockRecipient.status).toBe("SENT");
      expect(mockRecipient.sentAt).toBeDefined();
      expect(mockRecipient.skipReason).toBe("dry run (not delivered)");
    });
  });

  describe("6. Real-Time Pre-Send Re-Checks (Consent & Opt-Out between Queue and Delivery)", () => {
    test("skips recipient if lead opts out between queueing and delivery", async () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";

      const mockMsg: any = {
        id: "msg-wa-optout",
        campaignId: "camp-1",
        channel: "WHATSAPP",
        name: "Safety Campaign",
        templateSid: "HX1234567890abcdef",
        templateVariables: {},
        status: "SENDING",
        save: jest.fn()
      };

      const mockRecipient: any = {
        id: "rec-wa-optout",
        campaignMessageId: "msg-wa-optout",
        leadId: "lead-wa-optout",
        phone: "+15552345678",
        status: "QUEUED",
        sentAt: null,
        error: null,
        skipReason: null,
        save: jest.fn()
      };

      // Lead opted out after recipient row was created
      const mockLead = {
        id: "lead-wa-optout",
        phone: "+15552345678",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: true // OPTED OUT!
      };

      mockModels.CampaignMessage.findByPk.mockResolvedValue(mockMsg);
      mockModels.CampaignRecipient.findAll.mockResolvedValueOnce([mockRecipient]);
      mockModels.CampaignRecipient.count.mockResolvedValue(0);
      mockModels.Lead.findByPk.mockResolvedValue(mockLead);
      mockModels.CampaignRecipient.update.mockResolvedValue([1]);

      await processAsyncWhatsAppDelivery("camp-1", mockMsg.id, "Safety Campaign");

      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();
      expect(mockRecipient.status).toBe("SKIPPED");
      expect(mockRecipient.skipReason).toBe("opted out");
    });

    test("skips recipient if lead revoked WhatsApp consent between queueing and delivery", async () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";

      const mockMsg: any = {
        id: "msg-wa-consent-revoked",
        campaignId: "camp-1",
        channel: "WHATSAPP",
        name: "Consent Campaign",
        templateSid: "HX1234567890abcdef",
        templateVariables: {},
        status: "SENDING",
        save: jest.fn()
      };

      const mockRecipient: any = {
        id: "rec-wa-revoked",
        campaignMessageId: "msg-wa-consent-revoked",
        leadId: "lead-wa-revoked",
        phone: "+15552345678",
        status: "QUEUED",
        sentAt: null,
        error: null,
        skipReason: null,
        save: jest.fn()
      };

      // Lead consent status changed to UNSPECIFIED/OPTED_OUT
      const mockLead = {
        id: "lead-wa-revoked",
        phone: "+15552345678",
        whatsappConsentStatus: "UNSPECIFIED",
        optedOutWhatsapp: false
      };

      mockModels.CampaignMessage.findByPk.mockResolvedValue(mockMsg);
      mockModels.CampaignRecipient.findAll.mockResolvedValueOnce([mockRecipient]);
      mockModels.CampaignRecipient.count.mockResolvedValue(0);
      mockModels.Lead.findByPk.mockResolvedValue(mockLead);
      mockModels.CampaignRecipient.update.mockResolvedValue([1]);

      await processAsyncWhatsAppDelivery("camp-1", mockMsg.id, "Consent Campaign");

      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();
      expect(mockRecipient.status).toBe("SKIPPED");
      expect(mockRecipient.skipReason).toBe("no WhatsApp consent");
    });

    test("skips recipient if not in test allowlist when allowlist is active", async () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";
      process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST = "+1 (555) 999-9999";

      const mockMsg: any = {
        id: "msg-wa-allowlist",
        campaignId: "camp-1",
        channel: "WHATSAPP",
        name: "Allowlist Campaign",
        templateSid: "HX1234567890abcdef",
        templateVariables: {},
        status: "SENDING",
        save: jest.fn()
      };

      const mockRecipient: any = {
        id: "rec-wa-not-in-allowlist",
        campaignMessageId: "msg-wa-allowlist",
        leadId: "lead-wa-not-in-allowlist",
        phone: "+1 (555) 123-4567",
        status: "QUEUED",
        sentAt: null,
        error: null,
        skipReason: null,
        save: jest.fn()
      };

      const mockLead = {
        id: "lead-wa-not-in-allowlist",
        phone: "+1 (555) 123-4567",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false
      };

      mockModels.CampaignMessage.findByPk.mockResolvedValue(mockMsg);
      mockModels.CampaignRecipient.findAll.mockResolvedValueOnce([mockRecipient]);
      mockModels.CampaignRecipient.count.mockResolvedValue(0);
      mockModels.Lead.findByPk.mockResolvedValue(mockLead);
      mockModels.CampaignRecipient.update.mockResolvedValue([1]);

      await processAsyncWhatsAppDelivery("camp-1", mockMsg.id, "Allowlist Campaign");

      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();
      expect(mockRecipient.status).toBe("SKIPPED");
      expect(mockRecipient.skipReason).toBe("not in test allowlist");
    });
  });

  describe("7. Send API Confirm & Status Enforcement (sendCampaignMessage)", () => {
    test("rejects send without confirm: true", async () => {
      const req: any = {
        params: { id: "camp-1", messageId: "msg-1" },
        body: { confirm: false },
        user: { role: "ADMIN", id: "user-1" }
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await sendCampaignMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Explicit confirmation (confirm: true) is required")
        })
      );
    });

    test("rejects send for messages not in DRAFT or SCHEDULED status", async () => {
      mockModels.Campaign.findByPk.mockResolvedValue({ id: "camp-1", name: "Campaign 1" });
      mockModels.CampaignMessage.findOne.mockResolvedValue({
        id: "msg-sent",
        campaignId: "camp-1",
        status: "SENT" // Not DRAFT or SCHEDULED
      });

      const req: any = {
        params: { id: "camp-1", messageId: "msg-sent" },
        body: { confirm: true },
        user: { role: "ADMIN", id: "user-1" }
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await sendCampaignMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Only messages in DRAFT or SCHEDULED status can be sent")
        })
      );
    });
  });

  describe("8. Resume Safety: Never creates new rows, never resends SENT", () => {
    test("resumeMessageSend only queries existing QUEUED or FAILED rows, never creates new rows", async () => {
      process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";

      const mockMsg = {
        id: "msg-wa-resume",
        campaignId: "camp-1",
        channel: "WHATSAPP",
        name: "Resume Campaign",
        templateSid: "HX1234567890abcdef",
        templateVariables: {},
        status: "PARTIAL",
        save: jest.fn()
      };

      mockModels.Campaign.findByPk.mockResolvedValue({ id: "camp-1", name: "Resume Campaign" });
      mockModels.CampaignMessage.findOne.mockResolvedValue(mockMsg);
      mockModels.CampaignMessage.findByPk.mockResolvedValue(mockMsg);
      // Simulate atomic claim update
      mockModels.CampaignMessage.update.mockResolvedValue([1]);

      const sentRecipient = {
        id: "rec-1",
        campaignMessageId: "msg-wa-resume",
        status: "SENT",
        phone: "+15551111111"
      };

      const queuedRecipient = {
        id: "rec-2",
        campaignMessageId: "msg-wa-resume",
        status: "QUEUED",
        phone: "+15552222222",
        save: jest.fn()
      };

      mockModels.CampaignRecipient.findAll.mockResolvedValue([queuedRecipient]);
      mockModels.CampaignRecipient.count.mockResolvedValue(1);
      mockModels.CampaignRecipient.update.mockResolvedValue([1]);
      mockModels.Lead.findByPk.mockResolvedValue({
        id: "lead-2",
        phone: "+15552222222",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false
      });

      await resumeMessageSend("camp-1", "msg-wa-resume", { confirm: true });
      await new Promise((resolve) => setImmediate(resolve));

      // Verify bulkCreate was NEVER called during resume
      expect(mockModels.CampaignRecipient.bulkCreate).not.toHaveBeenCalled();

      // Verify recipient queries specifically target existing rows
      expect(mockModels.CampaignRecipient.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignMessageId: "msg-wa-resume"
          })
        })
      );
    });

    test("resume rejects without confirm: true", async () => {
      const req: any = {
        params: { id: "camp-1", messageId: "msg-1" },
        body: { confirm: false },
        user: { role: "ADMIN", id: "user-1" }
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await resumeCampaignMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Explicit confirmation (confirm: true) is required")
        })
      );
    });
  });
});
