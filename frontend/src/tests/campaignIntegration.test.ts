import { verifyCampaignDetailRules } from "./campaignDetail.test";
import { verifyCampaignCrudRules } from "./campaignCrud.test";

export function verifyCampaignIntegration(): { success: boolean; results: Record<string, boolean> } {
  const detailRes = verifyCampaignDetailRules();
  const crudRes = verifyCampaignCrudRules();

  const results = {
    campaignDetailRules: detailRes.success,
    campaignCrudRules: crudRes.success
  };

  return {
    success: Object.values(results).every(Boolean),
    results
  };
}
