import { getLeadAccessLevel, getDealAccessLevel, checkRecordAccess } from "../../src/services/handoffAccessService";
import { sequelize } from "@nexus-crm/database";

describe("handoffAccessService Unit Tests", () => {
  const leadId = "lead-1111-2222";
  const dealId = "deal-3333-4444";
  const rep1Id = "rep-1111";
  const rep2Id = "rep-2222";
  const adminId = "admin-9999";

  const sampleLead = {
    id: leadId,
    assignedToId: rep2Id
  };

  const sampleDeal = {
    id: dealId,
    leadId: leadId,
    ownerId: rep2Id
  };

  beforeAll(() => {
    // Mock sequelize.models for unit test isolation
    sequelize.models.LeadReassignmentHistory = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.leadId === leadId && (where["Symbol(or)"] || where[Object.getOwnPropertySymbols(where)[0]] || []).some((cond: any) => cond.oldAssignedToId === rep1Id || cond.newAssignedToId === rep1Id)) {
          return { id: "history-1", leadId, oldAssignedToId: rep1Id, newAssignedToId: rep2Id };
        }
        // Fallback check for property search
        if (where.leadId === leadId) {
          return { id: "history-1", leadId, oldAssignedToId: rep1Id, newAssignedToId: rep2Id };
        }
        return null;
      })
    } as any;

    sequelize.models.LeadAssignmentAudit = {
      findOne: jest.fn().mockResolvedValue(null)
    } as any;

    sequelize.models.DealReassignmentHistory = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.dealId === dealId) {
          return { id: "deal-history-1", dealId, oldOwnerId: rep1Id, newOwnerId: rep2Id };
        }
        return null;
      })
    } as any;

    sequelize.models.DealOwner = {
      findOne: jest.fn().mockResolvedValue(null)
    } as any;

    sequelize.models.Lead = {
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === leadId) return sampleLead;
        return null;
      })
    } as any;

    sequelize.models.Deal = {
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === dealId) return sampleDeal;
        return null;
      })
    } as any;
  });

  test("Current Owner (Rep 2) gets full read/write access", async () => {
    const leadAccess = await getLeadAccessLevel(rep2Id, "sales_rep", sampleLead);
    expect(leadAccess.canRead).toBe(true);
    expect(leadAccess.canWrite).toBe(true);
    expect(leadAccess.isViewOnly).toBe(false);
    expect(leadAccess.accessLevel).toBe("full");

    const dealAccess = await getDealAccessLevel(rep2Id, "sales_rep", sampleDeal);
    expect(dealAccess.canRead).toBe(true);
    expect(dealAccess.canWrite).toBe(true);
    expect(dealAccess.isViewOnly).toBe(false);
    expect(dealAccess.accessLevel).toBe("full");
  });

  test("Admin user gets full read/write access regardless of owner", async () => {
    const leadAccess = await getLeadAccessLevel(adminId, "admin", sampleLead);
    expect(leadAccess.canRead).toBe(true);
    expect(leadAccess.canWrite).toBe(true);
    expect(leadAccess.isViewOnly).toBe(false);

    const dealAccess = await getDealAccessLevel(adminId, "admin", sampleDeal);
    expect(dealAccess.canRead).toBe(true);
    expect(dealAccess.canWrite).toBe(true);
    expect(dealAccess.isViewOnly).toBe(false);
  });

  test("Prior Owner (Rep 1) gets view-only access (canRead: true, canWrite: false)", async () => {
    const leadAccess = await getLeadAccessLevel(rep1Id, "sales_rep", sampleLead);
    expect(leadAccess.canRead).toBe(true);
    expect(leadAccess.canWrite).toBe(false);
    expect(leadAccess.isViewOnly).toBe(true);
    expect(leadAccess.accessLevel).toBe("view_only");
    expect(leadAccess.reason).toContain("Handed off — view only");

    const dealAccess = await getDealAccessLevel(rep1Id, "sales_rep", sampleDeal);
    expect(dealAccess.canRead).toBe(true);
    expect(dealAccess.canWrite).toBe(false);
    expect(dealAccess.isViewOnly).toBe(true);
    expect(dealAccess.accessLevel).toBe("view_only");
  });

  test("Unrelated rep (Rep 3) gets no access", async () => {
    // Override history mock for unknown rep
    (sequelize.models.LeadReassignmentHistory.findOne as jest.Mock).mockResolvedValueOnce(null);
    (sequelize.models.DealReassignmentHistory.findOne as jest.Mock).mockResolvedValueOnce(null);

    const leadAccess = await getLeadAccessLevel("rep-3333", "sales_rep", sampleLead);
    expect(leadAccess.canRead).toBe(false);
    expect(leadAccess.canWrite).toBe(false);
    expect(leadAccess.isViewOnly).toBe(false);
    expect(leadAccess.accessLevel).toBe("none");
  });
});
