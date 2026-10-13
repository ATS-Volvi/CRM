import { describe, it } from "node:test";
import assert from "node:assert";
import {
  renderEmailSubjectForLead,
  MAX_SUBJECT_LENGTH
} from "../../src/services/campaignMessageService";
import {
  buildFromHeader,
  getBaseHtmlTemplate,
  cleanEnv
} from "../../src/services/emailService";

describe("Email Subject & Sender Display Name Unit Tests", () => {
  describe("Subject Line Placeholder Substitution & Sanitization", () => {
    it("renders full data correctly for all supported placeholders", () => {
      const lead = {
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Babbage Engines Ltd"
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "{{firstName}} {{lastName}}, exclusive offer for {{company}} via {{campaignName}}!";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.strictEqual(
        rendered,
        "Ada Lovelace, exclusive offer for Babbage Engines Ltd via October Innovation Drive!"
      );
    });

    it("handles missing firstName gracefully without undefined or leftover braces", () => {
      const lead = {
        firstName: null,
        lastName: "Lovelace",
        company: "Babbage Engines Ltd"
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "{{firstName}}, your October offer for {{company}}";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.strictEqual(rendered, ", your October offer for Babbage Engines Ltd");
      assert.ok(!rendered.includes("undefined"));
      assert.ok(!rendered.includes("{{"));
      assert.ok(!rendered.includes("}}"));
    });

    it("handles missing company gracefully without undefined or leftover braces", () => {
      const lead = {
        firstName: "Ada",
        lastName: "Lovelace",
        company: undefined
      };
      const campaignName = "October Innovation Drive";
      const rawSubject = "Hello {{firstName}}, partner update for {{company}} ({{campaignName}})";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.strictEqual(rendered, "Hello Ada, partner update for (October Innovation Drive)");
      assert.ok(!rendered.includes("undefined"));
      assert.ok(!rendered.includes("{{"));
      assert.ok(!rendered.includes("}}"));
    });

    it("strips CR and LF characters to prevent email header injection", () => {
      const lead = {
        firstName: "Ada",
        company: "Babbage Engines"
      };
      const campaignName = "October Drive";
      const rawSubject = "Special Offer\r\nBcc: attacker@evil.com\r\nSubject: Injected\nFor {{company}}";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.ok(!rendered.includes("\r"), "Should not contain CR");
      assert.ok(!rendered.includes("\n"), "Should not contain LF");
      assert.ok(!/[\r\n]/.test(rendered));
      assert.strictEqual(
        rendered,
        "Special Offer Bcc: attacker@evil.com Subject: Injected For Babbage Engines"
      );
    });

    it("removes unknown placeholders and leaves no leftover braces or undefined", () => {
      const lead = {
        firstName: "Ada",
        company: "Babbage Engines"
      };
      const campaignName = "October Drive";
      const rawSubject = "Hello {{firstName}}! Use code {{promoCode}} for discount {{unknown_tag}}";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.strictEqual(rendered, "Hello Ada! Use code for discount");
      assert.ok(!rendered.includes("{{"));
      assert.ok(!rendered.includes("}}"));
      assert.ok(!rendered.includes("undefined"));
    });

    it("caps rendered subject length at MAX_SUBJECT_LENGTH (255 characters)", () => {
      const lead = {
        firstName: "Ada",
        company: "A".repeat(300)
      };
      const campaignName = "October Drive";
      const rawSubject = "Important Notice for {{company}}";

      const rendered = renderEmailSubjectForLead(rawSubject, lead, campaignName);
      assert.ok(rendered.length <= MAX_SUBJECT_LENGTH);
      assert.strictEqual(rendered.length, MAX_SUBJECT_LENGTH);
    });
  });

  describe("From Header Construction & Sender Display Name Safety", () => {
    it("formats sender display names containing quotes safely with escaped internal quotes", () => {
      const result = buildFromHeader('Volvi "Tech" Solutions', 'no-reply@volvitech.com');
      assert.strictEqual(result, '"Volvi \\"Tech\\" Solutions" <no-reply@volvitech.com>');
    });

    it("formats sender display names containing commas with quotes as required by RFC 5322", () => {
      const result = buildFromHeader('Volvitech, Inc.', 'no-reply@volvitech.com');
      assert.strictEqual(result, '"Volvitech, Inc." <no-reply@volvitech.com>');
    });

    it("formats sender display names containing unicode characters safely", () => {
      const resultAsciiUnicode = buildFromHeader('Volvitech ™', 'no-reply@volvitech.com');
      assert.strictEqual(resultAsciiUnicode, '"Volvitech ™" <no-reply@volvitech.com>');

      const resultArabic = buildFromHeader('فولفيتيك', 'no-reply@volvitech.com');
      assert.strictEqual(resultArabic, '"فولفيتيك" <no-reply@volvitech.com>');
    });

    it("quotes plain display name only when needed", () => {
      const resultPlain = buildFromHeader('Volvitech', 'no-reply@volvitech.com');
      assert.strictEqual(resultPlain, 'Volvitech <no-reply@volvitech.com>');
    });

    it("defensively trims stray trailing quotes from env var strings (reproducing and fixing the live issue)", () => {
      // Live bug case: MAILGUN_FROM was parsed or configured with a trailing quote
      const resultWithTrailingQuote = buildFromHeader('Volvitech" <no-reply@inbound.volvitech.com>');
      assert.strictEqual(resultWithTrailingQuote, 'Volvitech <no-reply@inbound.volvitech.com>');
    });

    it("defensively trims stray surrounding quotes from env var strings", () => {
      const resultWithSurroundingQuotes = buildFromHeader('"Volvitech" <no-reply@inbound.volvitech.com>');
      assert.strictEqual(resultWithSurroundingQuotes, 'Volvitech <no-reply@inbound.volvitech.com>');
    });
  });

  describe("Base HTML Template Unsubscribe Link & Configurable Branding", () => {
    it("confirms unsubscribe link is present in the footer when leadId is provided", () => {
      const html = getBaseHtmlTemplate("<p>Hello</p>", "lead-test-123");
      assert.ok(html.includes("/api/v1/leads/unsubscribe/lead-test-123"));
      assert.ok(html.includes("Unsubscribe here"));
    });

    it("uses configurable COMPANY_NAME in the header and copyright footer with fallback", () => {
      const origCompany = process.env.COMPANY_NAME;
      try {
        process.env.COMPANY_NAME = "Volvitech Innovations";
        const html = getBaseHtmlTemplate("<p>Hello</p>");
        assert.ok(html.includes("<h1>VOLVITECH INNOVATIONS</h1>"));
        assert.ok(html.includes("Volvitech Innovations. All rights reserved."));

        delete process.env.COMPANY_NAME;
        const defaultHtml = getBaseHtmlTemplate("<p>Hello</p>");
        assert.ok(defaultHtml.includes("<h1>NEXUS CRM</h1>"));
        assert.ok(defaultHtml.includes("Nexus CRM. All rights reserved."));
      } finally {
        process.env.COMPANY_NAME = origCompany;
      }
    });
  });
});
