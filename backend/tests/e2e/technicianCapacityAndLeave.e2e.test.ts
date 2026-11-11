import request from "supertest";
import { createServer } from "../../server";
import { sequelize, User, ServiceResource, ResourceAbsence, WorkOrder } from "@nexus-crm/database";
import jwt from "jsonwebtoken";

const app = createServer();

describe("Technician Qualifications & Leave Scheduler E2E", () => {
  const jwtSecret = process.env.JWT_SECRET || "default_secret";
  let adminToken: string;
  let techUser: any;
  let serviceRes: any;
  let workOrder: any;

  beforeAll(async () => {
    adminToken = jwt.sign(
      { id: "admin-leave-test-id", role: "admin", email: "admin.leave@nexus.com" },
      jwtSecret,
      { expiresIn: "1h" }
    );

    techUser = await User.create({
      id: "tech-user-leave-1",
      name: "Marcus Vane",
      email: "marcus.vane@fieldservice.com",
      role: "technician",
      password: "password123",
      territory: "North Zone",
      department: "Field Service",
      isAvailable: true
    });

    serviceRes = await ServiceResource.create({
      id: "res-marcus-1",
      name: techUser.name,
      userId: techUser.id,
      resourceType: "Technician",
      skills: ["Generator", "Diesel Engines"],
      certifications: ["Cummins Level 2"],
      experienceYearsWithCompany: 4.5,
      attendanceStatus: "On Duty",
      location: "North Zone",
      isActive: true,
      email: techUser.email
    });

    workOrder = await WorkOrder.create({
      id: "wo-leave-check-1",
      workOrderNumber: "WO-LEAVE-999",
      subject: "Generator Diesel Engine Overhaul",
      description: "Needs Cummins certified technician for Generator in North Zone",
      status: "New",
      priority: "High",
      city: "North Zone"
    });
  });

  afterAll(async () => {
    if (workOrder) await WorkOrder.destroy({ where: { id: workOrder.id } });
    if (serviceRes) {
      await ResourceAbsence.destroy({ where: { serviceResourceId: serviceRes.id } });
      await ServiceResource.destroy({ where: { id: serviceRes.id } });
    }
    if (techUser) await User.destroy({ where: { id: techUser.id } });
  });

  test("PUT /api/v1/salespersons/:id/capacity updates skills, experience, and certifications", async () => {
    const res = await request(app)
      .put(`/api/v1/salespersons/${techUser.id}/capacity`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        skills: "Generator, Electrical 415V, Turbines",
        certifications: "Cummins Master, OSHA 30",
        experienceYearsWithCompany: 6,
        previousExperience: "7 years at Siemens field power division",
        attendanceStatus: "On Duty"
      });

    expect(res.status).toBe(200);

    const updated = await ServiceResource.findByPk(serviceRes.id);
    expect(updated).not.toBeNull();
    const skills = typeof (updated as any).skills === "string" ? JSON.parse((updated as any).skills) : (updated as any).skills;
    expect(skills).toContain("Electrical 415V");
    expect((updated as any).experienceYearsWithCompany).toBe(6);
    expect((updated as any).previousExperience).toContain("Siemens");
  });

  test("PUT /api/v1/salespersons/:id/capacity schedules a planned leave window", async () => {
    const startDate = "2026-11-20T00:00:00.000Z";
    const endDate = "2026-11-25T23:59:59.000Z";

    const res = await request(app)
      .put(`/api/v1/salespersons/${techUser.id}/capacity`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        leaveStartDate: startDate,
        leaveEndDate: endDate,
        leaveType: "Vacation",
        leaveReason: "Annual Family Vacation"
      });

    expect(res.status).toBe(200);

    const absences = await ResourceAbsence.findAll({ where: { serviceResourceId: serviceRes.id } });
    expect(absences.length).toBeGreaterThan(0);
    expect((absences[0] as any).reason).toBe("Annual Family Vacation");

    // Auto-recommendation engine check: On a date overlapping with leave, technician is flagged with conflict
    const recRes = await request(app)
      .get(`/api/v1/work-orders/${workOrder.id}/recommended-technicians?startTime=2026-11-21T09:00:00.000Z&endTime=2026-11-21T11:00:00.000Z`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(recRes.status).toBe(200);
    const techRec = recRes.body.find((r: any) => r.resource?.id === serviceRes.id || r.id === serviceRes.id);
    expect(techRec).toBeDefined();
    expect(techRec.isAvailable).toBe(false);
    expect(techRec.conflictReason).toContain("Approved Vacation");
  });

  test("PUT /api/v1/salespersons/:id/capacity removes planned leave when removeAbsenceId is provided", async () => {
    const absences = await ResourceAbsence.findAll({ where: { serviceResourceId: serviceRes.id } });
    expect(absences.length).toBeGreaterThan(0);
    const absId = absences[0].id;

    const res = await request(app)
      .put(`/api/v1/salespersons/${techUser.id}/capacity`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        removeAbsenceId: absId
      });

    expect(res.status).toBe(200);

    const remaining = await ResourceAbsence.findByPk(absId);
    expect(remaining).toBeNull();
  });
});
