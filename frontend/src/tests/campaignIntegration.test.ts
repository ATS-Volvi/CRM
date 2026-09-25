import { verifyCampaignDetailRules } from "./campaignDetail.test";
import { verifyCampaignCrudRules } from "./campaignCrud.test";
import { verifyCampaignAdCrudRules } from "./campaignAdCrud.test";

export function verifyCampaignIntegration(): { success: boolean; results: Record<string, boolean> } {
  const detailRes = verifyCampaignDetailRules();
  const crudRes = verifyCampaignCrudRules();
  const adCrudRes = verifyCampaignAdCrudRules();

  const results = {
    campaignDetailRules: detailRes.success,
    campaignCrudRules: crudRes.success,
    campaignAdCrudRules: adCrudRes.success
  };

  return {
    success: Object.values(results).every(Boolean),
    results
  };
}
