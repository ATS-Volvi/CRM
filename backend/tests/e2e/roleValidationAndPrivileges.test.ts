import request from "supertest";
import { createServer } from "../../server";
import { sequelize, User, Lead, SiteInspection, SiteBase } from "@nexus-crm/database";
import { ALLOWED_USER_ROLES, ROLE_HIERARCHY, validateRoleAssignment } from "../../src/constants/roles";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const app = createServer();

describe("User Role Validation, Privilege Boundaries & Site/Ops Manager Workflow", () => {
  const jwtSecret = process.env.JWT_SECRET || "default_secret";

  let adminUser: any;
  let directorUser: any;
  let managerUser: any;
  let salesRepUser: any;
  let siteManagerUser: any;
  let siteManager2User: any;
  let opsManagerUser: any;

  let adminToken: string;
  let directorToken: string;
  let managerToken: string;
  let salesRepToken: string;
  let siteManagerToken: string;
  let siteManager2Token: string;
  let opsManagerToken: string;

  beforeAll(async () => {
    if (!sequelize.models.User) {
      await sequelize.sync();
    }

    const ts = Date.now();

    // Seed test users for each caller role
    adminUser = await User.create({
      id: crypto.randomUUID(),
      name: "Admin Tester",
      email: `admin-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "admin",
      isAvailable: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: "1h" });

    directorUser = await User.create({
      id: crypto.randomUUID(),
      name: "Director Tester",
      email: `director-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "director",
      isAvailable: true,
    });
    directorToken = jwt.sign({ id: directorUser.id, role: directorUser.role }, jwtSecret, { expiresIn: "1h" });

    managerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Manager Tester",
      email: `manager-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "manager",
      isAvailable: true,
    });
    managerToken = jwt.sign({ id: managerUser.id, role: managerUser.role }, jwtSecret, { expiresIn: "1h" });

    salesRepUser = await User.create({
      id: crypto.randomUUID(),
      name: "Rep Tester",
      email: `rep-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "sales_rep",
      isAvailable: true,
    });
    salesRepToken = jwt.sign({ id: salesRepUser.id, role: salesRepUser.role }, jwtSecret, { expiresIn: "1h" });

    siteManagerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Site Manager 1",
      email: `sitemgr1-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
    });
    siteManagerToken = jwt.sign({ id: siteManagerUser.id, role: siteManagerUser.role }, jwtSecret, { expiresIn: "1h" });

    siteManager2User = await User.create({
      id: crypto.randomUUID(),
      name: "Site Manager 2",
      email: `sitemgr2-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
    });
    siteManager2Token = jwt.sign({ id: siteManager2User.id, role: siteManager2User.role }, jwtSecret, { expiresIn: "1h" });

    opsManagerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Ops Manager Tester",
      email: `opsmgr-rbac-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "ops_manager",
      isAvailable: true,
    });
    opsManagerToken = jwt.sign({ id: opsManagerUser.id, role: opsManagerUser.role }, jwtSecret, { expiresIn: "1h" });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. One Shared Role List Consistency
  // ─────────────────────────────────────────────────────────────
  describe("1. Shared Role Constant & Frontend Parity", () => {
    test("ALLOWED_USER_ROLES contains all eight canonical roles", () => {
      const expectedRoles = [
        "sales_rep",
        "senior_ae",
        "manager",
        "sales_manager",
        "director",
        "admin",
        "site_manager",
        "ops_manager",
      ];
      expect(ALLOWED_USER_ROLES).toEqual(expectedRoles);
    });

    test("Frontend dropdown options match backend ALLOWED_USER_ROLES exactly", () => {
      // Import frontend options from common.ts
      const { ALLOWED_USER_ROLES: frontendRoles } = require("../../../frontend/src/types/common");
      expect(frontendRoles).toEqual(ALLOWED_USER_ROLES);

      // Verify every frontend dropdown option is present in the backend allowed list
      for (const role of frontendRoles) {
        expect(ALLOWED_USER_ROLES).toContain(role);
      }
    });

    test("Invalid role rejected with real allowed roles list in error message", async () => {
      const ts = Date.now();
      const res = await request(app)
        .post("/api/v1/salespersons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid Role User",
          email: `invalid-role-${ts}@nexus.com`,
          password: "password123",
          role: "super_administrator",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        `role must be one of: sales_rep, senior_ae, manager, sales_manager, director, admin, site_manager, ops_manager`
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Creation Privilege Rules: Real API
  // ─────────────────────────────────────────────────────────────
  describe("2. Creation Privilege Rules (Admin, Director, Manager, Sales Rep)", () => {
    // 2.1 Admin: can create users with each of the 8 roles
    describe("Admin caller", () => {
      for (const role of ALLOWED_USER_ROLES) {
        test(`Admin can create user with role: ${role}`, async () => {
          const ts = Date.now();
          const email = `admin-created-${role}-${ts}@nexus.com`;
          const res = await request(app)
            .post("/api/v1/salespersons")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
              name: `Admin Created ${role}`,
              email,
              password: "password123",
              role,
            });

          expect(res.status).toBe(201);
          expect(res.body.role).toBe(role);

          // Verify stored in DB
          const dbUser: any = await User.findOne({ where: { email } });
          expect(dbUser).not.toBeNull();
          expect(dbUser.role).toBe(role);
        });
      }
    });

    // 2.2 Director: can create all except admin
    describe("Director caller", () => {
      test("Director cannot create admin (above their own role) -> 403 Forbidden", async () => {
        const ts = Date.now();
        const res = await request(app)
          .post("/api/v1/salespersons")
          .set("Authorization", `Bearer ${directorToken}`)
          .send({
            name: "Director Attempt Admin",
            email: `dir-admin-${ts}@nexus.com`,
            password: "password123",
            role: "admin",
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/nobody can assign a role above their own/i);
      });

      const allowedForDirector = ALLOWED_USER_ROLES.filter((r) => r !== "admin");
      for (const role of allowedForDirector) {
        test(`Director can create user with role: ${role}`, async () => {
          const ts = Date.now();
          const email = `dir-created-${role}-${ts}@nexus.com`;
          const res = await request(app)
            .post("/api/v1/salespersons")
            .set("Authorization", `Bearer ${directorToken}`)
            .send({
              name: `Director Created ${role}`,
              email,
              password: "password123",
              role,
            });

          expect(res.status).toBe(201);
          expect(res.body.role).toBe(role);

          const dbUser: any = await User.findOne({ where: { email } });
          expect(dbUser.role).toBe(role);
        });
      }
    });

    // 2.3 Manager: can create manager, sales_manager, site_manager, senior_ae, sales_rep
    // but blocked on admin, director, ops_manager
    describe("Manager caller", () => {
      test("Manager cannot create admin (above own role) -> 403 Forbidden", async () => {
        const ts = Date.now();
        const res = await request(app)
          .post("/api/v1/salespersons")
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            name: "Manager Attempt Admin",
            email: `mgr-admin-${ts}@nexus.com`,
            password: "password123",
            role: "admin",
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/nobody can assign a role above their own/i);
      });

      test("Manager cannot create director (above own role) -> 403 Forbidden", async () => {
        const ts = Date.now();
        const res = await request(app)
          .post("/api/v1/salespersons")
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            name: "Manager Attempt Director",
            email: `mgr-dir-${ts}@nexus.com`,
            password: "password123",
            role: "director",
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/nobody can assign a role above their own/i);
      });

      test("Manager cannot create ops_manager (only admin or director) -> 403 Forbidden", async () => {
        const ts = Date.now();
        const res = await request(app)
          .post("/api/v1/salespersons")
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            name: "Manager Attempt Ops Manager",
            email: `mgr-ops-${ts}@nexus.com`,
            password: "password123",
            role: "ops_manager",
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/only admin or director can create or assign ops_manager/i);
      });

      const allowedForManager = ["manager", "sales_manager", "site_manager", "senior_ae", "sales_rep"];
      for (const role of allowedForManager) {
        test(`Manager can create user with role: ${role}`, async () => {
          const ts = Date.now();
          const email = `mgr-created-${role}-${ts}@nexus.com`;
          const res = await request(app)
            .post("/api/v1/salespersons")
            .set("Authorization", `Bearer ${managerToken}`)
            .send({
              name: `Manager Created ${role}`,
              email,
              password: "password123",
              role,
            });

          expect(res.status).toBe(201);
          expect(res.body.role).toBe(role);

          const dbUser: any = await User.findOne({ where: { email } });
          expect(dbUser.role).toBe(role);
        });
      }
    });

    // 2.4 Sales Rep: cannot create users
    describe("Sales Rep caller", () => {
      for (const role of ALLOWED_USER_ROLES) {
        test(`Sales rep cannot create user with role ${role} -> 403 Forbidden`, async () => {
          const ts = Date.now();
          const res = await request(app)
            .post("/api/v1/salespersons")
            .set("Authorization", `Bearer ${salesRepToken}`)
            .send({
              name: `Rep Attempt ${role}`,
              email: `rep-create-${role}-${ts}@nexus.com`,
              password: "password123",
              role,
            });

          expect(res.status).toBe(403);
          expect(res.body.error).toMatch(/only admins, directors, and managers can create users/i);
        });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. User Cannot Change Their Own Role
  // ─────────────────────────────────────────────────────────────
  describe("3. Self Role Change Prevention", () => {
    test("A manager cannot change their own role to admin -> 403 Forbidden", async () => {
      const res = await request(app)
        .put(`/api/v1/salespersons/${managerUser.id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/a user cannot change their own role/i);
    });

    test("An admin cannot change their own role -> 403 Forbidden", async () => {
      const res = await request(app)
        .put(`/api/v1/salespersons/${adminUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "director" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/a user cannot change their own role/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Site Manager & Operations Manager Workflow Verification
  // ─────────────────────────────────────────────────────────────
  describe("4. Site Manager & Operations Manager Functionality", () => {
    let testInspection: any;
    let unassignedInspection: any;
    let base: any;
    let testLead: any;

    beforeAll(async () => {
      const ts = Date.now();
      base = await SiteBase.create({
        id: crypto.randomUUID(),
        code: `BASE_${ts}`,
        name: `Test Base ${ts}`,
        region: "Eastern Province",
        latitude: 26.5,
        longitude: 50.0,
      });

      testLead = await Lead.create({
        id: crypto.randomUUID(),
        firstName: "Test",
        lastName: "Client",
        company: "Test Client Org",
        email: `lead-${ts}@test.com`,
        status: "CONTACTED",
      });

      // Inspection assigned to siteManagerUser
      testInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        leadId: testLead.id,
        inspectionNumber: `INSP-TEST-${ts}`,
        status: "DRAFT",
        clientOrganization: "Test Client Org",
        siteName: "Industrial Zone Plant",
        baseId: base.id,
        assignedToId: siteManagerUser.id,
      });

      // Unassigned inspection
      unassignedInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        leadId: testLead.id,
        inspectionNumber: `INSP-UNASSIGNED-${ts}`,
        status: "DRAFT",
        clientOrganization: "Unassigned Client Org",
        siteName: "Secondary Site",
        baseId: base.id,
        assignedToId: null,
      });
    });

    test("site_manager can view their assigned inspection", async () => {
      const res = await request(app)
        .get(`/api/v1/site-inspections/${testInspection.id}`)
        .set("Authorization", `Bearer ${siteManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testInspection.id);
    });

    test("site_manager can view unassigned inspection", async () => {
      const res = await request(app)
        .get(`/api/v1/site-inspections/${unassignedInspection.id}`)
        .set("Authorization", `Bearer ${siteManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(unassignedInspection.id);
    });

    test("site_manager cannot view another site_manager's inspection -> 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/site-inspections/${testInspection.id}`)
        .set("Authorization", `Bearer ${siteManager2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
    });

    test("site_manager can update draft of their inspection", async () => {
      const res = await request(app)
        .put(`/api/v1/site-inspections/${testInspection.id}`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({ siteContactName: "Fahad Al-Harbi" });

      expect(res.status).toBe(200);
    });

    test("site_manager CANNOT approve inspection -> 403 Forbidden", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${testInspection.id}/review`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({ action: "APPROVE" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/approver|authorized/i);
    });

    test("ops_manager can view all inspections (including assigned and unassigned)", async () => {
      const res = await request(app)
        .get("/api/v1/site-inspections")
        .set("Authorization", `Bearer ${opsManagerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((i: any) => i.id);
      expect(ids).toContain(testInspection.id);
      expect(ids).toContain(unassignedInspection.id);
    });

    test("ops_manager can request changes with mandatory comment", async () => {
      // First update status to SUBMITTED so review is valid
      await testInspection.update({ status: "SUBMITTED" });

      const res = await request(app)
        .post(`/api/v1/site-inspections/${testInspection.id}/review`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ action: "REQUEST_CHANGES", comment: "Please specify facility GPS coordinates" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CHANGES_REQUESTED");
    });

    test("ops_manager CANNOT approve an inspection assigned to themselves -> 400 Bad Request", async () => {
      const ts = Date.now();
      const selfAssigned = await SiteInspection.create({
        id: crypto.randomUUID(),
        leadId: testLead.id,
        inspectionNumber: `INSP-SELF-${ts}`,
        status: "SUBMITTED",
        clientOrganization: "Self Org",
        siteName: "Self Site",
        baseId: base.id,
        assignedToId: opsManagerUser.id,
      });

      const res = await request(app)
        .post(`/api/v1/site-inspections/${selfAssigned.id}/review`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ action: "APPROVE" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/self-approval is forbidden/i);
    });

    test("neither site_manager nor ops_manager can access unrelated admin routes -> 403 Forbidden", async () => {
      // site_manager blocked on sales approval profiles
      const siteMgrRes = await request(app)
        .get("/api/v1/sales-approval-profiles")
        .set("Authorization", `Bearer ${siteManagerToken}`);
      expect(siteMgrRes.status).toBe(403);

      // ops_manager blocked on sales approval profiles
      const opsMgrRes = await request(app)
        .get("/api/v1/sales-approval-profiles")
        .set("Authorization", `Bearer ${opsManagerToken}`);
      expect(opsMgrRes.status).toBe(403);
    });
  });
});
