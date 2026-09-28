// Mock external modules before imports to support real controller/service test suites in Jest
jest.mock("sanitize-html", () => {
  return jest.fn((str: string) => str);
});

const mockModels = {
  Campaign: {
    findByPk: jest.fn()
  },
  CampaignMessage: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
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
  Activity: {
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
  escapeHtml,
  renderTemplatePlaceholders,
  renderEmailForLead,
  isValidEmail,
  filterLeadsForAudience,
  getCampaignMessageConfig,
  executeMessageSend,
  resumeMessageSend
} from "../../../backend/src/services/campaignMessageService";
import {
  sendCampaignMessage,
  resumeCampaignMessage
} from "../../../backend/src/controllers/campaignMessageController";
import {
  renderUnsubscribePage,
  handleUnsubscribe
} from "../../../backend/src/controllers/leadController";
import { sequelize } from "@nexus-crm/database";

describe("Phase B: Campaign Email Execution & Safety Engine (Real Service Implementation)", () => {
  describe("1. Strict Email Validation (isValidEmail)", () => {
    test("accepts valid email formats", () => {
      expect(isValidEmail("alice@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@sub.domain.co.uk")).toBe(true);
      expect(isValidEmail("sales@nexus-crm.com")).toBe(true);
    });

    test("rejects invalid, missing, or malformed email addresses", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("user@domain")).toBe(false); // missing TLD
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail("user @domain.com")).toBe(false);
      expect(isValidEmail("user@domain..com")).toBe(false);
    });
  });

  describe("2. Audience Filtering & Mandatory Exclusions (filterLeadsForAudience)", () => {
    const mockLeads = [
      { id: "1", firstName: "Alice", email: "alice@example.com", status: "QUALIFIED", leadScore: 75, optedOutEmail: false },
      { id: "2", firstName: "Bob", email: "bob@example.com", status: "NEW", leadScore: 40, optedOutEmail: false },
      { id: "3", firstName: "Charlie", email: "charlie@example.com", status: "CONTACTED", leadScore: 60, optedOutEmail: true }, // Opted out
      { id: "4", firstName: "Dan", email: "dan@invalid", status: "NEW", leadScore: 50, optedOutEmail: false }, // Invalid email (no TLD)
      { id: "5", firstName: "Eve", email: "", status: "NEW", leadScore: 50, optedOutEmail: false }, // Empty email
      { id: "6", firstName: "Alice Clone", email: "alice@example.com", status: "QUALIFIED", leadScore: 80, optedOutEmail: false }, // Duplicate
      { id: "7", firstName: "Frank", email: "frank@example.com", status: "CONVERTED", leadScore: 90, optedOutEmail: false }, // Converted
      { id: "8", firstName: "Grace", email: "grace@example.com", status: "CLOSED_LOST", leadScore: 20, optedOutEmail: false }, // Closed Lost
      { id: "9", firstName: "Heidi", email: "heidi@tech.com", status: "IN_NEGOTIATION", leadScore: 85, industry: "Technology", country: "UAE", optedOutEmail: false }
    ];

    test("correctly excludes invalid emails, opted-out leads, duplicates, and closed deals", () => {
      const result = filterLeadsForAudience(mockLeads);

      // Eligible: Alice (1), Bob (2), Heidi (9)
      expect(result.eligibleLeads.map((l: any) => l.id)).toEqual(["1", "2", "9"]);
      expect(result.excludedByReason.optedOut).toBe(1); // Charlie (3)
      expect(result.excludedByReason.invalidEmail).toBe(2); // Dan (4), Eve (5)
      expect(result.excludedByReason.duplicate).toBe(1); // Alice Clone (6)
      expect(result.excludedByReason.closedStatus).toBe(2); // Frank (7), Grace (8)
      expect(result.excludedCount).toBe(6);
      expect(result.eligibleLeads.length + result.excludedCount).toBe(mockLeads.length);
    });

    test("applies status and score filters properly", () => {
      const result = filterLeadsForAudience(mockLeads, {
        minScore: 70,
        leadStatus: ["QUALIFIED", "IN_NEGOTIATION"]
      });

      // Eligible: Alice (75), Heidi (85)
      expect(result.eligibleLeads.map((l: any) => l.id)).toEqual(["1", "9"]);
      expect(result.eligibleLeads.length).toBe(2);
    });

    test("permits CONVERTED leads when explicitly requested in filter", () => {
      const result = filterLeadsForAudience(mockLeads, {
        leadStatus: ["CONVERTED"]
      });

      expect(result.eligibleLeads.map((l: any) => l.id)).toEqual(["7"]);
      expect(result.excludedByReason.closedStatus).toBe(0);
    });

    test("filters by country and territory correctly", () => {
      const result = filterLeadsForAudience(mockLeads, {
        country: "UAE"
      });

      expect(result.eligibleLeads.map((l: any) => l.id)).toEqual(["9"]);
    });
  });

  describe("3. Template Placeholders & XSS Prevention (renderTemplatePlaceholders & escapeHtml)", () => {
    test("safely escapes HTML tags, script injections, and quotes in dynamic placeholders", () => {
      const maliciousLead = {
        firstName: `<script>alert("xss")</script>`,
        lastName: `O'Connor & Sons`,
        company: `"Acme" <Corporation>`
      };

      const dataObj = {
        firstName: escapeHtml(maliciousLead.firstName),
        lastName: escapeHtml(maliciousLead.lastName),
        company: escapeHtml(maliciousLead.company),
        campaignName: escapeHtml("Q4 Enterprise Launch")
      };

      const template = "Hello {{firstName}} {{lastName}} from {{company}} - Welcome to {{campaignName}}!";
      const rendered = renderTemplatePlaceholders(template, dataObj);

      expect(rendered).not.toContain("<script>");
      expect(rendered).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(rendered).toContain("O&#039;Connor &amp; Sons");
      expect(rendered).toContain("&quot;Acme&quot; &lt;Corporation&gt;");
    });
  });

  describe("4. Absolute Tracking Pixel URL & Base URL Handling", () => {
    const originalBaseUrl = process.env.BASE_URL;

    afterEach(() => {
      process.env.BASE_URL = originalBaseUrl;
    });

    test("generates absolute tracking pixel URL using process.env.BASE_URL", () => {
      process.env.BASE_URL = "https://crm.company.com/";

      const lead = {
        id: "ld-1001",
        firstName: "Sarah",
        lastName: "Connor",
        company: "Cyberdyne Systems"
      };

      const html = renderEmailForLead("<p>Hello world</p>", lead, "Winter Promo", "rec-7788");

      expect(html).toContain('src="https://crm.company.com/api/v1/campaign-messages/track/rec-7788"');
      expect(html).toContain('width="1" height="1"');
      expect(html).toContain('style="display:none;"');
      expect(html).toContain('href="https://crm.company.com/api/v1/leads/unsubscribe/ld-1001"');
    });
  });

  describe("5. Safety Switches & Cap Validation (getCampaignMessageConfig)", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("defaults dry run to true when not configured", () => {
      delete process.env.CAMPAIGN_EMAIL_DRY_RUN;
      const config = getCampaignMessageConfig();
      expect(config.dryRun).toBe(true);
    });

    test("correctly parses custom recipient caps and allowlist status", () => {
      process.env.CAMPAIGN_EMAIL_DRY_RUN = "false";
      process.env.CAMPAIGN_EMAIL_MAX_RECIPIENTS = "250";
      process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST = "tester@nexus.local, dev@nexus.local";

      const config = getCampaignMessageConfig();
      expect(config.dryRun).toBe(false);
      expect(config.maxRecipients).toBe(250);
      expect(config.allowlistActive).toBe(true);
    });
  });

  describe("7. Send vs Resume Endpoint Separation (Real Controller & Service Logic)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("sendCampaignMessage controller rejects PARTIAL and FAILED messages with 400 and clear error message", async () => {
      // Test PARTIAL message rejection
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce({
        id: "msg-partial",
        campaignId: "camp-1",
        status: "PARTIAL"
      });

      const mockReqPartial: any = {
        params: { id: "camp-1", messageId: "msg-partial" },
        body: { confirm: true }
      };
      let statusPartial = 0;
      let jsonPartial: any = null;
      const mockResPartial: any = {
        status: (code: number) => {
          statusPartial = code;
          return { json: (data: any) => { jsonPartial = data; } };
        }
      };

      await sendCampaignMessage(mockReqPartial, mockResPartial);
      expect(statusPartial).toBe(400);
      expect(jsonPartial.error).toBe("Only messages in DRAFT or SCHEDULED status can be sent (current: PARTIAL)");

      // Test FAILED message rejection
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce({
        id: "msg-failed",
        campaignId: "camp-1",
        status: "FAILED"
      });

      const mockReqFailed: any = {
        params: { id: "camp-1", messageId: "msg-failed" },
        body: { confirm: true }
      };
      let statusFailed = 0;
      let jsonFailed: any = null;
      const mockResFailed: any = {
        status: (code: number) => {
          statusFailed = code;
          return { json: (data: any) => { jsonFailed = data; } };
        }
      };

      await sendCampaignMessage(mockReqFailed, mockResFailed);
      expect(statusFailed).toBe(400);
      expect(jsonFailed.error).toBe("Only messages in DRAFT or SCHEDULED status can be sent (current: FAILED)");
    });

    test("executeMessageSend service rejects PARTIAL and FAILED statuses", async () => {
      // Test PARTIAL in service
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce({
        id: "msg-partial",
        campaignId: "camp-1",
        status: "PARTIAL"
      });

      await expect(executeMessageSend("camp-1", "msg-partial", { confirm: true })).rejects.toThrow(
        "Only messages in DRAFT or SCHEDULED status can be sent (current: PARTIAL)"
      );

      // Test FAILED in service
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce({
        id: "msg-failed",
        campaignId: "camp-1",
        status: "FAILED"
      });

      await expect(executeMessageSend("camp-1", "msg-failed", { confirm: true })).rejects.toThrow(
        "Only messages in DRAFT or SCHEDULED status can be sent (current: FAILED)"
      );
    });

    test("resumeCampaignMessage controller rejects DRAFT and SCHEDULED messages and requires confirmation", async () => {
      // Rejects without confirm: true
      const mockReqNoConfirm: any = {
        params: { id: "camp-1", messageId: "msg-partial" },
        body: { confirm: false }
      };
      let statusNoConfirm = 0;
      let jsonNoConfirm: any = null;
      const mockResNoConfirm: any = {
        status: (code: number) => {
          statusNoConfirm = code;
          return { json: (data: any) => { jsonNoConfirm = data; } };
        }
      };
      await resumeCampaignMessage(mockReqNoConfirm, mockResNoConfirm);
      expect(statusNoConfirm).toBe(400);
      expect(jsonNoConfirm.error).toContain("Explicit confirmation");

      // Rejects DRAFT
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce({
        id: "msg-draft",
        campaignId: "camp-1",
        status: "DRAFT"
      });

      const mockReqDraft: any = {
        params: { id: "camp-1", messageId: "msg-draft" },
        body: { confirm: true }
      };
      let statusDraft = 0;
      let jsonDraft: any = null;
      const mockResDraft: any = {
        status: (code: number) => {
          statusDraft = code;
          return { json: (data: any) => { jsonDraft = data; } };
        }
      };
      await resumeCampaignMessage(mockReqDraft, mockResDraft);
      expect(statusDraft).toBe(400);
      expect(jsonDraft.error).toBe("Only messages in PARTIAL or FAILED status can be resumed (current: DRAFT)");
    });

    test("resumeMessageSend NEVER creates new recipient rows and processes only QUEUED / reset SENDING rows", async () => {
      const msgMock = {
        id: "msg-partial-1",
        campaignId: "camp-1",
        status: "PARTIAL",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(msgMock);
      (sequelize.models.Campaign.findByPk as jest.Mock).mockResolvedValueOnce({
        id: "camp-1",
        name: "Enterprise Q4"
      });

      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([2]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValueOnce(5);

      const result = await resumeMessageSend("camp-1", "msg-partial-1", { confirm: true });

      // Verification 1: NEVER creates new recipient rows
      expect(sequelize.models.CampaignRecipient.create).not.toHaveBeenCalled();
      expect(sequelize.models.CampaignRecipient.bulkCreate).not.toHaveBeenCalled();

      // Verification 2: Resets in-flight SENDING to QUEUED
      expect(sequelize.models.CampaignRecipient.update).toHaveBeenCalledWith(
        { status: "QUEUED" },
        { where: { campaignMessageId: "msg-partial-1", status: "SENDING" } }
      );

      // Verification 3: Counts remaining QUEUED rows
      expect(sequelize.models.CampaignRecipient.count).toHaveBeenCalledWith(
        { where: { campaignMessageId: "msg-partial-1", status: "QUEUED" } }
      );
      expect(result.recipientCount).toBe(5);
      expect(result.status).toBe("SENDING");
      expect(msgMock.status).toBe("SENDING");
      expect(msgMock.save).toHaveBeenCalled();
    });
  });

  describe("8. Two-Step Safe Unsubscribe Flow (GET does not mutate, POST mutates)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("GET /leads/unsubscribe/:id renders confirmation page without mutating lead or creating activity", async () => {
      const mockLead = {
        id: "lead-test-01",
        email: "subscriber@example.com",
        optedOutEmail: false,
        save: jest.fn()
      };

      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);

      const mockReq: any = { params: { id: "lead-test-01" } };
      let responseHtml = "";
      const mockRes: any = {
        send: (html: string) => {
          responseHtml = html;
        }
      };

      await renderUnsubscribePage(mockReq, mockRes);

      // Verification 1: Lead was NOT mutated by GET request (protects against web crawler / security scanners)
      expect(mockLead.optedOutEmail).toBe(false);
      expect(mockLead.save).not.toHaveBeenCalled();
      expect(sequelize.models.Activity.create).not.toHaveBeenCalled();
      expect(sequelize.models.CampaignRecipient.update).not.toHaveBeenCalled();

      // Verification 2: Confirmation page contains form with POST button to the same URL
      expect(responseHtml).toContain("Unsubscribe from Emails");
      expect(responseHtml).toContain('action="/api/v1/leads/unsubscribe/lead-test-01"');
      expect(responseHtml).toContain('method="POST"');
      expect(responseHtml).toContain('<button type="submit" class="btn">Unsubscribe</button>');
      expect(responseHtml).toContain("subscriber@example.com");
    });

    test("POST /leads/unsubscribe/:id sets optedOutEmail=true, logs Activity, and updates CampaignRecipient unsubscribedAt", async () => {
      const mockLead = {
        id: "lead-test-02",
        email: "confirm-unsub@example.com",
        optedOutEmail: false,
        assignedToId: "rep-99",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);
      (sequelize.models.Activity.create as jest.Mock).mockResolvedValueOnce({});
      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);

      const mockReq: any = { params: { id: "lead-test-02" } };
      let responseHtml = "";
      const mockRes: any = {
        send: (html: string) => {
          responseHtml = html;
        }
      };

      await handleUnsubscribe(mockReq, mockRes);

      // Verification 1: Lead is mutated on POST
      expect(mockLead.optedOutEmail).toBe(true);
      expect(mockLead.save).toHaveBeenCalled();

      // Verification 2: Activity logged
      expect(sequelize.models.Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-test-02",
          type: "Email",
          status: "Completed",
          assignedToId: "rep-99",
          notes: expect.stringContaining("Client confirmed Unsubscribe")
        })
      );

      // Verification 3: CampaignRecipient timestamp updated
      expect(sequelize.models.CampaignRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({ unsubscribedAt: expect.any(Date) }),
        expect.objectContaining({ where: { leadId: "lead-test-02", unsubscribedAt: null } })
      );

      // Verification 4: Renders success page
      expect(responseHtml).toContain("Unsubscribed Successfully");
    });
  });
});

