import { Database, sequelize } from "@nexus-crm/database";
import {
  computeAudience,
  computeWhatsAppAudience,
  filterLeadsForWhatsAppAudience
} from "../services/campaignMessageService";

async function runTest() {
  console.log("=================================================");
  console.log("TEST: AUDIENCE CAMPAIGN UNION & EXCLUSIONS");
  console.log("=================================================\n");

  try {
    await Database.createConnection();
  } catch (err: any) {
    console.log("Database connection note:", err.message);
  }

  // 1. Test in-memory audience filter with includeFromCampaignIds logic
  console.log("[Step 1] Testing audience filter with multi-campaign union & mandatory exclusions...");

  const leads = [
    {
      id: "lead-camp-1-opted-in",
      campaignId: "CAMP-A",
      phone: "+971501112233",
      whatsappConsentStatus: "OPTED_IN",
      optedOutWhatsapp: false,
      status: "NEW"
    },
    {
      id: "lead-camp-2-opted-in",
      campaignId: "CAMP-B",
      phone: "+971502223344",
      whatsappConsentStatus: "OPTED_IN",
      optedOutWhatsapp: false,
      status: "NEW"
    },
    {
      id: "lead-camp-2-unspecified-consent",
      campaignId: "CAMP-B",
      phone: "+971503334455",
      whatsappConsentStatus: "UNSPECIFIED",
      optedOutWhatsapp: false,
      status: "NEW"
    },
    {
      id: "lead-camp-2-opted-out",
      campaignId: "CAMP-B",
      phone: "+971504445566",
      whatsappConsentStatus: "OPTED_IN",
      optedOutWhatsapp: true,
      status: "NEW"
    },
    {
      id: "lead-camp-2-duplicate-phone",
      campaignId: "CAMP-B",
      phone: "+971501112233", // duplicate of lead 1
      whatsappConsentStatus: "OPTED_IN",
      optedOutWhatsapp: false,
      status: "NEW"
    }
  ];

  const filtered = filterLeadsForWhatsAppAudience(leads, {
    includeFromCampaignIds: ["CAMP-B"]
  });

  console.log(`Eligible leads count: ${filtered.eligibleLeads.length}`);
  console.log(`Excluded leads count: ${filtered.excludedCount}`);
  console.log("Excluded breakdown:", JSON.stringify(filtered.excludedByReason));

  if (filtered.eligibleLeads.length !== 2) {
    throw new Error(`Expected 2 eligible leads, got ${filtered.eligibleLeads.length}`);
  }

  if (filtered.excludedByReason.noConsent !== 1) {
    throw new Error(`Expected 1 excluded by noConsent, got ${filtered.excludedByReason.noConsent}`);
  }

  if (filtered.excludedByReason.optedOut !== 1) {
    throw new Error(`Expected 1 excluded by optedOut, got ${filtered.excludedByReason.optedOut}`);
  }

  if (filtered.excludedByReason.duplicate !== 1) {
    throw new Error(`Expected 1 excluded by duplicate, got ${filtered.excludedByReason.duplicate}`);
  }

  console.log("✅ Step 1 Passed: Audience filter accurately includes consented widened leads and strictly excludes unconsented/opted-out/duplicate leads.\n");

  console.log("All audience union script checks passed successfully!");
}

if (require.main === module) {
  runTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
