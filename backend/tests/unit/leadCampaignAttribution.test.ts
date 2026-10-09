import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { getLeads, getLeadById, buildCampaignAttributionSummary } from "../../src/controllers/leadController";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

describe("Lead Campaign Attribution & Filter Unit Tests", () => {
  let origLeadFindAll: any;
  let origLeadFindAndCountAll: any;
  let origLeadFindByPk: any;
  let origLeadAttribFindAll: any;
  let origCampaignFindAll: any;
  let origCampaignFindByPk: any;

  beforeEach(() => {
    origLeadFindAll = sequelize.models.Lead.findAll;
    origLeadFindAndCountAll = sequelize.models.Lead.findAndCountAll;
    origLeadFindByPk = sequelize.models.Lead.findByPk;
    origLeadAttribFindAll = sequelize.models.LeadAttribution.findAll;
    origCampaignFindAll = sequelize.models.Campaign.findAll;
    origCampaignFindByPk = sequelize.models.Campaign.findByPk;
  });

  afterEach(() => {
    sequelize.models.Lead.findAll = origLeadFindAll;
    sequelize.models.Lead.findAndCountAll = origLeadFindAndCountAll;
    sequelize.models.Lead.findByPk = origLeadFindByPk;
    sequelize.models.LeadAttribution.findAll = origLeadAttribFindAll;
    sequelize.models.Campaign.findAll = origCampaignFindAll;
    sequelize.models.Campaign.findByPk = origCampaignFindByPk;
  });

  it("1. buildCampaignAttributionSummary returns correct summary for a lead with one campaign (both first and last touch)", () => {
    const attributions = [
      {
        id: "attr-1",
        leadId: "lead-1",
        channel: "WhatsApp",
        utmSource: "whatsapp",
        utmMedium: "direct",
        createdAt: new Date("2026-10-01T10:00:00Z"),
        campaign: {
          id: "camp-oct",
          name: "October Special Offer",
          code: "OCT-OFFER",
          channel: "WhatsApp",
          status: "ACTIVE",
          startDate: new Date("2026-10-01"),
          endDate: new Date("2026-10-31")
        }
      }
    ];

    const summary = buildCampaignAttributionSummary("lead-1", attributions);
    assert.ok(summary, "Attribution summary should exist");
    assert.strictEqual(summary.totalTouches, 1);
    assert.strictEqual(summary.totalCampaigns, 1);
    assert.strictEqual(summary.lastTouch.campaignCode, "OCT-OFFER");
    assert.strictEqual(summary.lastTouch.campaignId, "camp-oct");
    assert.strictEqual(summary.lastTouch.isFirstTouch, true);
    assert.strictEqual(summary.lastTouch.isLastTouch, true);
    assert.strictEqual(summary.firstTouch.campaignCode, "OCT-OFFER");
    assert.strictEqual(summary.firstTouch.isFirstTouch, true);
    assert.strictEqual(summary.firstTouch.isLastTouch, true);
  });

  it("2. buildCampaignAttributionSummary correctly distinguishes first-touch vs last-touch across multiple touches", () => {
    const attributions = [
      {
        id: "attr-touch-1",
        leadId: "lead-multi",
        channel: "Website",
        utmSource: "google",
        utmMedium: "cpc",
        createdAt: new Date("2026-08-01T10:00:00Z"),
        campaign: {
          id: "camp-summer",
          name: "Summer Kickoff",
          code: "SUMMER-26",
          channel: "Google Ads",
          status: "COMPLETED"
        }
      },
      {
        id: "attr-touch-2",
        leadId: "lead-multi",
        channel: "Email",
        utmSource: "newsletter",
        utmMedium: "email",
        createdAt: new Date("2026-09-01T10:00:00Z"),
        campaign: {
          id: "camp-fall",
          name: "Fall Nurture",
          code: "FALL-NURTURE",
          channel: "Email",
          status: "COMPLETED"
        }
      },
      {
        id: "attr-touch-3",
        leadId: "lead-multi",
        channel: "WhatsApp",
        utmSource: "whatsapp",
        utmMedium: "direct",
        createdAt: new Date("2026-10-05T12:00:00Z"),
        campaign: {
          id: "camp-oct",
          name: "October Special Offer",
          code: "OCT-OFFER",
          channel: "WhatsApp",
          status: "ACTIVE"
        }
      }
    ];

    const summary = buildCampaignAttributionSummary("lead-multi", attributions);
    assert.ok(summary);
    assert.strictEqual(summary.totalTouches, 3);
    assert.strictEqual(summary.totalCampaigns, 3);

    // First touch
    assert.strictEqual(summary.firstTouch.campaignCode, "SUMMER-26");
    assert.strictEqual(summary.firstTouch.isFirstTouch, true);
    assert.strictEqual(summary.firstTouch.isLastTouch, false);

    // Last touch
    assert.strictEqual(summary.lastTouch.campaignCode, "OCT-OFFER");
    assert.strictEqual(summary.lastTouch.isFirstTouch, false);
    assert.strictEqual(summary.lastTouch.isLastTouch, true);

    // Intermediate touch
    const midTouch = summary.touches[1];
    assert.strictEqual(midTouch.campaignCode, "FALL-NURTURE");
    assert.strictEqual(midTouch.isFirstTouch, false);
    assert.strictEqual(midTouch.isLastTouch, false);
  });

  it("3. Returns null for leads with no campaign attribution or attribution to deleted campaign", () => {
    // Zero attribution
    const summaryEmpty = buildCampaignAttributionSummary("lead-none", []);
    assert.strictEqual(summaryEmpty, null, "Should return null when there are no attributions");

    // Attribution pointing to a deleted campaign (campaign is null)
    const attributionsDeleted = [
      {
        id: "attr-orphaned",
        leadId: "lead-orphaned",
        campaignId: "deleted-camp",
        campaign: null,
        createdAt: new Date()
      }
    ];
    const summaryDeleted = buildCampaignAttributionSummary("lead-orphaned", attributionsDeleted);
    assert.strictEqual(summaryDeleted, null, "Should return null when attributed campaign was deleted");
  });

  it("4. Handles missing campaign code gracefully by falling back to campaign name or NO-CODE", () => {
    const attributionsNoCode = [
      {
        id: "attr-nocode",
        leadId: "lead-nocode",
        channel: "Direct",
        createdAt: new Date(),
        campaign: {
          id: "camp-nocode",
          name: "Brand Awareness Blitz",
          code: "",
          channel: "Social",
          status: "ACTIVE"
        }
      }
    ];
    const summary = buildCampaignAttributionSummary("lead-nocode", attributionsNoCode);
    assert.ok(summary);
    assert.strictEqual(summary.lastTouch.campaignCode, "Brand Awareness Blitz");
  });

  it("5. API getLeads returns campaignAttribution for leads, preserves backward compatibility of response envelope and existing fields", async () => {
    const mockLead = {
      id: "lead-e2e-1",
      leadNumber: "LEAD-101",
      firstName: "Bruce",
      lastName: "Wayne",
      company: "Wayne Enterprises",
      email: "bruce@waynecorp.com",
      phone: "+971501234567",
      source: "WhatsApp",
      status: "NEW",
      budgetRange: "500k+",
      assignedTo: { id: "user-1", name: "Alfred Pennyworth", email: "alfred@wayne.com" },
      contacts: [{ id: "c-1", firstName: "Bruce", lastName: "Wayne" }],
      createdAt: new Date("2026-10-01"),
      toJSON() {
        return {
          id: this.id,
          leadNumber: this.leadNumber,
          firstName: this.firstName,
          lastName: this.lastName,
          company: this.company,
          email: this.email,
          phone: this.phone,
          source: this.source,
          status: this.status,
          budgetRange: this.budgetRange,
          assignedTo: this.assignedTo,
          contacts: this.contacts,
          createdAt: this.createdAt
        };
      }
    };

    (sequelize.models.Lead as any).findAll = async () => [];
    (sequelize.models.Lead as any).findAndCountAll = async () => ({
      count: 1,
      rows: [mockLead]
    });
    (sequelize.models.LeadAttribution as any).findAll = async () => [
      {
        id: "attr-101",
        leadId: "lead-e2e-1",
        channel: "WhatsApp",
        createdAt: new Date("2026-10-02"),
        campaign: {
          id: "camp-gotham",
          name: "Gotham Security",
          code: "GOTHAM-SEC",
          channel: "WhatsApp",
          status: "ACTIVE"
        }
      }
    ];

    const req: any = {
      query: { page: "1", limit: "25" }
    };
    let responseData: any = null;
    const res: any = {
      json(d: any) {
        responseData = d;
        return this;
      },
      status() {
        return this;
      }
    };

    await getLeads(req, res);

    // Verify envelope backward compatibility
    assert.ok(responseData, "Response should exist");
    assert.strictEqual(responseData.total, 1);
    assert.strictEqual(responseData.page, 1);
    assert.strictEqual(responseData.limit, 25);
    assert.ok(responseData.channelCounts);
    assert.ok(Array.isArray(responseData.data));

    // Verify existing fields unchanged
    const lead = responseData.data[0];
    assert.strictEqual(lead.id, "lead-e2e-1");
    assert.strictEqual(lead.company, "Wayne Enterprises");
    assert.strictEqual(lead.firstName, "Bruce");
    assert.strictEqual(lead.assignedTo.name, "Alfred Pennyworth");
    assert.strictEqual(lead.contacts[0].firstName, "Bruce");

    // Verify additive campaignAttribution
    assert.ok(lead.campaignAttribution, "campaignAttribution must be present");
    assert.strictEqual(lead.campaignAttribution.lastTouch.campaignCode, "GOTHAM-SEC");
    assert.strictEqual(lead.campaignAttribution.lastTouch.isLastTouch, true);
  });

  it("6. API getLeads campaign filter filters by campaignId / campaignIds and combines with channel and search", async () => {
    let capturedWhere: any = null;
    let capturedCountsWhere: any = null;

    (sequelize.models.LeadAttribution as any).findAll = async (opts: any) => {
      // Mock attribution matching
      if (opts?.attributes?.[0] === "leadId") {
        return [{ leadId: "lead-matched-attr" }];
      }
      return [];
    };

    (sequelize.models.Lead as any).findAll = async (opts: any) => {
      capturedCountsWhere = opts?.where;
      return [];
    };

    (sequelize.models.Lead as any).findAndCountAll = async (opts: any) => {
      capturedWhere = opts?.where;
      return { count: 0, rows: [] };
    };

    const req: any = {
      query: {
        page: "1",
        limit: "25",
        channel: "WhatsApp",
        search: "Acme",
        campaignIds: "camp-target-1,camp-target-2"
      }
    };

    const res: any = {
      json() { return this; },
      status() { return this; }
    };

    await getLeads(req, res);

    assert.ok(capturedWhere, "capturedWhere must be populated");
    assert.ok(capturedWhere.source, "channel filter must be in where clause");
    assert.ok(capturedWhere[Op.or], "search filter must be in where clause");

    // Confirm campaign filter conditions exist in where[Op.and]
    assert.ok(capturedWhere[Op.and], "where[Op.and] should contain campaign condition");
    const campaignCondition = capturedWhere[Op.and].find((cond: any) => cond[Op.or]);
    assert.ok(campaignCondition, "Campaign OR condition must be present in where clause");
    const orClauses = campaignCondition[Op.or];
    assert.ok(
      orClauses.some((c: any) => c.campaignId && c.campaignId[Op.in]),
      "Direct campaignId filter must be present"
    );
    assert.ok(
      orClauses.some((c: any) => c.id && c.id[Op.in]),
      "Attributed leadIds filter must be present"
    );
  });

  it("7. Performance check: leads list makes a constant number of queries regardless of lead count (25 leads test)", async () => {
    let queryCount = 0;

    // Track every query made to sequelize models
    (sequelize.models.Lead as any).findAll = async () => {
      queryCount++;
      return [];
    };

    const mock25Leads = Array.from({ length: 25 }, (_, i) => ({
      id: `lead-perf-${i + 1}`,
      company: `Corp ${i + 1}`,
      campaignId: i % 2 === 0 ? "camp-1" : null,
      toJSON() {
        return { id: this.id, company: this.company, campaignId: this.campaignId };
      }
    }));

    (sequelize.models.Lead as any).findAndCountAll = async () => {
      queryCount++;
      return { count: 25, rows: mock25Leads };
    };

    (sequelize.models.LeadAttribution as any).findAll = async () => {
      queryCount++;
      return [
        {
          id: "attr-p-1",
          leadId: "lead-perf-1",
          channel: "Email",
          createdAt: new Date(),
          campaign: { id: "camp-1", name: "Promo", code: "PROMO-1" }
        }
      ];
    };

    (sequelize.models.Campaign as any).findAll = async () => {
      queryCount++;
      return [{ id: "camp-1", name: "Promo", code: "PROMO-1" }];
    };

    const req: any = {
      query: { page: "1", limit: "25" }
    };
    const res: any = {
      json() { return this; },
      status() { return this; }
    };

    queryCount = 0;
    await getLeads(req, res);

    // Queries executed for 25 leads:
    // 1. source counts findAll
    // 2. leads findAndCountAll
    // 3. attributions batched findAll (Op.in 25 ids)
    // 4. optional direct campaign batched findAll (Op.in directCampIds)
    assert.strictEqual(
      queryCount,
      4,
      `Expected exactly 4 batched queries for 25 leads (no N+1 per-row queries), got ${queryCount}`
    );

    // Re-run with 50 leads to prove query count is strictly constant O(1)
    queryCount = 0;
    const mock50Leads = Array.from({ length: 50 }, (_, i) => ({
      id: `lead-perf-${i + 1}`,
      company: `Corp ${i + 1}`,
      campaignId: "camp-1",
      toJSON() { return { id: this.id }; }
    }));
    (sequelize.models.Lead as any).findAndCountAll = async () => {
      queryCount++;
      return { count: 50, rows: mock50Leads };
    };

    await getLeads(req, res);
    assert.strictEqual(
      queryCount,
      4,
      `Expected strictly constant 4 queries even with 50 leads, got ${queryCount}`
    );
  });
});
