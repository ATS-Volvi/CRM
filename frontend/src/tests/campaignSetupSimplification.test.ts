/**
 * Comprehensive Unit Tests for Campaign Setup Simplification
 *
 * Feature 1: Clean campaign codes (suggestion, validation, ambiguous warning, font stack)
 * Feature 2: Copy tracked link (channel UTMs, base URL, URL encoding, disabled states)
 * Feature 3: Visible send-mode banner & endpoint security (modes, endpoint shape, leak prevention)
 */

import {
  generateCampaignCodeSuggestion,
  validateCampaignCode,
  checkAmbiguousCodeCharacters,
  getChannelCodePrefix,
  AMBIGUOUS_CHARS_REGEX
} from "../utils/campaignCodeHelper";

import {
  buildTrackedCampaignUrl,
  getCampaignTrackedLinks,
  TRACKED_CHANNELS,
  DEFAULT_PUBLIC_QUOTE_URL
} from "../utils/campaignTrackingUrl";

import {
  computeChannelSendMode
} from "../components/CampaignSendModeBanner";

import {
  getCampaignSendModeHandler
} from "../../../backend/src/controllers/campaignMessageController";

describe("Campaign Setup Simplification Tests", () => {
  // =========================================================================
  // FEATURE 1: Clean Campaign Codes
  // =========================================================================
  describe("Feature 1: Clean Campaign Codes", () => {
    describe("1.1 Code suggestion generation", () => {
      test("suggests uppercase code with channel prefix avoiding ambiguous characters (O, 0, I, 1, L)", () => {
        const suggestion = generateCampaignCodeSuggestion("Summer Offer 2026", "WhatsApp");
        expect(suggestion).toBeDefined();
        // Check allowed charset
        expect(/^[A-Z0-9-]+$/.test(suggestion)).toBe(true);
        // Prefix for WhatsApp
        expect(suggestion.startsWith("WA-")).toBe(true);
        // Must NOT contain O, 0, I, 1, or L
        expect(suggestion).not.toMatch(AMBIGUOUS_CHARS_REGEX);
      });

      test("suggests channel prefixes: WA for WhatsApp, GRAM for Instagram, EM for Email", () => {
        expect(getChannelCodePrefix("WhatsApp")).toBe("WA");
        expect(getChannelCodePrefix("Instagram")).toBe("GRAM");
        expect(getChannelCodePrefix("Email")).toBe("EM");
      });

      test("strips ambiguous characters from generated code even when present in campaign name", () => {
        // Name containing O, 0, I, 1, L: "ONLINE 100 DEAL"
        const suggestion = generateCampaignCodeSuggestion("ONLINE 100 DEAL", "Email");
        expect(suggestion.startsWith("EM-")).toBe(true);
        expect(suggestion).not.toMatch(/[O0I1L]/);
      });

      test("generates unique suggestion when base candidate already exists", () => {
        const existing = ["WA-SUMMER", "WA-SUMMER-2", "WA-SUMMER-3"];
        const suggestion = generateCampaignCodeSuggestion("Summer", "WhatsApp", existing);
        expect(existing).not.toContain(suggestion);
        expect(suggestion).toBe("WA-SUMMER-4");
      });

      test("suggestion handles empty name gracefully with a safe date-based slug without ambiguous chars", () => {
        const suggestion = generateCampaignCodeSuggestion("", "Instagram");
        expect(suggestion.startsWith("GRAM-")).toBe(true);
        expect(/^[A-Z0-9-]+$/.test(suggestion)).toBe(true);
        expect(suggestion).not.toMatch(/[O0I1L]/);
      });
    });

    describe("1.2 Code validation (charset, length, uniqueness case-insensitive)", () => {
      test("accepts valid codes matching [A-Za-z0-9-] between 2 and 50 characters", () => {
        const res = validateCampaignCode("WA-OCT26", []);
        expect(res.isValid).toBe(true);
        expect(res.error).toBeUndefined();
      });

      test("rejects empty, null, or whitespace-only code", () => {
        expect(validateCampaignCode("", []).isValid).toBe(false);
        expect(validateCampaignCode("   ", []).isValid).toBe(false);
        expect(validateCampaignCode(null, []).isValid).toBe(false);
      });

      test("rejects codes shorter than 2 characters", () => {
        const res = validateCampaignCode("A", []);
        expect(res.isValid).toBe(false);
        expect(res.error).toContain("at least 2 characters");
      });

      test("rejects codes longer than 50 characters", () => {
        const tooLong = "A".repeat(51);
        const res = validateCampaignCode(tooLong, []);
        expect(res.isValid).toBe(false);
        expect(res.error).toContain("cannot exceed 50 characters");
      });

      test("rejects invalid characters (spaces, underscores, symbols)", () => {
        expect(validateCampaignCode("WA OCT", []).isValid).toBe(false);
        expect(validateCampaignCode("WA_OCT", []).isValid).toBe(false);
        expect(validateCampaignCode("WA@OCT", []).isValid).toBe(false);
        expect(validateCampaignCode("WA#OCT", []).isValid).toBe(false);
      });

      test("rejects duplicate code case-insensitively", () => {
        const existing = [{ id: "c1", code: "WA-OCT26" }];
        // Lowercase duplicate
        const resLower = validateCampaignCode("wa-oct26", existing);
        expect(resLower.isValid).toBe(false);
        expect(resLower.error).toContain("already in use");

        // Uppercase duplicate
        const resUpper = validateCampaignCode("WA-OCT26", existing);
        expect(resUpper.isValid).toBe(false);
      });

      test("allows saving the same campaign without false duplicate error on edit", () => {
        const existing = [
          { id: "c1", code: "WA-OCT26" },
          { id: "c2", code: "EM-NOV26" }
        ];
        // Editing c1 keeping WA-OCT26
        const res = validateCampaignCode("WA-OCT26", existing, "c1");
        expect(res.isValid).toBe(true);
      });
    });

    describe("1.3 Ambiguous characters warning (non-blocking)", () => {
      test("warns when letter O is adjacent to digits (e.g. E00, O9)", () => {
        const res = checkAmbiguousCodeCharacters("E00");
        expect(res.hasWarning).toBe(true);
        expect(res.warning).toBe("This code mixes O/0 or I/1. Double-check it before sharing links.");

        const res2 = checkAmbiguousCodeCharacters("O9-DEAL");
        expect(res2.hasWarning).toBe(true);
      });

      test("warns when digit 0 is adjacent to letters (e.g. 0F, PROMO0)", () => {
        const res = checkAmbiguousCodeCharacters("0F");
        expect(res.hasWarning).toBe(true);
        expect(res.warning).toBe("This code mixes O/0 or I/1. Double-check it before sharing links.");
      });

      test("warns when letter I or L is mixed with digit 1 (e.g. I1, L1, 1I)", () => {
        expect(checkAmbiguousCodeCharacters("I1").hasWarning).toBe(true);
        expect(checkAmbiguousCodeCharacters("SALE-1L").hasWarning).toBe(true);
      });

      test("warns when code contains both letter O and digit 0 anywhere", () => {
        const res = checkAmbiguousCodeCharacters("OCTOBER-2026");
        expect(res.hasWarning).toBe(true);
      });

      test("does not warn on clean codes without ambiguous mixes", () => {
        expect(checkAmbiguousCodeCharacters("WA-OCT26").hasWarning).toBe(false);
        expect(checkAmbiguousCodeCharacters("EM-NOV26").hasWarning).toBe(false);
        expect(checkAmbiguousCodeCharacters("BLACK-FRIDAY").hasWarning).toBe(false);
      });

      test("warning is non-blocking in validateCampaignCode: code remains valid", () => {
        // E00 is a valid 3-char code matching charset, but triggers ambiguous warning
        const res = validateCampaignCode("E00", []);
        expect(res.isValid).toBe(true);
        expect(res.hasWarning).toBe(true);
        expect(res.warning).toBe("This code mixes O/0 or I/1. Double-check it before sharing links.");
      });
    });

    describe("1.4 Legacy campaigns preservation", () => {
      test("existing campaigns with legacy codes (E00, 0F, WA-OCT) validate successfully", () => {
        const legacyCodes = ["E00", "0F", "WA-OCT"];
        for (const code of legacyCodes) {
          const res = validateCampaignCode(code, []);
          expect(res.isValid).toBe(true);
        }
      });
    });
  });

  // =========================================================================
  // FEATURE 2: Copy Tracked Link
  // =========================================================================
  describe("Feature 2: Copy Tracked Link", () => {
    const base = "https://face-website-fawn.vercel.app/quote.html";

    test("builds exact expected URL for WhatsApp broadcast", () => {
      const url = buildTrackedCampaignUrl("WA-OCT26", "whatsapp", "broadcast", base);
      expect(url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=WA-OCT26&utm_source=whatsapp&utm_medium=broadcast");
    });

    test("builds exact expected URL for Instagram paid social", () => {
      const url = buildTrackedCampaignUrl("IG-OCT26", "instagram", "paid_social", base);
      expect(url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=IG-OCT26&utm_source=instagram&utm_medium=paid_social");
    });

    test("builds exact expected URL for Email newsletter", () => {
      const url = buildTrackedCampaignUrl("EM-OCT26", "email", "newsletter", base);
      expect(url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=EM-OCT26&utm_source=email&utm_medium=newsletter");
    });

    test("URL-encodes campaign codes with spaces or special characters", () => {
      const url = buildTrackedCampaignUrl("WA SUMMER 2026", "whatsapp", "broadcast", base);
      expect(url).toContain("utm_campaign=WA%20SUMMER%202026");
      expect(url).not.toContain(" ");

      const urlSpecial = buildTrackedCampaignUrl("CODE&MORE=1", "email", "newsletter", base);
      expect(urlSpecial).toContain("utm_campaign=CODE%26MORE%3D1");
    });

    test("uses configurable base URL properly when provided", () => {
      const customBase = "https://custom-portal.example.com/quote";
      const url = buildTrackedCampaignUrl("TEST-CODE", "whatsapp", "broadcast", customBase);
      expect(url.startsWith("https://custom-portal.example.com/quote?")).toBe(true);
      expect(url).toBe("https://custom-portal.example.com/quote?utm_campaign=TEST-CODE&utm_source=whatsapp&utm_medium=broadcast");
    });

    test("preserves hash fragments and appends query parameters before hash", () => {
      const baseWithHash = "https://example.com/quote.html#form";
      const url = buildTrackedCampaignUrl("WA-OCT26", "whatsapp", "broadcast", baseWithHash);
      expect(url).toBe("https://example.com/quote.html?utm_campaign=WA-OCT26&utm_source=whatsapp&utm_medium=broadcast#form");
    });

    test("getCampaignTrackedLinks returns all 3 supported channels for valid campaign code", () => {
      const links = getCampaignTrackedLinks("PROMO-26", base);
      expect(links).toHaveLength(3);

      const wa = links.find((l) => l.channel === "WhatsApp");
      expect(wa?.url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=PROMO-26&utm_source=whatsapp&utm_medium=broadcast");

      const ig = links.find((l) => l.channel === "Instagram");
      expect(ig?.url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=PROMO-26&utm_source=instagram&utm_medium=paid_social");

      const em = links.find((l) => l.channel === "Email");
      expect(em?.url).toBe("https://face-website-fawn.vercel.app/quote.html?utm_campaign=PROMO-26&utm_source=email&utm_medium=newsletter");
    });

    test("getCampaignTrackedLinks returns empty array when campaign code is empty or null", () => {
      expect(getCampaignTrackedLinks("")).toEqual([]);
      expect(getCampaignTrackedLinks(null)).toEqual([]);
      expect(getCampaignTrackedLinks("   ")).toEqual([]);
    });
  });

  // =========================================================================
  // FEATURE 3: Visible Send-Mode Banner & Read-Only Endpoint Security
  // =========================================================================
  describe("Feature 3: Visible Send-Mode Banner & Backend Endpoint", () => {
    describe("3.1 computeChannelSendMode states", () => {
      test("computes DRY RUN mode when dryRun is true", () => {
        const mode = computeChannelSendMode({
          dryRun: true,
          allowlistActive: false,
          allowlistCount: 0,
          maxRecipients: 50
        });
        expect(mode.mode).toBe("DRY_RUN");
        expect(mode.title).toBe("DRY RUN");
        expect(mode.description).toBe("No real messages will be sent.");
      });

      test("computes TEST MODE when dryRun is false and allowlist is active", () => {
        const mode = computeChannelSendMode({
          dryRun: false,
          allowlistActive: true,
          allowlistCount: 3,
          maxRecipients: 50
        });
        expect(mode.mode).toBe("TEST_MODE");
        expect(mode.title).toBe("TEST MODE");
        expect(mode.description).toBe("Only 3 allowlisted recipients will receive messages.");
      });

      test("computes LIVE mode when dryRun is false and allowlist is inactive", () => {
        const mode = computeChannelSendMode({
          dryRun: false,
          allowlistActive: false,
          allowlistCount: 0,
          maxRecipients: 100
        });
        expect(mode.mode).toBe("LIVE");
        expect(mode.title).toBe("LIVE");
        expect(mode.description).toBe("No allowlist is active. Messages go to ALL eligible recipients.");
      });

      test("degrades gracefully to UNKNOWN mode when config is null or undefined without throwing", () => {
        const modeNull = computeChannelSendMode(null);
        expect(modeNull.mode).toBe("UNKNOWN");
        expect(modeNull.title).toBe("MODE UNKNOWN");
        expect(modeNull.description).toContain("Unable to verify delivery mode");

        const modeUndefined = computeChannelSendMode(undefined);
        expect(modeUndefined.mode).toBe("UNKNOWN");
      });
    });

    describe("3.2 Backend send-mode endpoint security & leak prevention", () => {
      const originalEnv = { ...process.env };

      afterEach(() => {
        process.env = { ...originalEnv };
      });

      test("endpoint returns strictly 4 fields per channel: { dryRun, allowlistActive, allowlistCount, maxRecipients }", async () => {
        // Set env vars
        process.env.CAMPAIGN_EMAIL_DRY_RUN = "false";
        process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST = "test1@example.com,test2@example.com";
        process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "true";
        process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST = "+1234567890";
        process.env.SENDGRID_API_KEY = "SG.secret_key_123456";
        process.env.TWILIO_AUTH_TOKEN = "twilio_auth_secret_789";

        let responseData: any = null;
        let statusCode = 200;

        const req = {} as any;
        const res = {
          status: (code: number) => {
            statusCode = code;
            return res;
          },
          json: (data: any) => {
            responseData = data;
            return res;
          }
        } as any;

        await getCampaignSendModeHandler(req, res);

        expect(statusCode).toBe(200);
        expect(responseData).toBeDefined();
        expect(responseData.whatsapp).toBeDefined();
        expect(responseData.email).toBeDefined();

        // Check exact keys for whatsapp
        const waKeys = Object.keys(responseData.whatsapp).sort();
        expect(waKeys).toEqual(["allowlistActive", "allowlistCount", "dryRun", "maxRecipients"]);

        // Check exact keys for email
        const emailKeys = Object.keys(responseData.email).sort();
        expect(emailKeys).toEqual(["allowlistActive", "allowlistCount", "dryRun", "maxRecipients"]);

        // Values match env state
        expect(responseData.whatsapp.dryRun).toBe(true);
        expect(responseData.whatsapp.allowlistActive).toBe(true);
        expect(responseData.whatsapp.allowlistCount).toBe(1);

        expect(responseData.email.dryRun).toBe(false);
        expect(responseData.email.allowlistActive).toBe(true);
        expect(responseData.email.allowlistCount).toBe(2);
      });

      test("endpoint NEVER leaks secrets, tokens, or allowlist recipient contents", async () => {
        // Populate sensitive values in process.env
        process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST = "supersecret_ceo@company.com,private_vip@client.com";
        process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST = "+919876543210,+15551234567";
        process.env.TWILIO_ACCOUNT_SID = "AC_SECRET_SID";
        process.env.TWILIO_AUTH_TOKEN = "SECRET_AUTH_TOKEN";
        process.env.SENDGRID_API_KEY = "SG.SUPER_SECRET_KEY";

        let responseData: any = null;
        const req = {} as any;
        const res = {
          json: (data: any) => {
            responseData = data;
          }
        } as any;

        await getCampaignSendModeHandler(req, res);

        const jsonString = JSON.stringify(responseData);

        // Prove NO leak of recipient emails or phone numbers
        expect(jsonString).not.toContain("supersecret_ceo@company.com");
        expect(jsonString).not.toContain("private_vip@client.com");
        expect(jsonString).not.toContain("9876543210");
        expect(jsonString).not.toContain("15551234567");

        // Prove NO leak of API secrets or tokens
        expect(jsonString).not.toContain("AC_SECRET_SID");
        expect(jsonString).not.toContain("SECRET_AUTH_TOKEN");
        expect(jsonString).not.toContain("SG.SUPER_SECRET_KEY");

        // Response contains only counts and boolean flags
        expect(responseData.email.allowlistCount).toBe(2);
        expect(responseData.whatsapp.allowlistCount).toBe(2);
      });

      test("endpoint reflects LIVE mode when allowlist is empty and dryRun is off", async () => {
        process.env.CAMPAIGN_EMAIL_DRY_RUN = "false";
        process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST = "";
        process.env.CAMPAIGN_WHATSAPP_DRY_RUN = "false";
        process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST = "";

        let responseData: any = null;
        const req = {} as any;
        const res = {
          json: (data: any) => {
            responseData = data;
          }
        } as any;

        await getCampaignSendModeHandler(req, res);

        expect(responseData.whatsapp.dryRun).toBe(false);
        expect(responseData.whatsapp.allowlistActive).toBe(false);
        expect(responseData.whatsapp.allowlistCount).toBe(0);

        expect(responseData.email.dryRun).toBe(false);
        expect(responseData.email.allowlistActive).toBe(false);
        expect(responseData.email.allowlistCount).toBe(0);
      });
    });
  });
});
