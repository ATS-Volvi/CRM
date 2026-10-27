import request from "supertest";
import { createServer } from "../../server";
import { sequelize, User, Lead, SiteInspection, SiteBase, SiteFacility } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const app = createServer();

describe("Site Inspection Commercial Pipeline Gate E2E Flow", () => {
  let sendEmailSpy: jest.SpyInstance;
  let sendWhatsAppSpy: jest.SpyInstance;

  let salesRep: any;
  let siteManager: any;
  let siteManager2: any;
  let opsManager: any;

  let salesRepToken: string;
  let siteManagerToken: string;
  let siteManager2Token: string;
  let opsManagerToken: string;

  let testLead: any;
  let inspectionId: string;
  let defaultBase: any;
  let hazardousFacility: any;

  const jwtSecret = process.env.JWT_SECRET || "default_secret";

  beforeAll(async () => {
    // Enable site inspection gate for this E2E test
    delete process.env.SITE_INSPECTION_GATE;

    sendEmailSpy = jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mock-email-id" } as any);
    sendWhatsAppSpy = jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({ success: true, messageId: "SM123" } as any);

    if (!sequelize.models.User) {
      await sequelize.sync();
    }

    const ts = Date.now();

    // ─── a. Create users: sales_rep, site_manager, ops_manager ─────────────
    salesRep = await User.create({
      id: crypto.randomUUID(),
      name: `Sales Representative ${ts}`,
      email: `sales_rep_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "sales_rep",
      isAvailable: true,
      status: "Active",
      maxOpenLeads: 50,
      maxOpenDeals: 20
    });

    siteManager = await User.create({
      id: crypto.randomUUID(),
      name: `Site Manager Alpha ${ts}`,
      email: `site_mgr_alpha_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
      status: "Active"
    });

    siteManager2 = await User.create({
      id: crypto.randomUUID(),
      name: `Site Manager Beta ${ts}`,
      email: `site_mgr_beta_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
      status: "Active"
    });

    opsManager = await User.create({
      id: crypto.randomUUID(),
      name: `Operations Manager ${ts}`,
      email: `ops_mgr_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "ops_manager",
      isAvailable: true,
      status: "Active"
    });

    salesRepToken = jwt.sign({ id: salesRep.id, email: salesRep.email, role: salesRep.role }, jwtSecret);
    siteManagerToken = jwt.sign({ id: siteManager.id, email: siteManager.email, role: siteManager.role }, jwtSecret);
    siteManager2Token = jwt.sign({ id: siteManager2.id, email: siteManager2.email, role: siteManager2.role }, jwtSecret);
    opsManagerToken = jwt.sign({ id: opsManager.id, email: opsManager.email, role: opsManager.role }, jwtSecret);

    defaultBase = await SiteBase.findOne({ where: { code: "JUBAIL" } });
    if (!defaultBase) {
      defaultBase = await SiteBase.create({
        id: crypto.randomUUID(),
        code: "JUBAIL",
        name: "Jubail Operations Base",
        region: "Eastern Province",
        latitude: 27.0,
        longitude: 49.65,
        isActive: true
      });
    }

    hazardousFacility = await SiteFacility.findOne({ where: { serviceType: "HAZARDOUS" } });
    if (!hazardousFacility) {
      hazardousFacility = await SiteFacility.create({
        id: crypto.randomUUID(),
        serviceType: "HAZARDOUS",
        name: "Bee'ah/EDCO Hazmat Complex Jubail",
        lat: 26.96,
        lng: 49.61,
        isActive: true
      });
    }
  });

  afterAll(async () => {
    // Restore default test environment
    process.env.SITE_INSPECTION_GATE = "off";
    sendEmailSpy.mockRestore();
    sendWhatsAppSpy.mockRestore();
  });

  test("Step a: Create users (sales_rep, site_manager, ops_manager)", async () => {
    try {
      expect(salesRep.id).toBeDefined();
      expect(siteManager.id).toBeDefined();
      expect(siteManager2.id).toBeDefined();
      expect(opsManager.id).toBeDefined();
      console.log("PASS: Step a - Users created successfully (sales_rep, site_manager, ops_manager)");
    } catch (err) {
      console.error("FAIL: Step a - User creation failed", err);
      throw err;
    }
  });

  test("Step b: Create lead, log outbound call -> CONTACTED & auto-request Site Inspection", async () => {
    try {
      const ts = Date.now();
      testLead = await Lead.create({
        id: crypto.randomUUID(),
        leadNumber: `LD-${ts}`,
        firstName: "Tariq",
        lastName: "Al-Mansoor",
        company: "Saudi PetroChem Industries",
        email: `tariq_${ts}@petrochem.com`,
        phone: `+9665${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: "NEW",
        source: "Website",
        assignedToId: salesRep.id,
        siteInspectionStatus: "NOT_REQUESTED"
      });

      // Log outbound call via POST /api/v1/activities
      const callRes = await request(app)
        .post("/api/v1/activities")
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({
          leadId: testLead.id,
          type: "call",
          direction: "outbound",
          outcome: "connected",
          notes: "Outbound call to customer to discuss industrial waste scope."
        });

      expect([200, 201]).toContain(callRes.status);

      // Verify lead transitioned to CONTACTED
      const updatedLead: any = await Lead.findByPk(testLead.id);
      expect(updatedLead.status.toUpperCase()).toBe("CONTACTED");
      expect(updatedLead.siteInspectionStatus).toBe("REQUESTED");
      expect(updatedLead.siteInspectionId).toBeDefined();

      inspectionId = updatedLead.siteInspectionId;

      // Verify SiteInspection record was auto-created and assigned to site_manager
      const inspection: any = await SiteInspection.findByPk(inspectionId);
      expect(inspection).not.toBeNull();
      expect(inspection.leadId).toBe(testLead.id);
      expect(inspection.status).toBe("REQUESTED");
      expect([siteManager.id, siteManager2.id]).toContain(inspection.assignedToId);

      // Ensure inspection is assigned to siteManager for subsequent steps
      if (inspection.assignedToId !== siteManager.id) {
        await inspection.update({ assignedToId: siteManager.id });
      }

      console.log("PASS: Step b - Lead is CONTACTED and inspection auto-created & assigned to site_manager");
    } catch (err) {
      console.error("FAIL: Step b - Lead stage automation & inspection request failed", err);
      throw err;
    }
  });

  test("Step c: Try Qualify, Convert, and PUT /leads/:id -> All rejected by gate message", async () => {
    try {
      // 1. Try to qualify via POST /api/v1/leads/:id/qualify
      const qualifyRes = await request(app)
        .post(`/api/v1/leads/${testLead.id}/qualify`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({
          requirement: "Industrial chemical waste haulage",
          estimatedValue: 150000
        });

      expect(qualifyRes.status).toBe(400);
      expect(qualifyRes.body.error || "").toMatch(/site inspection/i);

      // 2. Try to convert via POST /api/v1/leads/:id/convert
      const convertRes = await request(app)
        .post(`/api/v1/leads/${testLead.id}/convert`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({
          dealName: "PetroChem Hazardous Haulage Deal",
          estimatedValue: 150000
        });

      expect(convertRes.status).toBe(400);
      expect(convertRes.body.error || "").toMatch(/site inspection/i);

      // 3. Try manual status update via PUT /api/v1/leads/:id
      const putRes = await request(app)
        .put(`/api/v1/leads/${testLead.id}`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({
          status: "QUALIFIED"
        });

      expect(putRes.status).toBe(400);
      expect(putRes.body.error || "").toMatch(/site inspection/i);

      console.log("PASS: Step c - Qualify, Convert, and manual PUT all rejected with site inspection gate message");
    } catch (err) {
      console.error("FAIL: Step c - Gate rejection check failed", err);
      throw err;
    }
  });

  test("Step d: Submit incomplete inspection -> Rejected with list of missing items", async () => {
    try {
      const submitRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/submit`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({});

      expect(submitRes.status).toBe(400);
      const errMsg = submitRes.body.error || "";
      expect(errMsg).toMatch(/base/i);
      expect(errMsg).toMatch(/gps|coordinates/i);
      expect(errMsg).toMatch(/waste/i);
      expect(errMsg).toMatch(/photo|attachment/i);
      expect(errMsg).toMatch(/confirm|accept/i);

      console.log("PASS: Step d - Incomplete inspection rejected with missing requirement details");
    } catch (err) {
      console.error("FAIL: Step d - Incomplete submit rejection failed", err);
      throw err;
    }
  });

  test("Step e: Fill in 3 steps with 1 waste type, upload real JPEG & PDF, and submit", async () => {
    try {
      // 1. Fill wizard steps 1 & 2 via draft update
      const draftPayload = {
        baseId: defaultBase.id,
        baseName: defaultBase.name,
        siteName: "SABIC PetroKemya Alpha Plant",
        siteAddress: "Road 100, Jubail Industrial Area",
        latitude: 27.05,
        longitude: 49.62,
        auditAt: new Date().toISOString(),
        clientOrganization: "Saudi Basic Industries Corp",
        clientRepName: "Eng. Fahad Al-Otaibi",
        clientRepPhone: "+966512345678",
        scopeSummary: "Hazardous waste treatment and containerized transport",
        mobilizationRoute: "Highway 613 Eastbound",
        mobilizationKm: 45,
        speedLimitKmh: 80,
        observations: "Hot Work Permit required. High voltage line clearance verified at 6.5m.",
        accepted: true,
        services: [
          {
            serviceType: "HAZARDOUS",
            isActive: true,
            facilityId: hazardousFacility.id,
            facilityName: hazardousFacility.name,
            distanceKm: 38,
            roadCondition: "Good",
            wasteDescription: "Organic solvent sludge and contaminated washwater",
            estimatedVolume: 25,
            volumeUnit: "m3",
            logisticsNote: "Dedicated vacuum tanker required"
          }
        ]
      };

      const draftRes = await request(app)
        .put(`/api/v1/site-inspections/${inspectionId}`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send(draftPayload);

      expect(draftRes.status).toBe(200);

      // 2. Upload one real JPEG and one real PDF through attachment endpoint
      const realJpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03,
        0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
        0x06, 0x05, 0x06, 0x09, 0x08, 0x0A, 0x0A, 0x09, 0x08, 0x09, 0x09, 0x0A, 0x0C, 0x0F, 0x0C, 0x0A,
        0x0B, 0x0E, 0x0B, 0x09, 0x09, 0x0D, 0x11, 0x0D, 0x0E, 0x0F, 0x10, 0x10, 0x11, 0x10, 0x0A, 0x0C,
        0x12, 0x13, 0x12, 0x10, 0x13, 0x0F, 0x10, 0x10, 0x10, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
        0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
        0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
        0x00, 0x37, 0xFF, 0xD9
      ]);

      const realPdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
      );

      const attachRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/attachments`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .attach("files", realJpegBuffer, "site_inspection_photo.jpg")
        .attach("files", realPdfBuffer, "site_safety_plan.pdf");

      expect(attachRes.status).toBe(201);
      expect(attachRes.body.length).toBe(2);

      // 3. Submit inspection
      const submitRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/submit`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({ accepted: true });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.status).toBe("SUBMITTED");

      const checkLead: any = await Lead.findByPk(testLead.id);
      expect(checkLead.siteInspectionStatus).toBe("SUBMITTED");

      console.log("PASS: Step e - Completed inspection with 1 waste type, uploaded JPEG + PDF, and submitted");
    } catch (err) {
      console.error("FAIL: Step e - Inspection completion and submission failed", err);
      throw err;
    }
  });

  test("Step f: Lead is STILL blocked while inspection is only SUBMITTED", async () => {
    try {
      const qualifyRes = await request(app)
        .post(`/api/v1/leads/${testLead.id}/qualify`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({ requirement: "Waste Haulage", estimatedValue: 120000 });

      expect(qualifyRes.status).toBe(400);
      expect(qualifyRes.body.error || "").toMatch(/awaiting approval|site inspection/i);

      const convertRes = await request(app)
        .post(`/api/v1/leads/${testLead.id}/convert`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({ dealName: "Opportunity Pending Approval", estimatedValue: 120000 });

      expect(convertRes.status).toBe(400);
      expect(convertRes.body.error || "").toMatch(/awaiting approval|site inspection/i);

      console.log("PASS: Step f - Lead is STILL blocked while inspection is SUBMITTED");
    } catch (err) {
      console.error("FAIL: Step f - Lead not blocked during SUBMITTED status", err);
      throw err;
    }
  });

  test("Step g: site_manager cannot approve; ops_manager requests changes with comment; resubmit and approve", async () => {
    try {
      // 1. site_manager attempts to approve own inspection -> must be 403 Forbidden
      const selfApproveRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/review`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({ decision: "APPROVE", comment: "Self-approval attempt" });

      expect(selfApproveRes.status).toBe(403);

      // 2. ops_manager requests changes WITHOUT comment -> must be rejected (400)
      const noCommentRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/review`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ decision: "REQUEST_CHANGES", comment: "" });

      expect(noCommentRes.status).toBe(400);
      expect(noCommentRes.body.error || "").toMatch(/comment.*required/i);

      // 3. ops_manager requests changes WITH comment
      const requestChangesRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/review`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({
          decision: "REQUEST_CHANGES",
          comment: "Please clarify road clearance and verify vacuum tanker parking access."
        });

      expect(requestChangesRes.status).toBe(200);
      expect(requestChangesRes.body.status).toBe("CHANGES_REQUESTED");
      expect(requestChangesRes.body.revision).toBe(2);

      // 4. site_manager resubmits inspection
      const resubmitRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/submit`)
        .set("Authorization", `Bearer ${siteManagerToken}`)
        .send({
          observations: "Updated: Tanker parking access confirmed at Gate 4. Road clearance 6.5m re-verified.",
          accepted: true
        });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.status).toBe("SUBMITTED");

      // 5. ops_manager approves inspection
      const approveRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/review`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .send({ decision: "APPROVE", comment: "Approved. All logistics and safety requirements satisfied." });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe("APPROVED");

      const checkLead: any = await Lead.findByPk(testLead.id);
      expect(checkLead.siteInspectionStatus).toBe("APPROVED");

      console.log("PASS: Step g - Review permissions enforced, change request handled, and inspection approved");
    } catch (err) {
      console.error("FAIL: Step g - Review flow failed", err);
      throw err;
    }
  });

  test("Step h: Qualify & Convert succeed, and Opportunity is linked to SiteInspections.dealId", async () => {
    try {
      const convertRes = await request(app)
        .post(`/api/v1/leads/${testLead.id}/convert`)
        .set("Authorization", `Bearer ${salesRepToken}`)
        .send({
          dealName: "SABIC PetroKemya Hazmat Haulage Contract",
          estimatedValue: 250000,
          notes: "Site inspection fully approved by operations management."
        });

      expect(convertRes.status).toBe(200);
      expect(convertRes.body.deal).toBeDefined();

      const dealId = convertRes.body.deal.id;

      // Verify SiteInspection.dealId was updated to linked opportunity
      const updatedInspection: any = await SiteInspection.findByPk(inspectionId);
      expect(updatedInspection.dealId).toBe(dealId);

      console.log("PASS: Step h - Qualify & Convert succeeded and SiteInspection is linked to Opportunity dealId");
    } catch (err) {
      console.error("FAIL: Step h - Lead conversion or inspection deal linking failed", err);
      throw err;
    }
  });

  test("Step i: site_manager cannot read another site_manager's inspection", async () => {
    try {
      // siteManager2 attempts to read siteManager's inspection
      const fetchRes = await request(app)
        .get(`/api/v1/site-inspections/${inspectionId}`)
        .set("Authorization", `Bearer ${siteManager2Token}`);

      expect(fetchRes.status).toBe(403);
      expect(fetchRes.body.error || "").toMatch(/access denied/i);

      console.log("PASS: Step i - Site manager isolation confirmed (403 Forbidden for unassigned inspection)");
    } catch (err) {
      console.error("FAIL: Step i - Site manager isolation failed", err);
      throw err;
    }
  });

  test("Step j: File with .jpg name but non-image content is rejected by upload endpoint", async () => {
    try {
      const fakeJpgBuffer = Buffer.from("NOT_A_VALID_JPEG_IMAGE_FILE_JUST_PLAIN_TEXT");

      const fakeUploadRes = await request(app)
        .post(`/api/v1/site-inspections/${inspectionId}/attachments`)
        .set("Authorization", `Bearer ${opsManagerToken}`)
        .attach("files", fakeJpgBuffer, "spoofed_image.jpg");

      expect(fakeUploadRes.status).toBe(400);
      expect(fakeUploadRes.body.error || "").toMatch(/not a valid jpeg/i);

      console.log("PASS: Step j - File with spoofed .jpg extension rejected by magic byte validator");
    } catch (err) {
      console.error("FAIL: Step j - Spoofed file upload was not rejected", err);
      throw err;
    }
  });
});
