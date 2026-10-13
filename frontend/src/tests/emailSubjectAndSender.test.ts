jest.mock("sanitize-html", () => {
  return jest.fn((str: string) => str);
});

const mockSendEmail = jest.fn().mockResolvedValue({ id: "mock-email-id" });
jest.mock("../../../backend/src/services/emailService", () => {
  const actual = jest.requireActual("../../../backend/src/services/emailService");
  return {
    ...actual,
    sendEmail: (...args: any[]) => mockSendEmail(...args)
  };
});

const mockModels = {
  CampaignMessage: {
    findByPk: jest.fn()
  },
  CampaignRecipient: {
    findAll: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  Lead: {
    findAll: jest.fn(),
    findByPk: jest.fn()
  }
};

jest.mock("@nexus-crm/database", () => ({
  sequelize: {
    models: mockModels
  }
}));

import {
  renderEmailSubjectForLead,
  MAX_SUBJECT_LENGTH,
  processAsyncDelivery
} from "../../../backend/src/services/campaignMessageService";
import {
  buildFromHeader,
  getBaseHtmlTemplate,
  cleanEnv
} from "../../../backend/src/services/emailService";
import { sequelize } from "@nexus-crm/database";

describe("Email Subject & Sender Display Name Safety Test Suite", () => {
  describe("1. Campaign Email Subject Dynamic Placeholders", () => {
    test("subject renders for full data (all placeholders replaced correctly)", () => {
      const lead = {
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Babbage Engines Ltd"
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "{{firstName}} {{lastName}}, special offer for {{company}} in {{campaignName}}!";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject).toBe("Ada Lovelace, special offer for Babbage Engines Ltd in October Innovation Drive!");
      expect(subject).not.toContain("{{");
      expect(subject).not.toContain("}}");
    });

    test("subject renders gracefully when missing firstName (no undefined, no leftover braces)", () => {
      const lead = {
        firstName: null,
        lastName: "Lovelace",
        company: "Babbage Engines Ltd"
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "{{firstName}}, your October offer for {{company}}";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject).toBe(", your October offer for Babbage Engines Ltd");
      expect(subject).not.toContain("undefined");
      expect(subject).not.toContain("null");
      expect(subject).not.toContain("{{");
      expect(subject).not.toContain("}}");
    });

    test("subject renders gracefully when missing company (no undefined, no leftover braces)", () => {
      const lead = {
        firstName: "Ada",
        lastName: "Lovelace",
        company: undefined
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "Hi {{firstName}}, partner update for {{company}} ({{campaignName}})";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject).toBe("Hi Ada, partner update for (October Innovation Drive)");
      expect(subject).not.toContain("undefined");
      expect(subject).not.toContain("{{company}}");
    });

    test("subject with CR/LF characters has line breaks stripped (header injection protection)", () => {
      const lead = {
        firstName: "Ada",
        company: "Babbage Engines"
      };
      const campaignName = "October Drive";
      const rawSubject = "Special Offer\r\nBcc: evil@attacker.com\r\nSubject: Injected\nFor {{company}}";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject).not.toMatch(/[\r\n]/);
      expect(subject).toBe("Special Offer Bcc: evil@attacker.com Subject: Injected For Babbage Engines");
    });

    test("unknown placeholders are stripped with no leftover braces or undefined", () => {
      const lead = {
        firstName: "Ada",
        company: "Babbage Engines"
      };
      const campaignName = "October Drive";
      const rawSubject = "Hello {{firstName}}! Use coupon {{discountCode}} with tag {{unknownTag}}";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject).toBe("Hello Ada! Use coupon with tag");
      expect(subject).not.toContain("{{");
      expect(subject).not.toContain("}}");
      expect(subject).not.toContain("undefined");
    });

    test("caps rendered subject length at MAX_SUBJECT_LENGTH (255 chars)", () => {
      const lead = {
        firstName: "Ada",
        company: "A".repeat(300)
      };
      const campaignName = "October Drive";
      const rawSubject = "Urgent notice for {{company}}";

      const subject = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      expect(subject.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
      expect(subject.length).toBe(MAX_SUBJECT_LENGTH);
    });
  });

  describe("2. From Header Construction & Sender Display Name Safety", () => {
    test("From header for names with quotes escapes internal quotes safely", () => {
      const result = buildFromHeader('Volvi "Tech" Solutions', 'no-reply@volvitech.com');
      expect(result).toBe('"Volvi \\"Tech\\" Solutions" <no-reply@volvitech.com>');
    });

    test("From header for names with commas quotes display name according to RFC 5322", () => {
      const result = buildFromHeader('Volvitech, Inc.', 'no-reply@volvitech.com');
      expect(result).toBe('"Volvitech, Inc." <no-reply@volvitech.com>');
    });

    test("From header for names with unicode formats safely", () => {
      const resultAsciiUnicode = buildFromHeader('Volvitech ™', 'no-reply@volvitech.com');
      expect(resultAsciiUnicode).toBe('"Volvitech ™" <no-reply@volvitech.com>');

      const resultArabic = buildFromHeader('فولفيتيك', 'no-reply@volvitech.com');
      expect(resultArabic).toBe('"فولفيتيك" <no-reply@volvitech.com>');
    });

    test("From header quotes plain display names only when needed", () => {
      const resultPlain = buildFromHeader('Volvitech', 'no-reply@volvitech.com');
      expect(resultPlain).toBe('Volvitech <no-reply@volvitech.com>');
    });

    test("defensively trims stray trailing quotes from env var strings (reproducing and fixing the live issue)", () => {
      // Live test bug: MAILGUN_FROM rendered Volvitech" with a stray trailing quote
      const resultWithTrailingQuote = buildFromHeader('Volvitech" <no-reply@inbound.volvitech.com>');
      expect(resultWithTrailingQuote).toBe('Volvitech <no-reply@inbound.volvitech.com>');
    });

    test("defensively trims stray surrounding quotes from env var strings", () => {
      const resultWithSurroundingQuotes = buildFromHeader('"Volvitech" <no-reply@inbound.volvitech.com>');
      expect(resultWithSurroundingQuotes).toBe('Volvitech <no-reply@inbound.volvitech.com>');
    });
  });

  describe("3. Email Template Branding Header & Compliant Unsubscribe Link", () => {
    test("confirm unsubscribe link is present in footer when leadId is provided", () => {
      const html = getBaseHtmlTemplate("<p>Body Content</p>", "lead-ld-12345");
      expect(html).toContain('href="http://localhost:5506/api/v1/leads/unsubscribe/lead-ld-12345"');
      expect(html).toContain("Unsubscribe here");
    });

    test("branding header text comes from configurable COMPANY_NAME setting with fallback", () => {
      const originalCompany = process.env.COMPANY_NAME;
      try {
        process.env.COMPANY_NAME = "Volvitech Enterprise";
        const html = getBaseHtmlTemplate("<p>Body</p>");
        expect(html).toContain("<h1>VOLVITECH ENTERPRISE</h1>");
        expect(html).toContain("Volvitech Enterprise. All rights reserved.");

        delete process.env.COMPANY_NAME;
        const defaultHtml = getBaseHtmlTemplate("<p>Body</p>");
        expect(defaultHtml).toContain("<h1>NEXUS CRM</h1>");
        expect(defaultHtml).toContain("Nexus CRM. All rights reserved.");
      } finally {
        process.env.COMPANY_NAME = originalCompany;
      }
    });
  });

  describe("4. End-to-End Send Path Delivery Subject Rendering Integration", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = { ...originalEnv };
      process.env.CAMPAIGN_EMAIL_DRY_RUN = "false";
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("processAsyncDelivery renders subject line placeholders before dispatching to sendEmail", async () => {
      const mockRecipient = {
        id: "rec-e2e-subject",
        campaignMessageId: "msg-subject-test",
        leadId: "lead-subject-test",
        email: "grace.hopper@navy.mil",
        status: "QUEUED",
        save: jest.fn().mockResolvedValue(true)
      };

      const mockLead = {
        id: "lead-subject-test",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace.hopper@navy.mil",
        company: "US Navy Computing",
        optedOutEmail: false
      };

      const mockMessage = {
        id: "msg-subject-test",
        campaignId: "camp-subject-test",
        subject: "Hello {{firstName}}, special offer for {{company}}!",
        bodyHtml: "<p>Welcome {{firstName}}</p>",
        status: "SENDING",
        save: jest.fn().mockResolvedValue(true)
      };

      (sequelize.models.CampaignMessage.findByPk as jest.Mock).mockResolvedValue(mockMessage);
      (sequelize.models.CampaignRecipient.findAll as jest.Mock).mockResolvedValueOnce([mockRecipient]);
      (sequelize.models.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);
      (sequelize.models.Lead.findAll as jest.Mock).mockResolvedValueOnce([mockLead]);
      (sequelize.models.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);
      (sequelize.models.CampaignRecipient.count as jest.Mock).mockResolvedValue(0);

      await processAsyncDelivery("camp-subject-test", "msg-subject-test", "Autumn Launch");

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const [calledTo, calledSubject, calledHtml] = mockSendEmail.mock.calls[0];
      expect(calledTo).toBe("grace.hopper@navy.mil");
      expect(calledSubject).toBe("Hello Grace, special offer for US Navy Computing!");
      expect(calledHtml).toContain("Welcome Grace");
      expect(mockRecipient.status).toBe("SENT");
    });
  });
});
