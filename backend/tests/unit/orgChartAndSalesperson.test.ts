import { createSalesperson, getOrgChartEmployees } from "../../src/controllers/salespersonController";
import { sequelize } from "@nexus-crm/database";

describe("Org Chart & User Creation Unit Tests", () => {
  let existingManager: any;

  beforeAll(async () => {
    existingManager = await sequelize.models.User.findOne();
  });

  it("should allow manager role to create a user with hireDate, phone, and createdByUserId", async () => {
    const managerId = existingManager ? existingManager.id : null;
    const req: any = {
      user: { id: managerId, role: "manager" },
      body: {
        name: "Test New Employee",
        email: `test.employee.${Date.now()}@nexus.com`,
        password: "password123",
        role: "sales_rep",
        hireDate: "2026-01-15",
        phone: "+966501234567"
      }
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createSalesperson(req, res);

    if (res.status.mock.calls.length > 0 && res.status.mock.calls[0][0] === 500) {
      console.log("CREATE SALESPERSON ERROR:", res.json.mock.calls);
    }

    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    expect(created.hireDate).toBeDefined();
    expect(created.phone).toBe("+966501234567");
  });

  it("should block sales_rep role from creating users", async () => {
    const req: any = {
      user: { id: existingManager?.id || "rep-id", role: "sales_rep" },
      body: {
        name: "Blocked User",
        email: "blocked@nexus.com",
        password: "password123"
      }
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createSalesperson(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should fetch all employees with manager, createdByUser, and directReports for Org Chart", async () => {
    const req: any = {};
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getOrgChartEmployees(req, res);

    expect(res.json).toHaveBeenCalled();
    const employees = res.json.mock.calls[0][0];
    expect(Array.isArray(employees)).toBe(true);
  });
});
