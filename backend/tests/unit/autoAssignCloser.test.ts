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
          role: "sales_rep",
          isAvailable: true,
          status: "Active",
          onLeave: false,
          maxOpenDeals: 20
        },
        {
          id: rep2Id,
          name: "Emma Watson (Salesman 2)",
          email: "salesperson2@nexus.com",
          role: "senior_ae",
          isAvailable: true,
          status: "Active",
          onLeave: false,
          maxOpenDeals: 20
        }
      ]),
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === rep1Id) return { id: rep1Id, name: "Amelia Rodriguez", role: "sales_rep" };
        if (id === rep2Id) return { id: rep2Id, name: "Emma Watson", role: "senior_ae" };
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

  test("1. When Salesman 1 converts lead, Opportunity is auto-assigned to distinct available rep (Salesman 2)", async () => {
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
});
