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
  escapeHtml,
  renderTemplatePlaceholders,
  renderEmailForLead,
  isValidEmail,
  filterLeadsForAudience,
  getCampaignMessageConfig,
  executeMessageSend,
  runClaimedMessage,
  resumeMessageSend,
  processAsyncDelivery,
  unscheduleMessage
} from "../../../backend/src/services/campaignMessageService";
import {
  processScheduledCampaignMessages,
  getCampaignScheduleGraceMinutes
} from "../../../backend/src/services/campaignMessageScheduler";
import {
  sendCampaignMessage,
  resumeCampaignMessage,
  unscheduleCampaignMessageHandler
} from "../../../backend/src/controllers/campaignMessageController";
import {
  renderUnsubscribePage,
  handleUnsubscribe
} from "../../../backend/src/controllers/leadController";
import {
  localDateTimeToUtcIso,
  utcIsoToLocalDisplay
} from "../utils/campaignDateHelper";
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

    test("GET /leads/unsubscribe/:id returns generic page for unknown lead ID without leaking data", async () => {
      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce(null);

      const mockReq: any = { params: { id: "unknown-lead-uuid" } };
      let responseHtml = "";
      const mockRes: any = {
        send: (html: string) => {
          responseHtml = html;
        }
      };

      await renderUnsubscribePage(mockReq, mockRes);

      expect(responseHtml).toContain("Unsubscribe from Emails");
      expect(responseHtml).toContain("If you have an active email subscription");
      expect(responseHtml).not.toContain("unknown-lead-uuid");
      expect(responseHtml).not.toContain("subscriber@");
    });
  });

  describe("9. Delivery-Time Re-checks (Opt-out, existence, and allowlist)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("a recipient queued before an unsubscribe is skipped at delivery time in processAsyncDelivery", async () => {
      const mockRecipient = {
        id: "rec-queued-1",
        campaignMessageId: "msg-1",
        leadId: "lead-opted-out-recently",
        email: "optout@example.com",
        status: "QUEUED",
        save: jest.fn().mockResolvedValue(true)
      };

      const mockMessage = {
        id: "msg-1",
        campaignId: "camp-1",
        subject: "Hello",
        bodyHtml: "<p>Hello</p>",
        status: "SENDING",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findByPk as jest.Mock).mockResolvedValue(mockMessage);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValueOnce([mockRecipient]);
      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValueOnce([]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      // Reload lead at delivery time: lead has opted out
      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce({
        id: "lead-opted-out-recently",
        email: "optout@example.com",
        optedOutEmail: true
      });

      await processAsyncDelivery("camp-1", "msg-1", "Campaign Alpha");

      // Verify recipient was skipped with skipReason 'unsubscribed'
      expect(mockRecipient.status).toBe("SKIPPED");
      expect((mockRecipient as any).skipReason).toBe("unsubscribed");
      expect(mockRecipient.save).toHaveBeenCalled();
    });

    test("resume delivery also skips opted-out leads at delivery time", async () => {
      const mockRecipient = {
        id: "rec-resume-1",
        campaignMessageId: "msg-resume-1",
        leadId: "lead-unsub-resume",
        email: "unsub-resume@example.com",
        status: "QUEUED",
        save: jest.fn().mockResolvedValue(true)
      };

      const mockMessage = {
        id: "msg-resume-1",
        campaignId: "camp-1",
        subject: "Follow Up",
        bodyHtml: "<p>Follow Up</p>",
        status: "SENDING",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findByPk as jest.Mock).mockResolvedValue(mockMessage);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValueOnce([mockRecipient]);
      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValueOnce([]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      // Lead reloaded at delivery time is now opted out
      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce({
        id: "lead-unsub-resume",
        email: "unsub-resume@example.com",
        optedOutEmail: true
      });

      await processAsyncDelivery("camp-1", "msg-resume-1", "Campaign Alpha");

      expect(mockRecipient.status).toBe("SKIPPED");
      expect((mockRecipient as any).skipReason).toBe("unsubscribed");
      expect(mockRecipient.save).toHaveBeenCalled();
    });
  });

  describe("10. Phase A: Scheduled Sends, Timezones & Safety Engine (Real Functions & Atomicity)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValue([]);
      (sequelize.models.LeadAttribution.findAll as jest.Mock).mockResolvedValue([]);
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValue([]);
    });

    test("localDateTimeToUtcIso and utcIsoToLocalDisplay handle timezone conversions correctly", () => {
      const localStr = "2026-10-15T14:30";
      const utcIso = localDateTimeToUtcIso(localStr);
      expect(utcIso).toContain("2026-10-15T");
      expect(new Date(utcIso).toISOString()).toBe(utcIso);

      const localDisplay = utcIsoToLocalDisplay(utcIso);
      expect(localDisplay).toBeTruthy();
      expect(typeof localDisplay).toBe("string");

      // Empty string handling
      expect(localDateTimeToUtcIso("")).toBe("");
      expect(utcIsoToLocalDisplay("")).toBe("");
    });

    test("runs the scheduler tick against a due SCHEDULED message end-to-end (dry run) and asserts recipients created once and message ends SENT", async () => {
      const now = new Date();
      const mockScheduledMsg = {
        id: "msg-sched-e2e",
        campaignId: "camp-e2e",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() - 15000), // 15 seconds ago (due)
        subject: "Welcome Diana",
        bodyHtml: "<p>Welcome to our platform, {{firstName}}!</p>",
        audienceFilter: JSON.stringify({ leadStatus: ["QUALIFIED"] }),
        createdBy: "user-admin-1",
        save: jest.fn().mockResolvedValue(true)
      };

      const mockLead = {
        id: "lead-e2e-1",
        firstName: "Diana",
        lastName: "Prince",
        email: "diana@themyscira.com",
        status: "QUALIFIED",
        optedOutEmail: false
      };

      const mockCreatedRecipient = {
        id: "rec-e2e-1",
        campaignMessageId: "msg-sched-e2e",
        leadId: "lead-e2e-1",
        email: "diana@themyscira.com",
        status: "QUEUED",
        save: jest.fn().mockResolvedValue(true)
      };

      // 1. findAll scheduled messages
      (sequelize.models.CampaignMessage.findAll as jest.Mock).mockResolvedValueOnce([mockScheduledMsg]);
      // 2. Atomic claim update
      (sequelize.models.CampaignMessage.update as jest.Mock).mockResolvedValueOnce([1]);
      // 3. runClaimedMessage -> findOne CampaignMessage
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockScheduledMsg);
      // 4. findByPk Campaign
      (sequelize.models.Campaign.findByPk as jest.Mock).mockResolvedValueOnce({
        id: "camp-e2e",
        name: "Enterprise Launch"
      });
      // 5. computeAudience -> LeadAttribution & Lead findAll
      (sequelize.models.LeadAttribution.findAll as jest.Mock).mockResolvedValueOnce([]);
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValue([mockLead]);
      // 6. destroy old recipients & bulkCreate new ones
      (sequelize.models.CampaignRecipient.destroy as jest.Mock).mockResolvedValueOnce(0);
      (sequelize.models.CampaignRecipient.bulkCreate as jest.Mock).mockResolvedValueOnce([mockCreatedRecipient]);
      // 7. processAsyncDelivery -> findByPk message
      (sequelize.models.CampaignMessage.findByPk as jest.Mock).mockResolvedValue(mockScheduledMsg);
      // 8. processAsyncDelivery -> findAll pending recipients
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValueOnce([mockCreatedRecipient]);
      // 9. processAsyncDelivery -> update claim recipient QUEUED -> SENDING
      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);
      // 10. processAsyncDelivery -> Lead.findByPk for delivery-time recheck
      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);
      // 11. Final count check for unsent
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValueOnce(0);

      // Execute scheduler tick
      await processScheduledCampaignMessages();

      // Assertions:
      // 1. Atomic claim performed
      expect(sequelize.models.CampaignMessage.update).toHaveBeenCalledWith(
        { status: "SENDING" },
        { where: { id: "msg-sched-e2e", status: "SCHEDULED" } }
      );
      // 2. Recipients created in bulk
      expect(sequelize.models.CampaignRecipient.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          campaignMessageId: "msg-sched-e2e",
          leadId: "lead-e2e-1",
          email: "diana@themyscira.com",
          status: "QUEUED"
        })
      ]);
      // 3. Recipient was marked SENT during delivery
      expect(mockCreatedRecipient.status).toBe("SENT");
      expect(mockCreatedRecipient.save).toHaveBeenCalled();
      // 4. Message ended in SENT
      expect(mockScheduledMsg.status).toBe("SENT");
      expect(mockScheduledMsg.save).toHaveBeenCalled();
    });

    test("inside-grace case: scheduled message within grace window (e.g. 10m overdue) is claimed and sent", async () => {
      const now = new Date();
      const mockScheduledMsg = {
        id: "msg-inside-grace",
        campaignId: "camp-1",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago (< 60m grace)
        audienceFilter: null,
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findAll as jest.Mock).mockResolvedValueOnce([mockScheduledMsg]);
      (sequelize.models.CampaignMessage.update as jest.Mock).mockResolvedValueOnce([1]);
      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockScheduledMsg);
      (sequelize.models.Campaign.findByPk as jest.Mock).mockResolvedValueOnce({ id: "camp-1", name: "Campaign 1" });
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValueOnce([]);

      await processScheduledCampaignMessages();

      // Verified: Message claimed and attempted to send
      expect(sequelize.models.CampaignMessage.update).toHaveBeenCalledWith(
        { status: "SENDING" },
        { where: { id: "msg-inside-grace", status: "SCHEDULED" } }
      );
      expect(mockScheduledMsg.status).not.toBe("DRAFT");
    });

    test("outside-grace case: overdue by more than CAMPAIGN_SCHEDULE_GRACE_MINUTES is reset to DRAFT and notifies creator", async () => {
      const now = new Date();
      const mockOverdueMsg = {
        id: "msg-overdue",
        campaignId: "camp-1",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() - 120 * 60 * 1000), // 120 minutes ago (> 60m grace)
        createdBy: "creator-user-id",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findAll as jest.Mock).mockResolvedValueOnce([mockOverdueMsg]);
      (sequelize.models.Notification.findOne as jest.Mock).mockResolvedValueOnce(null);
      (sequelize.models.Notification.create as jest.Mock).mockResolvedValueOnce({});

      await processScheduledCampaignMessages();

      // Verified: Message was NOT claimed as SENDING; reset to DRAFT with scheduledAt cleared
      expect(mockOverdueMsg.status).toBe("DRAFT");
      expect(mockOverdueMsg.scheduledAt).toBeNull();
      expect(mockOverdueMsg.save).toHaveBeenCalled();
      expect(sequelize.models.CampaignMessage.update).not.toHaveBeenCalled();

      // Notification created for creator
      expect(sequelize.models.Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "creator-user-id",
          type: "CAMPAIGN_SCHEDULE_MISSED",
          severity: "WARNING",
          message: "Scheduled send was missed while the server was offline; please reschedule."
        })
      );
    });

    test("processScheduledCampaignMessages skips message if already claimed by another instance (0 rows updated)", async () => {
      const now = new Date();
      const mockScheduledMsg = {
        id: "msg-sched-concurrent",
        campaignId: "camp-1",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() - 5000)
      };

      (sequelize.models.CampaignMessage.findAll as jest.Mock).mockResolvedValueOnce([mockScheduledMsg]);
      // Another instance claimed it first, returning 0 rows updated
      (sequelize.models.CampaignMessage.update as jest.Mock).mockResolvedValueOnce([0]);

      await processScheduledCampaignMessages();

      // Verification: Did not proceed to findOne or execute sending
      expect(sequelize.models.CampaignMessage.findOne).not.toHaveBeenCalled();
    });

    test("sendCampaignMessage controller with future scheduledAt sets status SCHEDULED and does not send immediately", async () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days in future
      const mockMsg = {
        id: "msg-future",
        campaignId: "camp-1",
        status: "DRAFT",
        scheduledAt: null,
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: "msg-future", status: "SCHEDULED", scheduledAt: futureDate })
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockMsg);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValue([]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      const mockReq: any = {
        params: { id: "camp-1", messageId: "msg-future" },
        body: { confirm: true, scheduledAt: futureDate }
      };
      let statusCode = 0;
      let responseBody: any = null;
      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseBody = data; } };
        }
      };

      await sendCampaignMessage(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(mockMsg.status).toBe("SCHEDULED");
      expect(mockMsg.scheduledAt).toEqual(new Date(futureDate));
      expect(mockMsg.save).toHaveBeenCalled();
      expect(responseBody.message).toBe("Message scheduled successfully");
    });

    test("sendCampaignMessage rejects scheduledAt in the past with 400", async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const mockMsg = {
        id: "msg-past",
        campaignId: "camp-1",
        status: "DRAFT",
        save: jest.fn()
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockMsg);

      const mockReq: any = {
        params: { id: "camp-1", messageId: "msg-past" },
        body: { confirm: true, scheduledAt: pastDate }
      };
      let statusCode = 0;
      let responseBody: any = null;
      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseBody = data; } };
        }
      };

      await sendCampaignMessage(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toBe("Scheduled time must be in the future");
      expect(mockMsg.save).not.toHaveBeenCalled();
    });

    test("sendCampaignMessage rejects scheduledAt more than 90 days ahead with 400", async () => {
      const tooFarDate = new Date(Date.now() + 95 * 24 * 60 * 60 * 1000).toISOString(); // 95 days in future
      const mockMsg = {
        id: "msg-too-far",
        campaignId: "camp-1",
        status: "DRAFT",
        save: jest.fn()
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockMsg);

      const mockReq: any = {
        params: { id: "camp-1", messageId: "msg-too-far" },
        body: { confirm: true, scheduledAt: tooFarDate }
      };
      let statusCode = 0;
      let responseBody: any = null;
      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseBody = data; } };
        }
      };

      await sendCampaignMessage(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toBe("Scheduled time cannot be more than 90 days in the future");
      expect(mockMsg.save).not.toHaveBeenCalled();
    });

    test("unscheduleMessage reverts SCHEDULED message to DRAFT and clears scheduledAt", async () => {
      const mockMsg = {
        id: "msg-sched-cancel",
        campaignId: "camp-1",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 86400000),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: "msg-sched-cancel", status: "DRAFT", scheduledAt: null })
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockMsg);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValue([]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      const result = await unscheduleMessage("camp-1", "msg-sched-cancel");

      expect(mockMsg.status).toBe("DRAFT");
      expect(mockMsg.scheduledAt).toBeNull();
      expect(mockMsg.save).toHaveBeenCalled();
      expect(result.status).toBe("DRAFT");
    });

    test("unscheduleMessage rejects non-SCHEDULED messages with an error", async () => {
      const mockDraftMsg = {
        id: "msg-already-draft",
        campaignId: "camp-1",
        status: "DRAFT"
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockDraftMsg);

      await expect(unscheduleMessage("camp-1", "msg-already-draft")).rejects.toThrow(
        "Only SCHEDULED messages can be unscheduled (current: DRAFT)"
      );
    });

    test("unscheduleCampaignMessageHandler controller returns 200 and unscheduled message", async () => {
      const mockMsg = {
        id: "msg-sched-ctrl",
        campaignId: "camp-1",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 86400000),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: "msg-sched-ctrl", status: "DRAFT", scheduledAt: null })
      };

      (sequelize.models.CampaignMessage.findOne as jest.Mock).mockResolvedValueOnce(mockMsg);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValue([]);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      const mockReq: any = {
        params: { id: "camp-1", messageId: "msg-sched-ctrl" }
      };
      let jsonResponse: any = null;
      let statusCode = 200;
      const mockRes: any = {
        json: (data: any) => { jsonResponse = data; },
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => { jsonResponse = d; } };
        }
      };

      await unscheduleCampaignMessageHandler(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.message).toBe("Message unscheduled successfully");
      expect(jsonResponse.campaignMessage.status).toBe("DRAFT");
    });
  });
});

