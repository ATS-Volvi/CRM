import request from "supertest";
import { createServer } from "../../server";
import {
  sequelize,
  User,
  Lead,
  SiteInspection,
  SiteBase,
  SiteInspectorProfile,
  SiteInspectionAuditLog,
} from "@nexus-crm/database";
import { requestSiteInspection } from "../../src/services/siteInspectionService";
import { updateSettings } from "../../src/services/siteInspectionSettingsService";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const app = createServer();

describe("Site Inspection Phase 2 — Stage A Concurrency & API Test Suite", () => {
  const jwtSecret = process.env.JWT_SECRET || "default_secret";

  let adminUser: any;
  let opsManagerUser: any;
  let salesRepUser: any;
  let inspectorAlpha: any;
  let inspectorBeta: any;

  let adminToken: string;
  let opsManagerToken: string;
  let salesRepToken: string;

  beforeAll(async () => {
    const ts = Date.now();

    adminUser = await User.create({
      id: crypto.randomUUID(),
      name: "Admin Tester",
      email: `admin-p2-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "admin",
      isAvailable: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: "1h" });

    opsManagerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Ops Manager Tester",
      email: `ops-p2-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "ops_manager",
      isAvailable: true,
    });
    opsManagerToken = jwt.sign({ id: opsManagerUser.id, role: opsManagerUser.role }, jwtSecret, { expiresIn: "1h" });

    salesRepUser = await User.create({
      id: crypto.randomUUID(),
      name: "Sales Rep Tester",
      email: `rep-p2-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "sales_rep",
      isAvailable: true,
    });
    salesRepToken = jwt.sign({ id: salesRepUser.id, role: salesRepUser.role }, jwtSecret, { expiresIn: "1h" });

    // Ensure Jubail base exists
    await SiteBase.findOrCreate({
      where: { code: "JUBAIL" },
      defaults: {
        id: crypto.randomUUID(),
        code: "JUBAIL",
        name: "Jubail Operations Base",
        region: "Eastern Province",
        latitude: 27.0,
        longitude: 49.65,
        isActive: true,
      },
    });
  });

  describe("1. Concurrency: 20 Parallel Requests Strictly Respect Capacity Limits", () => {
    test("20 simultaneous requests cannot push any inspector over their individual capacity", async () => {
      const ts = Date.now();

      // Configure assignment mode to nearest and max capacity
      await updateSettings({
        assignmentMode: "nearest",
        maxOpenInspections: 5,
        maxDistanceKm: 500,
      });

      // Clear any prior open inspections for this test
      inspectorAlpha = await User.create({
        id: crypto.randomUUID(),
        name: `Inspector Alpha ${ts}`,
        email: `alpha-${ts}@nexus.com`,
        password: "hashedpassword123",
        role: "site_manager",
        isAvailable: true,
      });
      // Alpha capacity = 3
      await SiteInspectorProfile.create({
        id: crypto.randomUUID(),
        userId: inspectorAlpha.id,
        isAvailable: true,
        maxOpenInspections: 3,
        maxVisitsPerDay: 5,
        maxDistanceKm: 500,
        certifications: JSON.stringify(["GENERAL", "SEWAGE", "HAZARDOUS"]),
      });

      inspectorBeta = await User.create({
        id: crypto.randomUUID(),
        name: `Inspector Beta ${ts}`,
        email: `beta-${ts}@nexus.com`,
        password: "hashedpassword123",
        role: "site_manager",
        isAvailable: true,
      });
      // Beta capacity = 2
      await SiteInspectorProfile.create({
        id: crypto.randomUUID(),
        userId: inspectorBeta.id,
        isAvailable: true,
        maxOpenInspections: 2,
        maxVisitsPerDay: 5,
        maxDistanceKm: 500,
        certifications: JSON.stringify(["GENERAL", "SEWAGE", "HAZARDOUS"]),
      });

      // Total available capacity between Alpha (3) and Beta (2) = 5
      // Create 20 unique leads
      const leads: any[] = [];
      for (let i = 0; i < 20; i++) {
        const lead = await Lead.create({
          id: crypto.randomUUID(),
          firstName: `LeadParallel`,
          lastName: `${i}`,
          company: `PetroChem Corp ${i}`,
          email: `concurrent-lead-${ts}-${i}@client.com`,
          phone: `+96650000${String(i).padStart(4, "0")}`,
          status: "CONTACTED",
          city: "Jubail",
          territory: "Eastern Province",
        });
        leads.push(lead);
      }

      // Launch 20 concurrent requestSiteInspection calls simultaneously
      const results = await Promise.all(
        leads.map((lead) =>
          requestSiteInspection(
            lead.id,
            salesRepUser.id,
            "Parallel concurrency load test request",
            {
              siteAreaName: "Jubail Industrial City",
              siteLatitudeHint: 27.02,
              siteLongitudeHint: 49.61,
              priority: "NORMAL",
            },
            "sales_rep"
          )
        )
      );

      expect(results).toHaveLength(20);

      // Verify DB counts directly
      const alphaAssignedCount = await SiteInspection.count({
        where: {
          assignedToId: inspectorAlpha.id,
          status: "REQUESTED",
        },
      });
      const betaAssignedCount = await SiteInspection.count({
        where: {
          assignedToId: inspectorBeta.id,
          status: "REQUESTED",
        },
      });
      const unassignedCount = await SiteInspection.count({
        where: {
          assignedToId: null,
          status: "REQUESTED",
        },
      });

      // STRICT CAPACITY ASSERTIONS:
      // Alpha must NEVER exceed 3
      expect(alphaAssignedCount).toBeLessThanOrEqual(3);
      // Beta must NEVER exceed 2
      expect(betaAssignedCount).toBeLessThanOrEqual(2);
      // Total assigned must be at most 5
      expect(alphaAssignedCount + betaAssignedCount).toBeLessThanOrEqual(5);
      // Excess inspections must enter UNASSIGNED queue cleanly
      expect(unassignedCount).toBeGreaterThanOrEqual(15);
    }, 45000);
  });

  describe("2. Admin Settings & Inspector Profile API Endpoints", () => {
    test("GET /api/v1/site-inspections/settings: Ops Manager and Admin can fetch settings", async () => {
      const res = await request(app)
        .get("/api/v1/site-inspections/settings")
        .set("Authorization", `Bearer ${opsManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("assignmentMode");
      expect(res.body).toHaveProperty("maxOpenInspections");
      expect(res.body).toHaveProperty("workingWeek");
    });

    test("GET /api/v1/site-inspections/settings: Sales Rep is blocked with 403", async () => {
      const res = await request(app)
        .get("/api/v1/site-inspections/settings")
        .set("Authorization", `Bearer ${salesRepToken}`);

      expect(res.status).toBe(403);
    });

    test("PUT /api/v1/site-inspections/settings: Updates settings, validates, and explains effects", async () => {
      const res = await request(app)
        .put("/api/v1/site-inspections/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          maxOpenInspections: 7,
          maxDistanceKm: 350,
          balancedWeights: { distance: 0.6, load: 0.4 },
        });

      expect(res.status).toBe(200);
      expect(res.body.settings.maxOpenInspections).toBe(7);
      expect(res.body.settings.maxDistanceKm).toBe(350);
      expect(res.body.explanations.maxOpenInspections).toContain("from 5 to 7 open inspections");
    });

    test("PUT /api/v1/site-inspections/settings: Rejects invalid range with 400", async () => {
      const res = await request(app)
        .put("/api/v1/site-inspections/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          maxOpenInspections: 999, // exceeds max limit of 50
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("maxOpenInspections must be an integer between 1 and 50");
    });

    test("Site Holidays CRUD: Ops Manager can add, list, update, and delete holidays", async () => {
      // 1. Add
      const addRes = await request(app)
        .post("/api/v1/site-inspections/holidays")
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ date: "2026-09-23", name: "Saudi National Day" });

      expect(addRes.status).toBe(201);
      const holidayId = addRes.body.id;

      // 2. List
      const listRes = await request(app)
        .get("/api/v1/site-inspections/holidays")
        .set("Authorization", `Bearer ${opsManagerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((h: any) => h.id === holidayId)).toBe(true);

      // 3. Update
      const updateRes = await request(app)
        .put(`/api/v1/site-inspections/holidays/${holidayId}`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ name: "Saudi National Day (Observed)" });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe("Saudi National Day (Observed)");

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/site-inspections/holidays/${holidayId}`)
        .set("Authorization", `Bearer ${opsManagerToken}`);
      expect(deleteRes.status).toBe(200);
    });

    test("Inspector Profiles: Ops Manager can list and edit inspector profile", async () => {
      const getRes = await request(app)
        .get("/api/v1/site-inspections/inspectors")
        .set("Authorization", `Bearer ${opsManagerToken}`);

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);

      // Edit Alpha profile
      const putRes = await request(app)
        .put(`/api/v1/site-inspections/inspectors/${inspectorAlpha.id}/profile`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({
          maxOpenInspections: 4,
          certifications: ["GENERAL", "HAZARDOUS"],
          isAvailable: true,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.maxOpenInspections).toBe(4);
    });

    test("Audit Logs: Immutable append-only audit trail records changes and blocks modifications", async () => {
      const res = await request(app)
        .get("/api/v1/site-inspections/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.logs)).toBe(true);

      // Verify hook prevents update on audit logs
      const firstLog = await SiteInspectionAuditLog.findOne();
      if (firstLog) {
        await expect(firstLog.update({ action: "ALTERED" })).rejects.toThrow(/append-only/);
      }
    });

    test("Manual Reassignment & Bulk Assignment: Ops Manager can reassign with mandatory reason", async () => {
      const lead = await Lead.create({
        id: crypto.randomUUID(),
        firstName: "Test",
        lastName: "Reassign",
        company: "Reassign Corp",
        email: `reassign-${Date.now()}@test.com`,
        status: "CONTACTED",
      });

      const inspection = await requestSiteInspection(lead.id, salesRepUser.id, "Note");

      // 1. Reassign without reason is rejected with 400
      const failRes = await request(app)
        .post(`/api/v1/site-inspections/${inspection.id}/reassign`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ assignedToId: inspectorBeta.id, reason: "" });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error).toContain("reason is required");

      // 2. Reassign with reason succeeds
      const successRes = await request(app)
        .post(`/api/v1/site-inspections/${inspection.id}/reassign`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ assignedToId: inspectorBeta.id, reason: "Specialized project requirements" });

      expect(successRes.status).toBe(200);
      expect(successRes.body.assignedToId).toBe(inspectorBeta.id);
      expect(successRes.body.assignmentMode).toBe("manual");

      // 3. Bulk assignment
      const bulkRes = await request(app)
        .post("/api/v1/site-inspections/bulk-assign")
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({
          inspectionIds: [inspection.id],
          targetAssigneeId: inspectorAlpha.id,
          reason: "Bulk balancing by Ops Manager",
        });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.assignedCount).toBe(1);
    });
  });
});
