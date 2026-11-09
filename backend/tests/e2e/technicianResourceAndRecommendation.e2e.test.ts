process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import jwt from "jsonwebtoken";
import crypto from "crypto";

describe("Technician Skills, Experience, Absence & Smart Recommendation E2E Tests", () => {
  let app: any;
  let adminToken: string;
  let testAdminUser: any;
  let techUser1: any;
  let techUser2: any;
  let techUser3: any;

  let techResource1: any;
  let techResource2: any;
  let techResource3: any;

  let testAccount: any;
  let testWorkOrder: any;

  beforeAll(async () => {
    app = createServer();

    // Ensure database tables exist in SQLite test instance
    await sequelize.sync();

    // Create Admin User
    testAdminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Admin Dispatcher",
      email: `admin_dispatch_${Date.now()}@test.com`,
      password: "password123",
      role: "admin",
    });

    const jwtSecret = process.env.JWT_SECRET || "crm-secret-key-change-in-production";
    adminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: "admin" },
      jwtSecret,
      { expiresIn: "1h" }
    );

    // Create 3 Technician Users
    techUser1 = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Tariq Al-Mansoor",
      email: `tariq_${Date.now()}@test.com`,
      password: "password123",
      role: "technician",
    });

    techUser2 = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Zayd Al-Harbi",
      email: `zayd_${Date.now()}@test.com`,
      password: "password123",
      role: "technician",
    });

    techUser3 = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Fahad Al-Otaibi",
      email: `fahad_${Date.now()}@test.com`,
      password: "password123",
      role: "technician",
    });

    // Create Test Account & Work Order for testing recommendations
    testAccount = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Al-Khobar Heavy Industries",
      type: "Customer",
      email: "ops@alkhobarheavy.com",
    });

    testWorkOrder = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: "WO-TEST-SMART-01",
      accountId: testAccount.id,
      subject: "Industrial Diesel Generator Overhaul & 415V Wiring",
      description: "Needs senior certified technician for Cummins 500kVA Generator electrical hookup and vibration testing.",
      status: "New",
      priority: "High",
      type: "Installation",
      territory: "Eastern Province",
    });
  });

  afterAll(async () => {
    // Clean up created resources
    if (techResource1) await techResource1.destroy().catch(() => {});
    if (techResource2) await techResource2.destroy().catch(() => {});
    if (techResource3) await techResource3.destroy().catch(() => {});
    if (testWorkOrder) await testWorkOrder.destroy().catch(() => {});
    if (testAccount) await testAccount.destroy().catch(() => {});
    if (techUser1) await techUser1.destroy().catch(() => {});
    if (techUser2) await techUser2.destroy().catch(() => {});
    if (techUser3) await techUser3.destroy().catch(() => {});
    if (testAdminUser) await testAdminUser.destroy().catch(() => {});
  });

  it("1. Creates service resources with skills, certifications, company experience, and previous experience", async () => {
    // Tech 1: Senior Generator & Electrical Specialist in Eastern Province
    const res1 = await request(app)
      .post("/api/v1/service-resources")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: techUser1.id,
        resourceType: "Technician",
        territory: "Eastern Province",
        skills: ["Generator", "Electrical", "Diagnostics"],
        certifications: ["Cummins Certified", "415V Master License"],
        experienceYearsWithCompany: 4.5,
        previousExperience: "6 years at Saudi Electricity Company as substation lead",
        attendanceStatus: "On Duty",
        isActive: true,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.name).toBe("Tariq Al-Mansoor");
    expect(res1.body.skills).toEqual(expect.arrayContaining(["Generator", "Electrical"]));
    expect(res1.body.certifications).toEqual(expect.arrayContaining(["Cummins Certified"]));
    expect(res1.body.experienceYearsWithCompany).toBe(4.5);
    expect(res1.body.attendanceStatus).toBe("On Duty");
    techResource1 = await sequelize.models.ServiceResource.findByPk(res1.body.id);

    // Tech 2: Junior HVAC Tech in Riyadh
    const res2 = await request(app)
      .post("/api/v1/service-resources")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: techUser2.id,
        resourceType: "Technician",
        territory: "Riyadh",
        skills: ["HVAC", "Plumbing"],
        certifications: ["EPA Universal"],
        experienceYearsWithCompany: 1,
        previousExperience: "Apprentice at AC Pro",
        attendanceStatus: "On Duty",
        isActive: true,
      });

    expect(res2.status).toBe(201);
    techResource2 = await sequelize.models.ServiceResource.findByPk(res2.body.id);

    // Tech 3: Senior Electrical in Eastern Province, but currently On Leave
    const res3 = await request(app)
      .post("/api/v1/service-resources")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: techUser3.id,
        resourceType: "Technician",
        territory: "Eastern Province",
        skills: ["Generator", "Electrical"],
        certifications: ["415V License"],
        experienceYearsWithCompany: 3,
        previousExperience: "4 years industrial contractor",
        attendanceStatus: "On Leave",
        isActive: true,
      });

    expect(res3.status).toBe(201);
    techResource3 = await sequelize.models.ServiceResource.findByPk(res3.body.id);
  });

  it("2. Can update technician attendance status and profile details", async () => {
    const res = await request(app)
      .put(`/api/v1/service-resources/${techResource1.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        experienceYearsWithCompany: 5,
        attendanceStatus: "On Duty",
      });

    expect(res.status).toBe(200);
    expect(res.body.experienceYearsWithCompany).toBe(5);
  });

  it("3. Can manage scheduled technician absences (leave / vacation / holiday calendar)", async () => {
    const tomorrowStart = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrowStart.setHours(8, 0, 0, 0);
    const tomorrowEnd = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrowEnd.setHours(17, 0, 0, 0);

    // Create absence for Tech 1
    const createAbsenceRes = await request(app)
      .post(`/api/v1/service-resources/${techResource1.id}/absences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "Vacation",
        startDate: tomorrowStart.toISOString(),
        endDate: tomorrowEnd.toISOString(),
        reason: "Annual family holiday in Abha",
      });

    expect(createAbsenceRes.status).toBe(201);
    expect(createAbsenceRes.body.type).toBe("Vacation");
    expect(createAbsenceRes.body.reason).toContain("Annual family holiday");

    // List absences
    const listRes = await request(app)
      .get(`/api/v1/service-resources/${techResource1.id}/absences`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);

    const absenceId = createAbsenceRes.body.id;

    // Delete absence test helper
    const deleteRes = await request(app)
      .delete(`/api/v1/service-resources/${techResource1.id}/absences/${absenceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 204]).toContain(deleteRes.status);
  });

  it("4. Prevents scheduling a service appointment during approved technician absence (HTTP 409 Conflict)", async () => {
    const leaveDay = new Date(Date.now() + 48 * 3600 * 1000);
    const leaveStart = new Date(leaveDay);
    leaveStart.setHours(8, 0, 0, 0);
    const leaveEnd = new Date(leaveDay);
    leaveEnd.setHours(18, 0, 0, 0);

    // Book approved sick leave for Tech 1
    await request(app)
      .post(`/api/v1/service-resources/${techResource1.id}/absences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "Medical Leave",
        startDate: leaveStart.toISOString(),
        endDate: leaveEnd.toISOString(),
        reason: "Hospital appointment",
      });

    // Attempt to schedule appointment overlapping that leave window
    const apptConflictStart = new Date(leaveDay);
    apptConflictStart.setHours(10, 0, 0, 0);
    const apptConflictEnd = new Date(leaveDay);
    apptConflictEnd.setHours(12, 0, 0, 0);

    const schedRes = await request(app)
      .post(`/api/v1/work-orders/${testWorkOrder.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Overhaul Service During Leave",
        serviceResourceId: techResource1.id,
        scheduledStartTime: apptConflictStart.toISOString(),
        scheduledEndTime: apptConflictEnd.toISOString(),
        notifyCustomer: false,
      });

    expect(schedRes.status).toBe(409);
    expect(schedRes.body.message).toContain("approved leave");
  });

  it("5. Computes smart technician recommendations factoring in skills, territory, absence, and experience", async () => {
    // Query recommendation engine for work order
    const recommendRes = await request(app)
      .get(`/api/v1/work-orders/${testWorkOrder.id}/recommended-technicians`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(recommendRes.status).toBe(200);
    const recommendations = recommendRes.body;
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThanOrEqual(2);

    // Tariq (tech 1) has skills (Generator + Electrical match), territory (Eastern Province match), and 5y exp
    const tech1Rec = recommendations.find((r: any) => r.resource.id === techResource1.id);
    expect(tech1Rec).toBeDefined();
    expect(tech1Rec.matchScore).toBeGreaterThan(60);
    expect(tech1Rec.matchReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("Skills match"), expect.stringContaining("territory matches")])
    );

    // Tech 2 (HVAC in Riyadh) should have significantly lower match score
    const tech2Rec = recommendations.find((r: any) => r.resource.id === techResource2.id);
    expect(tech2Rec).toBeDefined();
    expect(tech1Rec.matchScore).toBeGreaterThan(tech2Rec.matchScore);

    // Tech 3 is marked 'On Leave' so conflictReason or availability is accounted for
    const tech3Rec = recommendations.find((r: any) => r.resource.id === techResource3.id);
    expect(tech3Rec).toBeDefined();
    expect(tech3Rec.isAvailable).toBe(false);
    expect(tech3Rec.conflictReason).toContain("On Leave");
  });

  it("6. Business Users API: Creates employee with role 'technician' and auto-provisions ServiceResource", async () => {
    const newTechEmail = `biz_tech_${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/v1/salespersons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Yousef Al-Ghamdi",
        email: newTechEmail,
        password: "password123",
        role: "technician",
        department: "Field Service",
        territory: "Dammam",
        skills: ["Waste Machinery", "Hydraulics", "Compactor"],
        certifications: ["Heavy Equipment Master"],
        experienceYearsWithCompany: 2.5,
        previousExperience: "4 years hydraulic press maintenance",
        attendanceStatus: "On Duty",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Yousef Al-Ghamdi");
    expect(res.body.role).toBe("technician");

    // Verify linked ServiceResource was automatically created
    const serviceResource = await sequelize.models.ServiceResource.findOne({
      where: { userId: res.body.id }
    });
    expect(serviceResource).toBeDefined();
    expect((serviceResource as any).skills).toEqual(expect.arrayContaining(["Waste Machinery", "Hydraulics"]));
    expect((serviceResource as any).experienceYearsWithCompany).toBe(2.5);
    expect((serviceResource as any).attendanceStatus).toBe("On Duty");

    // Clean up
    if (serviceResource) await serviceResource.destroy().catch(() => {});
    await sequelize.models.User.destroy({ where: { id: res.body.id } }).catch(() => {});
  });

  it("7. Business Users API: Updates technician duty status and skills via capacity endpoint", async () => {
    // Create a technician user first
    const techUser: any = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Sami Al-Nasser",
      email: `sami_${Date.now()}@test.com`,
      password: "password123",
      role: "technician",
      department: "Field Service",
      territory: "Jeddah",
    });

    const res = await request(app)
      .put(`/api/v1/salespersons/${techUser.id}/capacity`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        attendanceStatus: "On Leave",
        skills: ["Generator", "Electrical"],
        experienceYearsWithCompany: 3,
      });

    expect(res.status).toBe(200);

    // Verify ServiceResource reflects the new status
    const linkedRes = await sequelize.models.ServiceResource.findOne({
      where: { userId: techUser.id }
    });
    expect(linkedRes).toBeDefined();
    expect((linkedRes as any).attendanceStatus).toBe("On Leave");
    expect((linkedRes as any).experienceYearsWithCompany).toBe(3);

    // Clean up
    if (linkedRes) await linkedRes.destroy().catch(() => {});
    await techUser.destroy().catch(() => {});
  });
});
