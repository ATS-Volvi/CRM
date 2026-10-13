import { describe, it } from "node:test";
import assert from "node:assert";
import {
  renderEmailSubjectForLead,
  renderEmailForLead,
  renderWhatsAppTemplateVariables,
  tidyPunctuationAndWhitespace,
  cleanFieldValue,
  MAX_SUBJECT_LENGTH
} from "../../src/services/campaignMessageService";
import {
  buildFromHeader,
  getBaseHtmlTemplate
} from "../../src/services/emailService";

describe("Campaign Name Safety & Personalization Unit Tests", () => {
  describe("1. Workspace Setting: Setting OFF (Default) vs ON", () => {
    const lead = {
      id: "lead-safety-1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Babbage Analytics"
    };
    const campaignName = "Q4 Enterprise Drive";

    it("Email Subject: when OFF (default), renders {{firstName}} as 'Customer' and {{lastName}} as empty with tidied punctuation", () => {
      const subjectTemplate = "Exclusive briefing for {{firstName}} {{lastName}}, from {{company}}!";
      const renderedOff = renderEmailSubjectForLead(subjectTemplate, lead, campaignName, MAX_SUBJECT_LENGTH, false);
      assert.strictEqual(
        renderedOff,
        "Exclusive briefing for Customer, from Babbage Analytics!"
      );
      assert.ok(!renderedOff.includes("Ada"));
      assert.ok(!renderedOff.includes("Lovelace"));
    });

    it("Email Subject: when ON, renders real lead first and last names", () => {
      const subjectTemplate = "Exclusive briefing for {{firstName}} {{lastName}}, from {{company}}!";
      const renderedOn = renderEmailSubjectForLead(subjectTemplate, lead, campaignName, MAX_SUBJECT_LENGTH, true);
      assert.strictEqual(
        renderedOn,
        "Exclusive briefing for Ada Lovelace, from Babbage Analytics!"
      );
    });

    it("Email Body: when OFF (default), replaces {{firstName}} with 'Customer', {{lastName}} with empty, and tidies whitespace before punctuation", () => {
      const bodyHtml = "<p>Dear {{firstName}} {{lastName}},</p><p>Special update for {{company}}.</p>";
      const renderedOff = renderEmailForLead(bodyHtml, lead, campaignName, "rec-1", false);
      assert.ok(renderedOff.includes("<p>Dear Customer,</p>"), "Should tidy 'Customer ,' into 'Customer,'");
      assert.ok(renderedOff.includes("<p>Special update for Babbage Analytics.</p>"));
      assert.ok(!renderedOff.includes("Ada"));
      assert.ok(!renderedOff.includes("Lovelace"));
    });

    it("Email Body: when ON, renders real names", () => {
      const bodyHtml = "<p>Dear {{firstName}} {{lastName}},</p>";
      const renderedOn = renderEmailForLead(bodyHtml, lead, campaignName, "rec-1", true);
      assert.ok(renderedOn.includes("<p>Dear Ada Lovelace,</p>"));
    });

    it("WhatsApp: when OFF (default), variables replace {{firstName}} with 'Customer' and {{lastName}} with empty", () => {
      const vars = {
        name: "{{firstName}} {{lastName}}",
        org: "{{company}}",
        greeting: "Hello {{firstName}}!"
      };
      const renderedOff = renderWhatsAppTemplateVariables(vars, lead, campaignName, false);
      assert.strictEqual(renderedOff.name, "Customer");
      assert.strictEqual(renderedOff.org, "Babbage Analytics");
      assert.strictEqual(renderedOff.greeting, "Hello Customer!");
    });

    it("WhatsApp: when ON, variables use real lead names", () => {
      const vars = {
        name: "{{firstName}} {{lastName}}",
        org: "{{company}}"
      };
      const renderedOn = renderWhatsAppTemplateVariables(vars, lead, campaignName, true);
      assert.strictEqual(renderedOn.name, "Ada Lovelace");
      assert.strictEqual(renderedOn.org, "Babbage Analytics");
    });
  });

  describe("2. Placeholder Safety & No Dangling Punctuation", () => {
    it("never outputs raw or leftover braces {{ }} or { }", () => {
      const subjectTemplate = "Hello {{unknown_placeholder}} {{unbalanced_tag}} { {{company}} }";
      const lead = { company: "Acme Corp" };
      const rendered = renderEmailSubjectForLead(subjectTemplate, lead, "Campaign");
      assert.strictEqual(rendered, "Hello Acme Corp");
      assert.ok(!rendered.includes("{"));
      assert.ok(!rendered.includes("}"));
    });

    it("never outputs 'undefined' or 'null' even if lead fields are stringified dirty values", () => {
      const dirtyLead = {
        firstName: "undefined",
        lastName: "null",
        company: "NULL"
      };
      // When ON: dirty strings should be cleaned to empty
      const subjectOn = renderEmailSubjectForLead("Offer for {{firstName}} {{lastName}} at {{company}}", dirtyLead, "Promo", MAX_SUBJECT_LENGTH, true);
      assert.ok(!subjectOn.toLowerCase().includes("undefined"));
      assert.ok(!subjectOn.toLowerCase().includes("null"));

      // When OFF: firstName is Customer, dirty fields sanitized
      const subjectOff = renderEmailSubjectForLead("Offer for {{firstName}} at {{company}}", dirtyLead, "Promo", MAX_SUBJECT_LENGTH, false);
      assert.ok(subjectOff.includes("Customer"));
      assert.ok(!subjectOff.toLowerCase().includes("undefined"));
      assert.ok(!subjectOff.toLowerCase().includes("null"));
    });

    it("tidies dangling leading punctuation when firstName is missing (ON setting)", () => {
      const leadNoName = { firstName: null, lastName: null };
      const subject = renderEmailSubjectForLead("{{firstName}}, your offer is ready", leadNoName, "Promo", MAX_SUBJECT_LENGTH, true);
      assert.strictEqual(subject, "your offer is ready");
      assert.ok(!subject.startsWith(","));
    });

    it("strips CR and LF characters from subject line", () => {
      const lead = { company: "Apex Inc" };
      const rawSubject = "Promo Deal\r\nSubject: Injected\nFor {{company}}";
      const subject = renderEmailSubjectForLead(rawSubject, lead, "Campaign");
      assert.ok(!subject.includes("\r"));
      assert.ok(!subject.includes("\n"));
      assert.strictEqual(subject, "Promo Deal Subject: Injected For Apex Inc");
    });
  });

  describe("3. WhatsApp Variable Guarantees", () => {
    it("variables are never empty, defaulting to 'Customer'", () => {
      const vars = {
        1: "",
        2: "   ",
        3: "{{emptyField}}",
        4: "{{firstName}}"
      };
      const leadWithoutName = { firstName: null };
      const rendered = renderWhatsAppTemplateVariables(vars, leadWithoutName, "Campaign", true);
      assert.strictEqual(rendered["1"], "Customer");
      assert.strictEqual(rendered["2"], "Customer");
      assert.strictEqual(rendered["3"], "Customer");
      assert.strictEqual(rendered["4"], "Customer");
    });

    it("zero-variable WhatsApp messages return empty object without adding keys", () => {
      const emptyVars = {};
      const rendered = renderWhatsAppTemplateVariables(emptyVars, { firstName: "Alan" }, "Promo", true);
      assert.deepStrictEqual(rendered, {});

      const nullVars = null;
      const renderedNull = renderWhatsAppTemplateVariables(nullVars, { firstName: "Alan" }, "Promo", true);
      assert.deepStrictEqual(renderedNull, {});
    });

    it("strips raw braces and unknown tokens from WhatsApp variable values", () => {
      const vars = {
        1: "{PromoCode} {{unsupported}} - {{company}}"
      };
      const lead = { company: "FACE" };
      const rendered = renderWhatsAppTemplateVariables(vars, lead, "Campaign", false);
      assert.strictEqual(rendered["1"], "PromoCode - FACE");
      assert.ok(!rendered["1"].includes("{"));
      assert.ok(!rendered["1"].includes("}"));
    });
  });

  describe("4. Old Saved Templates Backward Compatibility", () => {
    it("saved email template with {{firstName}} {{lastName}} renders safely under OFF setting", () => {
      const oldTemplate = "<p>Hi {{firstName}} {{lastName}},</p><p>Check out our catalog at {{company}}.</p>";
      const lead = { id: "ld-old", firstName: "Inquiry User 7484", lastName: "", company: "Global Supplies" };
      const rendered = renderEmailForLead(oldTemplate, lead, "Old Campaign", "rec-old", false);
      assert.ok(rendered.includes("<p>Hi Customer,</p>"));
      assert.ok(!rendered.includes("Inquiry User 7484"));
    });
  });

  describe("5. Branding & Unsubscribe Link", () => {
    it("email template defaults to 'FACE Contracting Co.' when COMPANY_NAME is unset", () => {
      const orig = process.env.COMPANY_NAME;
      try {
        delete process.env.COMPANY_NAME;
        const html = getBaseHtmlTemplate("<p>Hello</p>");
        assert.ok(html.includes("<h1>FACE CONTRACTING CO.</h1>"));
        assert.ok(html.includes("FACE Contracting Co. All rights reserved."));
      } finally {
        process.env.COMPANY_NAME = orig;
      }
    });

    it("email template respects COMPANY_NAME when explicitly configured in environment", () => {
      const orig = process.env.COMPANY_NAME;
      try {
        process.env.COMPANY_NAME = "Volvitech Innovations";
        const html = getBaseHtmlTemplate("<p>Hello</p>");
        assert.ok(html.includes("<h1>VOLVITECH INNOVATIONS</h1>"));
        assert.ok(html.includes("Volvitech Innovations. All rights reserved."));
      } finally {
        process.env.COMPANY_NAME = orig;
      }
    });

    it("includes unsubscribe link built from BASE_URL when leadId is present", () => {
      const html = getBaseHtmlTemplate("<p>Body</p>", "lead-xyz-999");
      assert.ok(html.includes("/api/v1/leads/unsubscribe/lead-xyz-999"));
      assert.ok(html.includes("Unsubscribe here"));
    });

    it("regression test: From display name has no stray quotes", () => {
      const singleQuotes = buildFromHeader('"FACE Contracting Co." <no-reply@face.com>');
      assert.strictEqual(singleQuotes, "FACE Contracting Co. <no-reply@face.com>");

      const doubleQuotes = buildFromHeader('""FACE Contracting Co."" <no-reply@face.com>');
      assert.strictEqual(doubleQuotes, "FACE Contracting Co. <no-reply@face.com>");

      const trailingQuote = buildFromHeader('FACE Contracting Co." <no-reply@face.com>');
      assert.strictEqual(trailingQuote, "FACE Contracting Co. <no-reply@face.com>");
    });
  });
});
