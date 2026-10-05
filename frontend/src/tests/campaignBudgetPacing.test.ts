const mockUserFindAll = jest.fn();
const mockUserFindOne = jest.fn();
const mockCampaignFindAll = jest.fn();
const mockNotificationFindOne = jest.fn();
const mockNotificationUpdate = jest.fn();
const mockCreateNotification = jest.fn();
const mockGetCampaignPerformance = jest.fn();

jest.mock("../../../backend/src/services/notificationService", () => ({
  createNotification: (...args: any[]) => mockCreateNotification(...args)
}));

jest.mock("../../../backend/src/services/attributionService", () => ({
  getCampaignPerformance: (...args: any[]) => mockGetCampaignPerformance(...args)
}));

jest.mock("@nexus-crm/database", () => ({
  sequelize: {
    models: {
      Campaign: {
        findAll: (...args: any[]) => mockCampaignFindAll(...args)
      },
      User: {
        findAll: (...args: any[]) => mockUserFindAll(...args),
        findOne: (...args: any[]) => mockUserFindOne(...args)
      },
      Notification: {
        findOne: (...args: any[]) => mockNotificationFindOne(...args),
        update: (...args: any[]) => mockNotificationUpdate(...args)
      }
    }
  }
}));

import { checkCampaignBudgetPacingAndAlerts } from "../../../backend/src/services/campaignBudgetPacingService";

describe("Campaign Budget Pacing & Admin Role Fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCampaignPerformance.mockResolvedValue({ metrics: { totalLeads: 0 } });
    mockNotificationFindOne.mockResolvedValue(null);
    mockNotificationUpdate.mockResolvedValue([1]);
    mockCreateNotification.mockResolvedValue({ id: "notif-1" });
  });

  test("campaign with ownerId: null executes admin-fallback query using lowercase 'admin' and does not throw", async () => {
    mockCampaignFindAll.mockResolvedValue([
      {
        id: "camp-null-owner-1",
        name: "Unassigned Marketing Blitz",
        code: "UNASSIGNED-BLITZ",
        budget: 1000,
        actualSpend: 900,
        status: "ACTIVE",
        ownerId: null,
        owner: null,
        currency: "SAR"
      }
    ]);

    mockUserFindAll.mockResolvedValue([
      { id: "admin-uuid-1", name: "Admin One", email: "admin1@nexus.com", role: "admin" }
    ]);

    const result = await checkCampaignBudgetPacingAndAlerts();

    expect(result).toEqual({ alertsGenerated: 1, campaignsChecked: 1 });
    // Assert query strictly checks lowercase "admin" (Postgres enum compliance)
    expect(mockUserFindAll).toHaveBeenCalledTimes(1);
    expect(mockUserFindAll).toHaveBeenCalledWith({
      where: {
        role: "admin"
      }
    });

    // Verify notification was sent to the admin fallback user
    expect(mockCreateNotification).toHaveBeenCalledWith(
      "admin-uuid-1",
      "warning",
      "Campaign Budget Alert (80% Reached)",
      expect.stringContaining("has spent 90% of its allocated budget"),
      "/campaigns/camp-null-owner-1"
    );
  });

  test("campaign with ownerId bypasses admin-fallback query and notifies owner directly", async () => {
    mockCampaignFindAll.mockResolvedValue([
      {
        id: "camp-owned-1",
        name: "Owned Campaign",
        code: "OWNED-01",
        budget: 5000,
        actualSpend: 4500,
        status: "ACTIVE",
        ownerId: "rep-user-456",
        currency: "SAR"
      }
    ]);

    const result = await checkCampaignBudgetPacingAndAlerts();

    expect(result).toEqual({ alertsGenerated: 1, campaignsChecked: 1 });
    expect(mockUserFindAll).not.toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      "rep-user-456",
      "warning",
      "Campaign Budget Alert (80% Reached)",
      expect.stringContaining("has spent 90% of its allocated budget"),
      "/campaigns/camp-owned-1"
    );
  });
});
