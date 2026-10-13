import {
  extractTemplateVariables,
  suggestDefaultVariableValue,
  buildPreviewSegments,
  DEFAULT_SAMPLE_LEAD
} from "../utils/whatsappTemplateHelpers";

describe("Frontend WhatsApp Template Picker Helpers", () => {
  describe("1. Variable Extraction", () => {
    it("extracts placeholders in order and unions with Twilio variables", () => {
      const body = "Hi {{1}}, welcome from {{2}} to {{3}}!";
      const twilioVars = { "1": "Alex", "4": "Support Team" };
      const vars = extractTemplateVariables(body, twilioVars);
      expect(vars).toEqual(["1", "2", "3", "4"]);
    });

    it("deduplicates repeated placeholders", () => {
      const body = "{{1}} and {{2}} and {{1}}";
      expect(extractTemplateVariables(body)).toEqual(["1", "2"]);
    });
  });

  describe("2. Default Suggestion Helper", () => {
    it("suggests {{firstName}} for greetings", () => {
      expect(suggestDefaultVariableValue("1", "Hi {{1}}, welcome")).toEqual("{{firstName}}");
      expect(suggestDefaultVariableValue("1", "Dear {{1}}, notice")).toEqual("{{firstName}}");
    });

    it("suggests {{company}} for company hints", () => {
      expect(suggestDefaultVariableValue("2", "Welcome to {{2}}!")).toEqual("{{company}}");
      expect(suggestDefaultVariableValue("4", "Sent from {{4}}.")).toEqual("{{company}}");
    });

    it("suggests {{campaignName}} for promotional context", () => {
      expect(
        suggestDefaultVariableValue("3", "Special offer for our {{3}} promo!")
      ).toEqual("{{campaignName}}");
    });
  });

  describe("3. Live Preview Segments Builder", () => {
    it("substitutes variables and marks them as highlighted segments", () => {
      const body = "Hi {{1}}, thank you from {{2}}!";
      const variables = [
        { key: "1", value: "{{firstName}}" },
        { key: "2", value: "{{company}}" }
      ];

      const segments = buildPreviewSegments(body, variables, true, {
        firstName: "Alex",
        lastName: "Taylor",
        company: "Acme Corp",
        campaignName: "Promo"
      });

      expect(segments).toEqual([
        { text: "Hi ", isHighlight: false },
        { text: "Alex", isHighlight: true, varKey: "1", resolvedValue: "Alex" },
        { text: ", thank you from ", isHighlight: false },
        { text: "Acme Corp", isHighlight: true, varKey: "2", resolvedValue: "Acme Corp" },
        { text: "!", isHighlight: false }
      ]);
    });

    it("delivers firstName as 'Customer' when useCustomerNames is false", () => {
      const body = "Hi {{1}}!";
      const variables = [{ key: "1", value: "{{firstName}}" }];

      const segments = buildPreviewSegments(body, variables, false, DEFAULT_SAMPLE_LEAD);
      expect(segments).toEqual([
        { text: "Hi ", isHighlight: false },
        { text: "Customer", isHighlight: true, varKey: "1", resolvedValue: "Customer" },
        { text: "!", isHighlight: false }
      ]);
    });

    it("uses custom text if user typed custom text for a blank", () => {
      const body = "Your discount code is {{1}} from {{2}}.";
      const variables = [
        { key: "1", value: "SUMMER50" },
        { key: "2", value: "{{company}}" }
      ];

      const segments = buildPreviewSegments(body, variables, true, DEFAULT_SAMPLE_LEAD);
      expect(segments).toEqual([
        { text: "Your discount code is ", isHighlight: false },
        { text: "SUMMER50", isHighlight: true, varKey: "1", resolvedValue: "SUMMER50" },
        { text: " from ", isHighlight: false },
        { text: DEFAULT_SAMPLE_LEAD.company, isHighlight: true, varKey: "2", resolvedValue: DEFAULT_SAMPLE_LEAD.company },
        { text: ".", isHighlight: false }
      ]);
    });

    it("defaults empty blanks to 'Customer'", () => {
      const body = "Hello {{1}}!";
      const variables = [{ key: "1", value: "" }];

      const segments = buildPreviewSegments(body, variables, true, DEFAULT_SAMPLE_LEAD);
      expect(segments).toEqual([
        { text: "Hello ", isHighlight: false },
        { text: "Customer", isHighlight: true, varKey: "1", resolvedValue: "Customer" },
        { text: "!", isHighlight: false }
      ]);
    });
  });
});
