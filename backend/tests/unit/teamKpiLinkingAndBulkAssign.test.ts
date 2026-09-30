import { bulkAssignTargets, editKpiTarget } from "../../src/controllers/salespersonController";
import { deleteKpiMaster } from "../../src/controllers/kpiMasterController";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

describe("Team KPI Linking and Safe Bulk Assignment Tests", () => {
  let adminUser: any;
  let managerUser: any;
  let repA: any; // manager's report, team "Enterprise", dept "Sales"
  let repB: any; // other manager's report, team "SMB", dept "Sales"
  let repC: any; // team "Enterprise", dept "Support"
  let sampleMaster: any;

  beforeAll(async () => {
    // Create test users
    adminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "KPI Admin",
      email: `kpi.admin.${Date.now()}@test.com`,
      password: "hash",
      role: "admin",
      isAvailable: true,
      maxOpenLeads: 50,
    });

    managerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "KPI Manager",
      email: `kpi.mgr.${Date.now()}@test.com`,
      password: "hash",
      role: "manager",
      isAvailable: true,
      maxOpenLeads: 50,
    });

    repA = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rep A",
      email: `repa.${Date.now()}@test.com`,
      password: "hash",
      role: "sales_rep",
      managerId: managerUser.id,
      team: "Enterprise",
      department: "Sales",
      isAvailable: true,
      maxOpenLeads: 50,
    });

    repB = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rep B",
      email: `repb.${Date.now()}@test.com`,
      password: "hash",
      role: "sales_rep",
      managerId: null,
      team: "SMB",
      department: "Sales",
      isAvailable: true,
      maxOpenLeads: 50,
    });

    repC = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rep C",
      email: `repc.${Date.now()}@test.com`,
      password: "hash",
      role: "sales_rep",
      managerId: null,
      team: "Enterprise",
      department: "Support",
      isAvailable: true,
      maxOpenLeads: 50,
    });

    // Create a KPI Master definition
    sampleMaster = await sequelize.models.KpiMaster.create({
      id: crypto.randomUUID(),
      name: `Deals Closed ${Date.now()}`,
      category: "Sales",
      targetValue: 15,
      frequency: "monthly",
      weightage: 20,
      isActive: true,
      teamLeadId: null,
    });
  });

  afterAll(async () => {
    // Cleanup created users & KPI masters
    if (sampleMaster) await sequelize.models.KpiMaster.destroy({ where: { id: sampleMaster.id } });
    await sequelize.models.User.destroy({
      where: {
        id: [adminUser.id, managerUser.id, repA.id, repB.id, repC.id],
      },
    });
  });

  describe("bulkAssignTargets - Scope Safety Enforcement", () => {
    it("should return 400 Bad Request when an admin attempts bulk assign without any scope", async () => {
      const req: any = {
        user: { id: adminUser.id, role: "admin" },
        body: {
          kpiName: sampleMaster.name,
          kpiMasterId: sampleMaster.id,
          targetValue: 20,
          frequency: "monthly",
          weightage: 25,
          // salespersonIds, team, department all omitted
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await bulkAssignTargets(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Scope is required/i),
        })
      );
    });

    it("should return 403 Forbidden when a sales_rep attempts bulk assign", async () => {
      const req: any = {
        user: { id: repA.id, role: "sales_rep" },
        body: {
          kpiName: sampleMaster.name,
          targetValue: 20,
          team: "Enterprise",
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await bulkAssignTargets(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow admin to bulk assign scoped strictly by team and persist kpiMasterId", async () => {
      const req: any = {
        user: { id: adminUser.id, role: "admin" },
        body: {
          kpiName: sampleMaster.name,
          kpiMasterId: sampleMaster.id,
          targetValue: 25,
          frequency: "monthly",
          weightage: 30,
          team: "Enterprise",
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await bulkAssignTargets(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Successfully assigned targets"),
        })
      );

      // Rep A and Rep C are team "Enterprise" -> should have targets with kpiMasterId
      const targetA: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repA.id, kpiName: sampleMaster.name },
      });
      const targetC: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repC.id, kpiName: sampleMaster.name },
      });
      const targetB: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repB.id, kpiName: sampleMaster.name },
      });

      expect(targetA).not.toBeNull();
      expect(targetA?.targetValue).toBe(25);
      expect(targetA?.kpiMasterId).toBe(sampleMaster.id);

      expect(targetC).not.toBeNull();
      expect(targetC?.targetValue).toBe(25);
      expect(targetC?.kpiMasterId).toBe(sampleMaster.id);

      // Rep B was NOT on Enterprise team
      expect(targetB).toBeNull();
    });

    it("should allow admin to bulk assign scoped strictly by department", async () => {
      const deptKpi = `Support SLA ${Date.now()}`;
      const req: any = {
        user: { id: adminUser.id, role: "admin" },
        body: {
          kpiName: deptKpi,
          targetValue: 95,
          department: "Support",
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await bulkAssignTargets(req, res);

      const targetC: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repC.id, kpiName: deptKpi },
      });
      const targetA: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repA.id, kpiName: deptKpi },
      });

      expect(targetC).not.toBeNull();
      expect(targetC?.targetValue).toBe(95);
      expect(targetA).toBeNull(); // Rep A is department "Sales"
    });

    it("should allow manager to bulk assign targets scoped only to their own direct reports", async () => {
      const managerKpi = `Manager Team KPI ${Date.now()}`;
      const req: any = {
        user: { id: managerUser.id, role: "manager" },
        body: {
          kpiName: managerKpi,
          targetValue: 50,
          frequency: "monthly",
          weightage: 15,
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await bulkAssignTargets(req, res);

      // Rep A is direct report of managerUser -> should receive target
      const targetA: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repA.id, kpiName: managerKpi },
      });
      // Rep B and C are NOT reports of managerUser -> should NOT receive target
      const targetB: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repB.id, kpiName: managerKpi },
      });
      const targetC: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repC.id, kpiName: managerKpi },
      });

      expect(targetA).not.toBeNull();
      expect(targetA?.targetValue).toBe(50);
      expect(targetB).toBeNull();
      expect(targetC).toBeNull();
    });
  });

  describe("editKpiTarget and Model Associations", () => {
    it("should allow editing a KPI target including kpiMasterId", async () => {
      const existing: any = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: repA.id },
      });
      expect(existing).not.toBeNull();

      const newMaster: any = await sequelize.models.KpiMaster.create({
        id: crypto.randomUUID(),
        name: `New Master ${Date.now()}`,
        category: "General",
        targetValue: 40,
        frequency: "quarterly",
        weightage: 20,
        isActive: true,
      });

      const req: any = {
        user: { id: adminUser.id, role: "admin" },
        params: { kpiId: existing?.id },
        body: {
          targetValue: 45,
          kpiMasterId: newMaster.id,
          reason: "Upgraded target",
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await editKpiTarget(req, res);

      expect(res.json).toHaveBeenCalled();
      const updated: any = await sequelize.models.KpiTarget.findByPk(existing?.id, {
        include: [{ model: sequelize.models.KpiMaster, as: "master" }],
      });

      expect(updated?.targetValue).toBe(45);
      expect(updated?.kpiMasterId).toBe(newMaster.id);
      expect(updated?.master).toBeDefined();
      expect(updated?.master?.id).toBe(newMaster.id);
    });
  });

  describe("deleteKpiMaster - Cascade/Target Cleanup", () => {
    it("should clean up targets linked by kpiMasterId when KPI Master is deleted", async () => {
      const deleteMaster: any = await sequelize.models.KpiMaster.create({
        id: crypto.randomUUID(),
        name: `To Delete Master ${Date.now()}`,
        category: "Test",
        targetValue: 10,
        frequency: "monthly",
        weightage: 10,
        isActive: true,
      });

      const linkedTarget: any = await sequelize.models.KpiTarget.create({
        id: crypto.randomUUID(),
        salespersonId: repB.id,
        kpiMasterId: deleteMaster.id,
        kpiName: deleteMaster.name,
        targetValue: 10,
        currentValue: 0,
        frequency: "monthly",
        weightage: 10,
        status: "Active",
      });

      const req: any = {
        user: { id: adminUser.id, role: "admin" },
        params: { id: deleteMaster.id },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteKpiMaster(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("deleted successfully"),
        })
      );

      const targetAfter = await sequelize.models.KpiTarget.findByPk(linkedTarget.id);
      expect(targetAfter).toBeNull();
    });
  });
});
