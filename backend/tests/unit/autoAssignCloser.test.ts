import { assignOpportunityCloser } from "../../src/services/assignmentEngine";
import { sequelize } from "@nexus-crm/database";

describe("Opportunity Closer Auto-Assignment Tests", () => {
  const rep1Id = "rep-1111-saleman1";
  const rep2Id = "rep-2222-salesman2";

  beforeAll(() => {
    sequelize.models.WorkspaceSetting = { findOne: jest.fn().mockResolvedValue(null) } as any;
    sequelize.models.SalesAssignmentPolicy = { findOne: jest.fn().mockResolvedValue(null) } as any;

    sequelize.models.User = {
      findAll: jest.fn().mockImplementation(async () => [
        {
          id: rep1Id,
          name: "Amelia Rodriguez (Salesman 1)",
          email: "salesperson1@nexus.com",
          role: "salesperson",
          isAvailable: true,
          status: "Active",
          onLeave: false,
          maxOpenDeals: 20,
          dealValueCutoff: 1000000
        },
        {
          id: rep2Id,
          name: "Emma Watson (Salesman 2)",
          email: "salesperson2@nexus.com",
          role: "salesperson",
          isAvailable: true,
          status: "Active",
          onLeave: false,
          maxOpenDeals: 20,
          dealValueCutoff: 1000000 // 1,000,000 max
        }
      ]),
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === rep1Id) return { id: rep1Id, name: "Amelia Rodriguez", role: "salesperson", dealValueCutoff: 1000000 };
        if (id === rep2Id) return { id: rep2Id, name: "Emma Watson", role: "salesperson", dealValueCutoff: 1000000 };
        return null;
      }),
      update: jest.fn().mockResolvedValue([1])
    } as any;

    sequelize.models.Deal = {
      count: jest.fn().mockResolvedValue(1)
    } as any;

    sequelize.models.Activity = {
      findAll: jest.fn().mockResolvedValue([])
    } as any;
  });

  test("1. When Salesman 1 converts lead, Opportunity is auto-assigned to distinct available rep (Salesman 2 with role: salesperson)", async () => {
    const context = {
      leadId: "lead-test-100",
      firstName: "Xain",
      lastName: "Ahmed",
      email: "xain@gmail.com",
      company: "Saudi Aramco Expansion",
      expectedValue: 500000
    };

    const result = await assignOpportunityCloser(context, { excludeRepId: rep1Id });

    expect(result.assigned).toBe(true);
    expect(result.closerId).toBe(rep2Id);
    expect(result.closerId).not.toBe(rep1Id);
  });

  test("2. When deal value exceeds candidate's dealValueCutoff, rep is skipped in eligibility loop", async () => {
    const context = {
      leadId: "lead-test-200",
      firstName: "HighValue",
      lastName: "Deal",
      email: "highvalue@gmail.com",
      company: "Mega Enterprise",
      expectedValue: 5000000 // 5M > 1M cutoff of rep2
    };

    const result = await assignOpportunityCloser(context, { excludeRepId: rep1Id });

    // Since rep2 has cutoff 1M and rep1 is excluded, no eligible closer remains under cutoff
    expect(result.assigned).toBe(false);
    expect(result.closerId).toBeNull();
  });
});
