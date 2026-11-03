import request from "supertest";
import { createServer } from "../../server";
import { sequelize, User, Lead, SiteInspection, SiteBase, SiteFacility } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import { S3FileStorage, setFileStorage } from "../../src/services/fileStorage";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { S3Client } from "@aws-sdk/client-s3";

const app = createServer();

describe("Site Inspection Direct Upload Flow E2E with Mocked S3 Driver", () => {
  let siteManager: any;
  let opsManager: any;
  let siteManagerToken: string;
  let opsManagerToken: string;
  let testLead: any;
  let inspectionId: string;
  let s3Objects: Map<string, { buffer: Buffer; contentType: string }> = new Map();

  const jwtSecret = process.env.JWT_SECRET || "default_secret";

  beforeAll(async () => {
    process.env.STORAGE_DRIVER = "s3";
    process.env.S3_BUCKET = "mock-s3-test-bucket";

    jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mock-email-id" } as any);
    jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({ success: true, messageId: "SM123" } as any);

    if (!sequelize.models.User) {
      await sequelize.sync();
    }

    const ts = Date.now();

    siteManager = await User.create({
      id: crypto.randomUUID(),
      name: `S3 Test Site Manager ${ts}`,
      email: `s3_site_mgr_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "site_manager",
      isAvailable: true,
      status: "Active",
    });

    opsManager = await User.create({
      id: crypto.randomUUID(),
      name: `S3 Test Ops Manager ${ts}`,
      email: `s3_ops_mgr_${ts}@nexus.com`,
      password: "hashedpassword123",
      role: "ops_manager",
      isAvailable: true,
      status: "Active",
    });

    siteManagerToken = jwt.sign({ id: siteManager.id, email: siteManager.email, role: siteManager.role }, jwtSecret);
    opsManagerToken = jwt.sign({ id: opsManager.id, email: opsManager.email, role: opsManager.role }, jwtSecret);

    // Mock S3 client commands
    const mockSend = jest.fn().mockImplementation(async (command: any) => {
      const cmdName = command.constructor.name;

      if (cmdName === "PutObjectCommand") {
        s3Objects.set(command.input.Key, {
          buffer: Buffer.from(command.input.Body),
          contentType: command.input.ContentType || "application/octet-stream",
        });
        return {};
      }

      if (cmdName === "HeadObjectCommand") {
        const obj = s3Objects.get(command.input.Key);
        if (!obj) {
          const err: any = new Error("NotFound");
          err.name = "NotFound";
          throw err;
        }
        return {
          ContentLength: obj.buffer.length,
          ContentType: obj.contentType,
        };
      }

      if (cmdName === "GetObjectCommand") {
        const obj = s3Objects.get(command.input.Key);
        if (!obj) {
          const err: any = new Error("NotFound");
          err.name = "NotFound";
          throw err;
        }

        // Return async iterable stream
        return {
          Body: (async function* () {
            yield obj.buffer;
          })(),
        };
      }

      if (cmdName === "DeleteObjectCommand") {
        s3Objects.delete(command.input.Key);
        return {};
      }

      return {};
    });

    const mockS3Client = { send: mockSend } as unknown as S3Client;
    const mockedStorage = new S3FileStorage(mockS3Client, "mock-s3-test-bucket");
    setFileStorage(mockedStorage);

    // Mock presigner
    const presigner = require("@aws-sdk/s3-request-presigner");
    jest.spyOn(presigner, "getSignedUrl").mockImplementation(async (_client: any, cmd: any) => {
      return `https://mock-s3-test-bucket.s3.amazonaws.com/${cmd.input.Key}?mock-presigned=true`;
    });

    // Create lead and inspection
    testLead = await Lead.create({
      id: crypto.randomUUID(),
      firstName: "Direct",
      lastName: "Upload Client",
      email: `direct_upload_${ts}@example.com`,
      phone: "+966500009999",
      company: "Saudi Aramco Direct Upload Project",
      status: "CONTACTED",
      siteInspectionStatus: "REQUESTED",
    });

    const inspection = await SiteInspection.create({
      id: crypto.randomUUID(),
      inspectionNumber: `SI-S3-${ts.toString().slice(-6)}`,
      leadId: testLead.id,
      status: "DRAFT",
      assignedToId: siteManager.id,
      siteName: "Aramco Tanajib Rig 12",
      clientOrganization: "Saudi Aramco",
      revision: 1,
    });
    inspectionId = inspection.id;
  });

  afterAll(async () => {
    setFileStorage(null);
    delete process.env.STORAGE_DRIVER;
    delete process.env.S3_BUCKET;
  });

  test("1. Presign attachment request produces signed URL and inspection storageKey", async () => {
    const res = await request(app)
      .post(`/api/v1/site-inspections/${inspectionId}/attachments/presign`)
      .set("Authorization", `Bearer ${siteManagerToken}`)
      .send({
        fileName: "rig_ground_view.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024 * 1024,
      });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toContain("mock-s3-test-bucket");
    expect(res.body.storageKey).toMatch(new RegExp(`^site-inspections/${inspectionId}/.+\\.jpg$`));
    expect(res.body.expiresIn).toBe(300);
  });

  test("2. Complete attachment creates record after validating magic bytes from mocked S3", async () => {
    // 1. Presign
    const presignRes = await request(app)
      .post(`/api/v1/site-inspections/${inspectionId}/attachments/presign`)
      .set("Authorization", `Bearer ${siteManagerToken}`)
      .send({
        fileName: "equipment_area.png",
        mimeType: "image/png",
        sizeBytes: 512,
      });

    expect(presignRes.status).toBe(200);
    const storageKey = presignRes.body.storageKey;

    // Simulate browser direct upload to S3
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    s3Objects.set(storageKey, { buffer: pngBuffer, contentType: "image/png" });

    // 2. Complete
    const completeRes = await request(app)
      .post(`/api/v1/site-inspections/${inspectionId}/attachments/complete`)
      .set("Authorization", `Bearer ${siteManagerToken}`)
      .send({
        storageKey,
        fileName: "equipment_area.png",
        caption: "Main generator clearance",
        tag: "Safety & Hazard Clearances",
      });

    expect(completeRes.status).toBe(201);
    expect(completeRes.body.storagePath).toBe(storageKey);
    expect(completeRes.body.fileName).toBe("equipment_area.png");
    expect(completeRes.body.tag).toBe("Safety & Hazard Clearances");

    // 3. Download route redirects to short-lived signed URL
    const getFileRes = await request(app)
      .get(`/api/v1/site-inspections/${inspectionId}/attachments/${completeRes.body.id}/file`)
      .set("Authorization", `Bearer ${siteManagerToken}`);

    expect(getFileRes.status).toBe(302);
    expect(getFileRes.header.location).toContain("mock-s3-test-bucket");

    // 4. Delete removes from S3 and database
    const deleteRes = await request(app)
      .delete(`/api/v1/site-inspections/${inspectionId}/attachments/${completeRes.body.id}`)
      .set("Authorization", `Bearer ${siteManagerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(s3Objects.has(storageKey)).toBe(false);
  });
});
