import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplateVariables,
  suggestDefaultVariableValue,
  listWhatsAppTemplates,
  clearWhatsAppTemplateCache
} from "../../src/services/whatsappTemplateService";

describe("WhatsApp Template Service & Helpers Unit Tests", () => {
  describe("1. Variable Extraction Helper (extractTemplateVariables)", () => {
    it("extracts ordered numerical placeholder keys from template body", () => {
      const body = "Hi {{1}}, welcome to {{2}}! Your appointment is confirmed for {{3}}.";
      const vars = extractTemplateVariables(body);
      assert.deepEqual(vars, ["1", "2", "3"]);
    });

    it("deduplicates repeated placeholders while preserving first occurrence order", () => {
      const body = "Hi {{1}}, thanks for choosing {{2}}. Remember {{1}}, our support team at {{2}} is here.";
      const vars = extractTemplateVariables(body);
      assert.deepEqual(vars, ["1", "2"]);
    });

    it("handles arbitrary spacing inside curly braces", () => {
      const body = "Hello {{   1  }}, welcome from {{2 }} to {{  3}}!";
      const vars = extractTemplateVariables(body);
      assert.deepEqual(vars, ["1", "2", "3"]);
    });

    it("extracts alphanumeric and named placeholders correctly", () => {
      const body = "Dear {{firstName}}, thank you for contacting {{company_name}} regarding {{campaign_id}}.";
      const vars = extractTemplateVariables(body);
      assert.deepEqual(vars, ["firstName", "company_name", "campaign_id"]);
    });

    it("unions placeholders in body with keys from Twilio's variables map", () => {
      const body = "Hi {{1}} from {{2}}!";
      const twilioVars = {
        "1": "John",
        "2": "Acme",
        "3": "Extra Var",
        "4": "Another Var"
      };
      const vars = extractTemplateVariables(body, twilioVars);
      assert.deepEqual(vars, ["1", "2", "3", "4"]);
    });

    it("handles empty body gracefully", () => {
      assert.deepEqual(extractTemplateVariables(""), []);
      assert.deepEqual(extractTemplateVariables("", { "1": "val1" }), ["1"]);
    });
  });

  describe("2. Default Suggestion Helper (suggestDefaultVariableValue)", () => {
    it("suggests {{firstName}} when preceded by greetings like 'Hi', 'Hello', 'Dear'", () => {
      assert.equal(suggestDefaultVariableValue("1", "Hi {{1}}, welcome!"), "{{firstName}}");
      assert.equal(suggestDefaultVariableValue("1", "Hello {{1}}, here is your code."), "{{firstName}}");
      assert.equal(suggestDefaultVariableValue("1", "Dear {{1}}, we are writing to update you."), "{{firstName}}");
      assert.equal(suggestDefaultVariableValue("name", "Greetings {{name}}!"), "{{firstName}}");
    });

    it("suggests {{company}} when preceded by 'from', 'at', 'welcome to', or 'team at'", () => {
      assert.equal(suggestDefaultVariableValue("2", "Welcome to {{2}}!"), "{{company}}");
      assert.equal(suggestDefaultVariableValue("4", "Thank you from {{4}}."), "{{company}}");
      assert.equal(suggestDefaultVariableValue("2", "The entire team at {{2}} wishes you well."), "{{company}}");
      assert.equal(suggestDefaultVariableValue("org", "We appreciate your partnership with {{org}}."), "{{company}}");
    });

    it("suggests {{campaignName}} when preceded by campaign or promotional keywords", () => {
      assert.equal(suggestDefaultVariableValue("3", "Here is an exclusive offer for the {{3}} campaign."), "{{campaignName}}");
      assert.equal(suggestDefaultVariableValue("promo", "Regarding our special {{promo}} promotion."), "{{campaignName}}");
    });

    it("suggests {{lastName}} when preceded by last name / surname hints", () => {
      assert.equal(suggestDefaultVariableValue("2", "Hello Mr. {{2}}, your invoice is ready."), "{{lastName}}");
      assert.equal(suggestDefaultVariableValue("surname", "Dear {{surname}}, welcome."), "{{lastName}}");
    });

    it("infers from sample value when body context is generic", () => {
      assert.equal(suggestDefaultVariableValue("var1", "Notice: {{var1}}", "Alex Johnson"), "{{firstName}}");
      assert.equal(suggestDefaultVariableValue("var2", "Notice: {{var2}}", "Acme Corporation"), "{{company}}");
      assert.equal(suggestDefaultVariableValue("var3", "Notice: {{var3}}", "Q4 Fall Promo"), "{{campaignName}}");
    });

    it("falls back to sensible positional defaults for 1, 2, 3", () => {
      assert.equal(suggestDefaultVariableValue("1", "{{1}}"), "{{firstName}}");
      assert.equal(suggestDefaultVariableValue("2", "{{2}}"), "{{company}}");
      assert.equal(suggestDefaultVariableValue("3", "{{3}}"), "{{campaignName}}");
    });
  });

  describe("3. Simulated WhatsApp Templates & Listing", () => {
    it("returns 3 clearly labelled simulated templates when Twilio credentials are not set", async () => {
      // Temporarily ensure no Twilio credentials
      const origSid = process.env.TWILIO_ACCOUNT_SID;
      const origToken = process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      clearWhatsAppTemplateCache();

      try {
        const result = await listWhatsAppTemplates();
        assert.equal(result.simulated, true);
        assert.equal(Array.isArray(result.templates), true);
        assert.equal(result.templates.length, 3);

        const [t1, t2, t3] = result.templates;
        // Verify approved ones are usable
        assert.equal(t1.usable, true);
        assert.equal(t1.approvalStatus, "approved");
        assert.equal(t2.usable, true);
        assert.equal(t2.approvalStatus, "approved");

        // Verify pending one is not usable
        assert.equal(t3.usable, false);
        assert.equal(t3.approvalStatus, "pending");

        // Verify variable extraction on simulated templates
        assert.deepEqual(t1.variables, ["1", "2"]);
        assert.deepEqual(t2.variables, ["1", "2", "3", "4"]);
      } finally {
        process.env.TWILIO_ACCOUNT_SID = origSid;
        process.env.TWILIO_AUTH_TOKEN = origToken;
      }
    });
  });
});
