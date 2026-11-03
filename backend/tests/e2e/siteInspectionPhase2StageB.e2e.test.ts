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
  SiteInspectionAlert,
  SiteInspectionAutomationRun,
} from "@nexus-crm/database";
import { updateSettings } from "../../src/services/siteInspectionSettingsService";
import { runAutomationScanPass, getAutomationHealth } from "../../src/services/siteInspectionAutomationScanner";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const app = createServer();

describe("Site Inspection Phase 2 — Stage B End-to-End Test Suite", () => {
  const jwtSecret = process.env.JWT_SECRET || "default_secret";

  let adminUser: any;
  let opsManagerUser: any;
  let directorUser: any;
  let salesRepUser: any;
  let inspectorAlpha: any;
  let inspectorBeta: any;

  let adminToken: string;
  let opsManagerToken: string;
  let directorToken: string;
  let salesRepToken: string;
  let inspectorAlphaToken: string;
  let inspectorBetaToken: string;

  let baseJubail: any;

  async function makeTestLead(tag: string = "lead") {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    return Lead.create({
      id: crypto.randomUUID(),
      firstName: "Test",
      lastName: `${tag}-${ts}`,
      company: `Volvi Corp ${ts}`,
      email: `${tag}-${ts}@client.com`,
      phone: `+966500${Math.floor(100000 + Math.random() * 900000)}`,
      stage: "CONTACTED",
    });
  }

  beforeAll(async () => {
    const ts = Date.now();

    adminUser = await User.create({
      id: crypto.randomUUID(),
      name: "Admin Stage B",
      email: `admin-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "admin",
      isAvailable: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: "1h" });

    opsManagerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Ops Manager Stage B",
      email: `ops-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "ops_manager",
      isAvailable: true,
    });
    opsManagerToken = jwt.sign({ id: opsManagerUser.id, role: opsManagerUser.role }, jwtSecret, { expiresIn: "1h" });

    directorUser = await User.create({
      id: crypto.randomUUID(),
      name: "Director Stage B",
      email: `director-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "director",
      isAvailable: true,
    });
    directorToken = jwt.sign({ id: directorUser.id, role: directorUser.role }, jwtSecret, { expiresIn: "1h" });

    salesRepUser = await User.create({
      id: crypto.randomUUID(),
      name: "Sales Rep Stage B",
      email: `rep-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "sales_rep",
      isAvailable: true,
    });
    salesRepToken = jwt.sign({ id: salesRepUser.id, role: salesRepUser.role }, jwtSecret, { expiresIn: "1h" });

    inspectorAlpha = await User.create({
      id: crypto.randomUUID(),
      name: `Inspector Alpha ${ts}`,
      email: `alpha-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
    });
    inspectorAlphaToken = jwt.sign({ id: inspectorAlpha.id, role: inspectorAlpha.role }, jwtSecret, { expiresIn: "1h" });

    inspectorBeta = await User.create({
      id: crypto.randomUUID(),
      name: `Inspector Beta ${ts}`,
      email: `beta-b-${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
    });
    inspectorBetaToken = jwt.sign({ id: inspectorBeta.id, role: inspectorBeta.role }, jwtSecret, { expiresIn: "1h" });

    const [base] = await SiteBase.findOrCreate({
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
    baseJubail = base;

    await SiteInspectorProfile.findOrCreate({
      where: { userId: inspectorAlpha.id },
      defaults: {
        id: crypto.randomUUID(),
        userId: inspectorAlpha.id,
        homeBaseId: baseJubail.id,
        isAvailable: true,
        maxOpenInspections: 10,
        certifications: JSON.stringify(["COMMERCIAL"]),
      },
    });

    await SiteInspectorProfile.findOrCreate({
      where: { userId: inspectorBeta.id },
      defaults: {
        id: crypto.randomUUID(),
        userId: inspectorBeta.id,
        homeBaseId: baseJubail.id,
        isAvailable: true,
        maxOpenInspections: 10,
        certifications: JSON.stringify(["COMMERCIAL"]),
      },
    });

    // Update settings: Saudi working week (0-4), 08:00-17:00, maxVisitsPerDay: 2, automation enabled
    await updateSettings({
      workingWeek: [0, 1, 2, 3, 4],
      workingHours: { start: "08:00", end: "17:00" },
      maxVisitsPerDay: 2,
      slaHours: {
        accept: 4,
        schedule: 24,
        submit: 48,
        review: 24,
      },
      automation: true,
    });
  });

  describe("1. Inspector Accept State Machine Flow", () => {
    let testInspection: any;

    beforeEach(async () => {
      const ts = Date.now();
      const lead = await makeTestLead("accept");

      testInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-ACC-${ts}`,
        leadId: lead.id,
        status: "REQUESTED",
        assignmentState: "OFFERED",
        assignedToId: inspectorAlpha.id,
        assignedAt: new Date(),
        priority: "NORMAL",
        siteAreaName: "Jubail Industrial",
        slaAcceptDueAt: new Date(Date.now() + 4 * 3600000),
      });
    });

    test("Non-assigned user cannot accept the inspection", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${testInspection.id}/accept`)
        .set("Authorization", `Bearer ${inspectorBetaToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Only the assigned inspector");
    });

    test("Assigned inspector successfully accepts inspection -> transitions to DRAFT with timestamp & audit log", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${testInspection.id}/accept`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.assignmentState).toBe("ASSIGNED");
      expect(res.body.acceptedAt).toBeDefined();

      const updated: any = await SiteInspection.findByPk(testInspection.id);
      expect(updated).not.toBeNull();
      expect(updated.status).toBe("DRAFT");
      expect(updated.acceptedAt).toBeDefined();

      const audit: any = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: testInspection.id, action: "ACCEPT_ASSIGNMENT" },
      });
      expect(audit).not.toBeNull();
      expect(audit.actorId).toBe(inspectorAlpha.id);
    });
  });

  describe("2. Inspector Decline & Candidate Re-offer", () => {
    let declineInspectionRecord: any;

    beforeEach(async () => {
      const ts = Date.now();
      const lead = await makeTestLead("decline");

      declineInspectionRecord = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-DEC-${ts}`,
        leadId: lead.id,
        status: "REQUESTED",
        assignmentState: "OFFERED",
        assignedToId: inspectorAlpha.id,
        assignedAt: new Date(),
        priority: "NORMAL",
        siteAreaName: "Jubail Industrial",
        siteLatitudeHint: 27.01,
        siteLongitudeHint: 49.66,
      });
    });

    test("Decline requires a non-empty reason", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${declineInspectionRecord.id}/decline`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({ reason: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("reason is mandatory");
    });

    test("Decline re-offers inspection to next candidate and excludes declining inspector", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${declineInspectionRecord.id}/decline`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({ reason: "Emergency conflict with refinery project" });

      expect(res.status).toBe(200);

      // Verify audit log of decline
      const declineAudit: any = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: declineInspectionRecord.id, action: "DECLINE_ASSIGNMENT" },
      });
      expect(declineAudit).not.toBeNull();
      expect(declineAudit.reason).toContain("Emergency conflict");
      expect(declineAudit.fromValue).toBe(inspectorAlpha.id);

      // Verify inspection is re-assigned/offered to Inspector Beta
      const reoffered: any = await SiteInspection.findByPk(declineInspectionRecord.id);
      expect(reoffered).not.toBeNull();
      expect(reoffered.assignedToId).toBe(inspectorBeta.id);
      expect(reoffered.assignedToId).not.toBe(inspectorAlpha.id);
    });
  });

  describe("3. Visit Scheduling & Max Visits Per Day Enforcement", () => {
    let schedInspection: any;

    beforeEach(async () => {
      const ts = Date.now();
      const lead = await makeTestLead("sched");

      schedInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-SCH-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        acceptedAt: new Date(),
        priority: "NORMAL",
      });
    });

    test("Rejects scheduling on weekend (Friday/Saturday in Saudi Arabia)", async () => {
      // 2026-11-06 is Friday (weekend)
      const fridayDate = "2026-11-06T10:00:00Z";

      const res = await request(app)
        .post(`/api/v1/site-inspections/${schedInspection.id}/schedule`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({ scheduledVisitAt: fridayDate });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("non-working day");
    });

    test("Accepts scheduling on a working day (Sunday-Thursday)", async () => {
      // 2026-11-08 is Sunday (working day)
      const sundayDate = "2026-11-08T09:00:00Z";

      const res = await request(app)
        .post(`/api/v1/site-inspections/${schedInspection.id}/schedule`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({ scheduledVisitAt: sundayDate });

      expect(res.status).toBe(200);
      expect(res.body.scheduledVisitAt).toBeDefined();

      const audit = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: schedInspection.id, action: "SCHEDULE_VISIT" },
      });
      expect(audit).not.toBeNull();
    });

    test("Enforces maxVisitsPerDay limit (default: 2 visits)", async () => {
      // Create 2 existing inspections scheduled for Sunday 2026-11-08
      const sundayVisit1 = "2026-11-08T08:30:00Z";
      const sundayVisit2 = "2026-11-08T13:30:00Z";

      const lead1 = await makeTestLead("visit1");
      await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-V1-${Date.now()}`,
        leadId: lead1.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        scheduledVisitAt: new Date(sundayVisit1),
      });

      const lead2 = await makeTestLead("visit2");
      await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-V2-${Date.now()}`,
        leadId: lead2.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        scheduledVisitAt: new Date(sundayVisit2),
      });

      // Trying to schedule a 3rd visit on the same day for inspectorAlpha should be blocked
      const sundayVisit3 = "2026-11-08T15:00:00Z";
      const res = await request(app)
        .post(`/api/v1/site-inspections/${schedInspection.id}/schedule`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({ scheduledVisitAt: sundayVisit3 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Maximum allowed: 2");
    });
  });

  describe("4. Start Field Visit Assessment", () => {
    test("Inspector records start of field visit", async () => {
      const ts = Date.now();
      const lead = await makeTestLead("start");
      const inspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-START-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        scheduledVisitAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/v1/site-inspections/${inspection.id}/start-visit`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.startedAt).toBeDefined();

      const audit = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: inspection.id, action: "START_VISIT" },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("5. SLA Extension Request & Manager Review", () => {
    let extInspection: any;

    beforeEach(async () => {
      const ts = Date.now();
      const lead = await makeTestLead("ext");
      extInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-EXT-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        slaSubmitDueAt: new Date(Date.now() + 24 * 3600000),
      });
    });

    test("Inspector requests more time", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${extInspection.id}/request-more-time`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({
          hoursRequested: 24,
          reason: "Adverse dust storm prevents roof inspection today",
        });

      expect(res.status).toBe(200);
      expect(res.body.moreTimeStatus).toBe("PENDING");
      expect(res.body.moreTimeRequestedHours).toBe(24);
      expect(res.body.moreTimeReason).toContain("dust storm");
    });

    test("Only Ops Manager, Director, or Admin can review extension request", async () => {
      // Sales rep tries to approve
      const res = await request(app)
        .post(`/api/v1/site-inspections/${extInspection.id}/review-more-time`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({ action: "APPROVE", comment: "Looks okay" });

      expect(res.status).toBe(403);
    });

    test("Ops Manager approves extension -> extends slaSubmitDueAt by requested hours", async () => {
      // First put in REQUESTED/PENDING state
      await extInspection.update({
        moreTimeStatus: "PENDING",
        moreTimeRequestedHours: 24,
        moreTimeReason: "Weather delay",
      });

      const originalDue = new Date(extInspection.slaSubmitDueAt);

      const res = await request(app)
        .post(`/api/v1/site-inspections/${extInspection.id}/review-more-time`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ action: "APPROVE", comment: "Weather delay confirmed" });

      expect(res.status).toBe(200);
      expect(res.body.moreTimeStatus).toBe("APPROVED");

      const updated: any = await SiteInspection.findByPk(extInspection.id);
      expect(updated).not.toBeNull();
      expect(updated.moreTimeStatus).toBe("APPROVED");
      const updatedDue = new Date(updated.slaSubmitDueAt);
      expect(updatedDue.getTime()).toBeGreaterThan(originalDue.getTime());
    });
  });

  describe("6. Pause & Resume SLA Clocks (Waiting on Client)", () => {
    let pauseInspection: any;

    beforeEach(async () => {
      const ts = Date.now();
      const lead = await makeTestLead("pause");
      pauseInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-PAUSE-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        slaSubmitDueAt: new Date(Date.now() + 24 * 3600000),
      });
    });

    test("Pauses SLA clock when waiting on client", async () => {
      const res = await request(app)
        .post(`/api/v1/site-inspections/${pauseInspection.id}/waiting-on-client`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`)
        .send({
          reason: "Client gate pass delayed pending security clearance",
          expectedAt: "2026-11-10T08:00:00Z",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("WAITING_ON_CLIENT");
      expect(res.body.slaPausedAt).toBeDefined();
      expect(res.body.waitingOnClientReason).toContain("gate pass delayed");

      const audit = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: pauseInspection.id, action: "PAUSE_SLA_WAITING_ON_CLIENT" },
      });
      expect(audit).not.toBeNull();
    });

    test("Resumes SLA clock, accumulates paused minutes, and pushes SLA milestone forward", async () => {
      // Simulate paused 120 minutes ago
      const pausedAt = new Date(Date.now() - 120 * 60000);
      const originalDue = new Date(Date.now() + 24 * 3600000);

      await pauseInspection.update({
        status: "WAITING_ON_CLIENT",
        slaPausedAt: pausedAt,
        slaSubmitDueAt: originalDue,
      });

      const res = await request(app)
        .post(`/api/v1/site-inspections/${pauseInspection.id}/resume`)
        .set("Authorization", `Bearer ${inspectorAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.slaPausedAt).toBeNull();
      expect(res.body.slaTotalPausedMinutes).toBeGreaterThanOrEqual(119);

      const updated: any = await SiteInspection.findByPk(pauseInspection.id);
      expect(updated).not.toBeNull();
      expect(updated.slaPausedAt).toBeNull();
      const newDue = new Date(updated.slaSubmitDueAt);
      expect(newDue.getTime()).toBeGreaterThan(originalDue.getTime());
    });
  });

  describe("7. Manual Due Date Override (Managers Only)", () => {
    test("Ops Manager overrides due date with mandatory reason", async () => {
      const ts = Date.now();
      const lead = await makeTestLead("override");
      const inspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-OVR-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        slaSubmitDueAt: new Date(Date.now() + 24 * 3600000),
      });

      const newDate = new Date(Date.now() + 72 * 3600000).toISOString();
      const res = await request(app)
        .post(`/api/v1/site-inspections/${inspection.id}/override-due-date`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({
          milestone: "SUBMIT",
          newDueAt: newDate,
          reason: "Board requested VIP comprehensive report",
        });

      expect(res.status).toBe(200);
      expect(new Date(res.body.slaSubmitDueAt).toISOString()).toBe(new Date(newDate).toISOString());

      const audit: any = await SiteInspectionAuditLog.findOne({
        where: { inspectionId: inspection.id, action: "OVERRIDE_DUE_DATE" },
      });
      expect(audit).not.toBeNull();
      expect(audit.reason).toContain("VIP comprehensive report");
    });
  });

  describe("8. Background Scanner: Sleeping Instance Catch-Up & Multi-Tier Escalations", () => {
    test("Scanner executes idempotently, detects overdue submission, escalates to Ops, then Director after 24h", async () => {
      const ts = Date.now();
      const lead = await makeTestLead("overdue");

      // Inspection overdue for submission
      const overdueInspection = await SiteInspection.create({
        id: crypto.randomUUID(),
        inspectionNumber: `INSP-OVERDUE-${ts}`,
        leadId: lead.id,
        status: "DRAFT",
        assignedToId: inspectorAlpha.id,
        acceptedAt: new Date(Date.now() - 60 * 3600000),
        slaSubmitDueAt: new Date(Date.now() - 10 * 3600000), // 10 hours overdue
        priority: "NORMAL",
      });

      // Pass 1: Initial scan pass
      const pass1 = await runAutomationScanPass();
      expect(pass1.alertsScanned).toBeGreaterThan(0);
      expect(pass1.alertsTriggered).toBeGreaterThan(0);

      // Verify alert record created
      const alertInspector = await SiteInspectionAlert.findOne({
        where: {
          inspectionId: overdueInspection.id,
          alertType: "OVERDUE_INSPECTOR",
        },
      });
      expect(alertInspector).not.toBeNull();

      // Verify Level 1 escalation to Ops Manager
      const updatedAfterPass1: any = await SiteInspection.findByPk(overdueInspection.id);
      expect(updatedAfterPass1).not.toBeNull();
      expect(updatedAfterPass1.escalatedToOpsAt).toBeDefined();

      const alertOps = await SiteInspectionAlert.findOne({
        where: {
          inspectionId: overdueInspection.id,
          alertType: "OVERDUE_ESCALATION_OPS",
        },
      });
      expect(alertOps).not.toBeNull();

      // Pass 2: Deduplication test — immediate second scan should not duplicate alerts
      const pass2 = await runAutomationScanPass();
      expect(pass2.alertsTriggered).toBe(0);

      // Advance escalatedToOpsAt by 25 hours to simulate elapsed time
      await overdueInspection.update({
        escalatedToOpsAt: new Date(Date.now() - 25 * 3600000),
      });

      // Pass 3: Level 2 escalation to Director
      const pass3 = await runAutomationScanPass();
      expect(pass3.escalationsTriggered).toBeGreaterThan(0);

      const alertDirector = await SiteInspectionAlert.findOne({
        where: {
          inspectionId: overdueInspection.id,
          alertType: "OVERDUE_ESCALATION_DIRECTOR",
        },
      });
      expect(alertDirector).not.toBeNull();

      const updatedAfterPass3: any = await SiteInspection.findByPk(overdueInspection.id);
      expect(updatedAfterPass3).not.toBeNull();
      expect(updatedAfterPass3.escalatedToDirectorAt).toBeDefined();
    });
  });

  describe("9. Automation Health Endpoint", () => {
    test("GET /api/health/automation reports service health, advisory lock, and AST time", async () => {
      const res = await request(app).get("/api/health/automation");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body.serverTimeUtc).toBeDefined();
      expect(res.body.serverTimeRiyadh).toContain("+03:00");
      expect(res.body.advisoryLockKey).toBe(982341);
    });
  });
});
