import {
  sequelize,
  Lead,
  User,
  SiteBase,
  SiteFacility,
  SiteInspection,
  SiteInspectionService,
  SiteInspectionAttachment,
} from "@nexus-crm/database";
import crypto from "crypto";
import {
  haversineKm,
  computeMetrics,
  getSiteInspectionGate,
  requestSiteInspection,
  saveInspectionDraft,
  validateForSubmit,
  submitInspection,
  reviewInspection,
} from "../../src/services/siteInspectionService";

describe("Site Inspection Gate & Workflows", () => {
  let siteManagerUser: any;
  let approverUser: any;
  let testBase: any;
  let testFacility: any;
  let lead: any;

  beforeAll(async () => {
    siteManagerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Ahmed Site Manager",
      email: "sitemgr_" + Date.now() + "@nexus.com",
      password: "pass",
      role: "site_manager",
      isAvailable: true,
      status: "Available",
    });

    approverUser = await User.create({
      id: crypto.randomUUID(),
      name: "Khalid Ops Manager",
      email: "opsmgr_" + Date.now() + "@nexus.com",
      password: "pass",
      role: "ops_manager",
      isAvailable: true,
    });

    testBase = await SiteBase.create({
      id: crypto.randomUUID(),
      code: "BASE_" + Date.now(),
      name: "Jubail Testing Base",
      region: "Eastern",
      latitude: 27.0,
      longitude: 49.65,
      isActive: true,
    });

    testFacility = await SiteFacility.create({
      id: crypto.randomUUID(),
      serviceType: "SEWAGE",
      name: "Jubail STP Test",
      lat: 27.05,
      lng: 49.6,
      isActive: true,
    });
  });

  beforeEach(async () => {
    try {
      lead = await Lead.create({
      id: crypto.randomUUID(),
      firstName: "Fahad",
      lastName: "Al-Otaibi",
      company: "Saudi Aramco Contractor",
      email: "fahad_" + Date.now() + "@contractor.com",
      phone: "+9665" + Math.floor(10000000 + Math.random() * 90000000),
      status: "Contacted",
      leadNumber: "LD-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      siteInspectionStatus: "NOT_REQUESTED",
      });
    } catch (err: any) {
      console.error("LEAD_CREATE_ERROR:", err.message, err.parent?.message, err.name);
      throw err;
    }
  });

  describe("Calculations: haversineKm & computeMetrics", () => {
    it("computes accurate straight-line distance rounded to 0.1km", () => {
      const dist = haversineKm(27.0, 49.65, 27.1, 49.75);
      expect(dist).toBeGreaterThan(10);
      expect(dist).toBeLessThan(20);
      expect(Number.isInteger(Math.round(dist * 10))).toBe(true);
    });

    it("computes cycle km and fuel estimate using env/default factor", () => {
      const metrics = computeMetrics(50, [
        { isActive: true, distanceKm: 30 },
        { isActive: false, distanceKm: 100 },
      ]);
      expect(metrics.totalCycleKm).toBe(160);
      expect(metrics.estFuelLitres).toBe(64);
    });
  });

  describe("Gate Status Enforcement", () => {
    beforeEach(() => {
      process.env.SITE_INSPECTION_GATE = "on";
    });

    afterAll(() => {
      process.env.SITE_INSPECTION_GATE = "off";
    });

    it("blocks qualification when NOT_REQUESTED", async () => {
      await lead.update({ siteInspectionStatus: "NOT_REQUESTED" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("NOT_REQUESTED");
      expect(gate.message).toContain("must be requested and approved");
    });

    it("blocks qualification when REQUESTED", async () => {
      await lead.update({ siteInspectionStatus: "REQUESTED" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("REQUESTED");
      expect(gate.message).toContain("awaiting completion");
    });

    it("blocks qualification when DRAFT", async () => {
      await lead.update({ siteInspectionStatus: "DRAFT" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("DRAFT");
      expect(gate.message).toContain("Draft");
    });

    it("blocks qualification when SUBMITTED", async () => {
      await lead.update({ siteInspectionStatus: "SUBMITTED" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("SUBMITTED");
      expect(gate.message).toContain("awaiting approval");
    });

    it("blocks qualification when CHANGES_REQUESTED", async () => {
      await lead.update({ siteInspectionStatus: "CHANGES_REQUESTED" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("CHANGES_REQUESTED");
    });

    it("allows qualification when APPROVED", async () => {
      await lead.update({ siteInspectionStatus: "APPROVED" });
      const gate = await getSiteInspectionGate(lead.id);
      expect(gate.allowed).toBe(true);
      expect(gate.status).toBe("APPROVED");
    });
  });

  describe("Site Inspection Workflow & Validation", () => {
    it("requests site inspection and pre-creates inactive services and auto-assigns", async () => {
      const inspection = await requestSiteInspection(lead.id, approverUser.id, "High priority audit");
      expect(inspection.status).toBe("REQUESTED");
      expect(inspection.assignedToId).toBe(siteManagerUser.id);
      expect(inspection.services.length).toBe(3);
      expect(inspection.services.every((s: any) => s.isActive === false)).toBe(true);

      const refreshedLead: any = await Lead.findByPk(lead.id);
      expect(refreshedLead.siteInspectionStatus).toBe("REQUESTED");
      expect(refreshedLead.siteInspectionId).toBe(inspection.id);
    });

    it("validates submit requirements strictly", async () => {
      const inspection: any = await requestSiteInspection(lead.id);

      const validation1 = await validateForSubmit(inspection.id);
      expect(validation1.valid).toBe(false);
      expect(validation1.errors.length).toBeGreaterThan(0);

      await saveInspectionDraft(inspection.id, {
        baseId: testBase.id,
        siteName: "Ras Tanura Terminal",
        latitude: 26.65,
        longitude: 50.15,
        auditAt: new Date(),
        clientOrganization: "Saudi Aramco Contractor",
        clientRepName: "Fahad Al-Otaibi",
        mobilizationKm: 45,
        services: [
          {
            serviceType: "SEWAGE",
            isActive: true,
            facilityId: testFacility.id,
            distanceKm: 25,
            roadCondition: "Good",
          },
        ],
        accepted: true,
      });

      const validation2 = await validateForSubmit(inspection.id);
      expect(validation2.valid).toBe(false);
      expect(validation2.errors.some((e: string) => e.includes("attachment"))).toBe(true);

      await SiteInspectionAttachment.create({
        id: crypto.randomUUID(),
        inspectionId: inspection.id,
        fileName: "site_photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        storagePath: "site-inspections/test/photo.jpg",
      });

      const validation3 = await validateForSubmit(inspection.id);
      expect(validation3.valid).toBe(true);
      expect(validation3.errors.length).toBe(0);
    });

    it("submits inspection and forbids self-approval", async () => {
      const inspection: any = await requestSiteInspection(lead.id);

      await saveInspectionDraft(inspection.id, {
        baseId: testBase.id,
        latitude: 26.65,
        longitude: 50.15,
        auditAt: new Date(),
        clientOrganization: "Saudi Aramco Contractor",
        clientRepName: "Fahad Al-Otaibi",
        mobilizationKm: 45,
        services: [
          {
            serviceType: "SEWAGE",
            isActive: true,
            facilityId: testFacility.id,
            distanceKm: 25,
            roadCondition: "Good",
          },
        ],
        accepted: true,
      });

      await SiteInspectionAttachment.create({
        id: crypto.randomUUID(),
        inspectionId: inspection.id,
        fileName: "site_photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        storagePath: "site-inspections/test/photo.jpg",
      });

      await submitInspection(inspection.id);
      const submitted: any = await SiteInspection.findByPk(inspection.id);
      expect(submitted.status).toBe("SUBMITTED");

      await expect(
        reviewInspection(inspection.id, "APPROVE", siteManagerUser.id, "ops_manager")
      ).rejects.toThrow("Nobody may approve their own site inspection");

      const approved: any = await reviewInspection(
        inspection.id,
        "APPROVE",
        approverUser.id,
        "ops_manager",
        "Looks good"
      );
      expect(approved.status).toBe("APPROVED");

      const refreshedLead: any = await Lead.findByPk(lead.id);
      expect(refreshedLead.siteInspectionStatus).toBe("APPROVED");
    });
  });
});
