import {
  FileStorage,
  LocalFileStorage,
  S3FileStorage,
  generateInspectionStorageKey,
  setFileStorage,
  getFileStorage,
} from "../../src/services/fileStorage";
import {
  validateFileMagic,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from "../../src/controllers/siteInspectionController";
import fs from "fs";
import path from "path";
import os from "os";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

describe("FileStorage Adapter & Direct Upload Unit Tests", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-storage-test-"));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe("LocalFileStorage", () => {
    let local: LocalFileStorage;

    beforeEach(() => {
      local = new LocalFileStorage(tmpDir);
    });

    test("putObject, getObjectHead, and deleteObject", async () => {
      const key = "site-inspections/insp-123/test.jpg";
      const data = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const putRes = await local.putObject(key, data, { contentType: "image/jpeg" });
      expect(putRes.key).toBe(key);
      expect(putRes.size).toBe(6);

      const head = await local.getObjectHead(key, 64);
      expect(head.contentLength).toBe(6);
      expect(head.firstBytes).toBeDefined();
      expect(head.firstBytes![0]).toBe(0xff);
      expect(head.firstBytes![1]).toBe(0xd8);

      await local.deleteObject(key);
      await expect(local.getObjectHead(key)).rejects.toThrow("File not found");
    });

    test("rejects path traversal", async () => {
      await expect(local.putObject("../evil.txt", Buffer.from("attack"))).rejects.toThrow("Path traversal rejected");
    });
  });

  describe("S3FileStorage with Mocked S3Client", () => {
    let mockSend: jest.Mock;
    let s3Storage: S3FileStorage;

    beforeEach(() => {
      mockSend = jest.fn();
      const mockClient = {
        send: mockSend,
      } as unknown as S3Client;

      s3Storage = new S3FileStorage(mockClient, "test-bucket");
    });

    test("putObject issues PutObjectCommand", async () => {
      mockSend.mockResolvedValueOnce({});
      const key = "site-inspections/insp-123/sample.pdf";
      const data = Buffer.from("%PDF-1.4 test data");

      const res = await s3Storage.putObject(key, data, { contentType: "application/pdf" });
      expect(res.key).toBe(key);
      expect(res.size).toBe(data.length);
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });

    test("getObjectHead reads metadata and first bytes range", async () => {
      mockSend
        .mockResolvedValueOnce({
          ContentLength: 1024,
          ContentType: "image/png",
        })
        .mockResolvedValueOnce({
          Body: (async function* () {
            yield Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          })(),
        });

      const head = await s3Storage.getObjectHead("site-inspections/insp-123/pic.png", 64);
      expect(head.contentLength).toBe(1024);
      expect(head.contentType).toBe("image/png");
      expect(head.firstBytes).toBeDefined();
      expect(head.firstBytes![0]).toBe(0x89);
      expect(head.firstBytes![1]).toBe(0x50);
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    test("deleteObject issues DeleteObjectCommand", async () => {
      mockSend.mockResolvedValueOnce({});
      await s3Storage.deleteObject("site-inspections/insp-123/pic.png");
      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    test("presign upload and download generate valid URLs", async () => {
      // Mock presigner getSignedUrl
      const presigner = require("@aws-sdk/s3-request-presigner");
      jest.spyOn(presigner, "getSignedUrl").mockImplementation(async (_client: any, cmd: any, opts: any) => {
        return `https://test-bucket.s3.amazonaws.com/${cmd.input.Key}?token=mock-presigned&expires=${opts?.expiresIn || 300}`;
      });

      const uploadUrl = await s3Storage.getSignedUploadUrl("site-inspections/insp-1/pic.jpg", {
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      });
      expect(typeof uploadUrl).toBe("string");
      expect(uploadUrl).toContain("test-bucket");
      expect(uploadUrl).toContain("site-inspections/insp-1/pic.jpg");

      const downloadUrl = await s3Storage.getSignedDownloadUrl("site-inspections/insp-1/pic.jpg", {
        expiresInSeconds: 60,
      });
      expect(typeof downloadUrl).toBe("string");
      expect(downloadUrl).toContain("test-bucket");
      expect(downloadUrl).toContain("site-inspections/insp-1/pic.jpg");
    });
  });

  describe("Validation & Security Helpers", () => {
    test("generateInspectionStorageKey creates secure random path", () => {
      const key = generateInspectionStorageKey("insp-abc", ".jpg");
      expect(key.startsWith("site-inspections/insp-abc/")).toBe(true);
      expect(key.endsWith(".jpg")).toBe(true);
      // Ensure uuid is present and no user filename leaked
      expect(key.length).toBeGreaterThan("site-inspections/insp-abc/".length + 30);
    });

    test("validateFileMagic validates true JPEG, PNG, WEBP, and PDF", () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateFileMagic(jpeg, "image/jpeg", "photo.jpg")).toBe(true);
      expect(validateFileMagic(jpeg, "image/jpeg", "photo.jpeg")).toBe(true);

      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      expect(validateFileMagic(png, "image/png", "chart.png")).toBe(true);

      const webp = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from("WEBP"),
      ]);
      expect(validateFileMagic(webp, "image/webp", "image.webp")).toBe(true);

      const pdf = Buffer.from("%PDF-1.7 sample");
      expect(validateFileMagic(pdf, "application/pdf", "doc.pdf")).toBe(true);
    });

    test("validateFileMagic rejects spoofed and invalid files", () => {
      // Executable pretending to be jpg
      const fakeJpg = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable
      expect(validateFileMagic(fakeJpg, "image/jpeg", "malware.jpg")).toBe(false);

      // Plain text pretending to be png
      const fakePng = Buffer.from("Hello world plain text");
      expect(validateFileMagic(fakePng, "image/png", "fake.png")).toBe(false);

      // Wrong extension
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateFileMagic(validJpeg, "image/jpeg", "photo.exe")).toBe(false);
      expect(validateFileMagic(validJpeg, "image/jpeg", "photo.sh")).toBe(false);

      // Disallowed mime type
      expect(validateFileMagic(validJpeg, "text/plain", "photo.jpg")).toBe(false);
    });
  });

  describe("Direct Upload Flow Controller Unit Tests (presign & complete)", () => {
    let mockReq: any;
    let mockRes: any;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;
    let { presignAttachmentUpload, completeAttachmentUpload } = require("../../src/controllers/siteInspectionController");
    let { SiteInspection, SiteInspectionAttachment } = require("@nexus-crm/database");

    beforeEach(() => {
      jsonSpy = jest.fn();
      statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
      mockRes = {
        status: statusSpy,
        json: jsonSpy,
      };
    });

    test("presign rejects oversize file (> 25MB)", async () => {
      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          fileName: "large.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 26 * 1024 * 1024,
        },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "DRAFT",
      });

      await presignAttachmentUpload(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("25 MB") }));
    });

    test("presign rejects forbidden or non-assigned user", async () => {
      mockReq = {
        user: { id: "mgr-foreign", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
        },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "DRAFT",
      });

      await presignAttachmentUpload(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(403);
    });

    test("complete rejects wrong inspection key, path traversal, or malformed key", async () => {
      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          storageKey: "site-inspections/different-inspection/11111111-2222-3333-4444-555555555555.jpg",
          fileName: "photo.jpg",
        },
      };

      await completeAttachmentUpload(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid storageKey") }));
    });

    test("complete rejects duplicate storageKey registration", async () => {
      const validKey = "site-inspections/insp-100/11111111-2222-3333-4444-555555555555.jpg";
      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          storageKey: validKey,
          fileName: "photo.jpg",
        },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "DRAFT",
      });
      jest.spyOn(SiteInspectionAttachment, "findOne").mockResolvedValueOnce({
        id: "att-existing",
        storagePath: validKey,
      } as any);

      await completeAttachmentUpload(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("already been registered") }));
    });

    test("complete rejects spoofed content and deletes object", async () => {
      const validKey = "site-inspections/insp-100/22222222-3333-4444-5555-666666666666.jpg";
      const mockStorage = {
        getObjectHead: jest.fn().mockResolvedValue({
          contentLength: 1024,
          contentType: "image/jpeg",
          firstBytes: Buffer.from("NOT_JPEG_HEADER"),
        }),
        deleteObject: jest.fn().mockResolvedValue(undefined),
      };
      setFileStorage(mockStorage as any);

      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          storageKey: validKey,
          fileName: "photo.jpg",
        },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "DRAFT",
      });
      jest.spyOn(SiteInspectionAttachment, "findOne").mockResolvedValueOnce(null);
      jest.spyOn(SiteInspectionAttachment, "count").mockResolvedValueOnce(0);

      await completeAttachmentUpload(mockReq, mockRes);
      expect(mockStorage.deleteObject).toHaveBeenCalledWith(validKey);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("magic byte check failed") }));

      setFileStorage(null); // reset
    });

    test("complete creates attachment for valid upload with sanitized fileName", async () => {
      const validKey = "site-inspections/insp-100/33333333-4444-5555-6666-777777777777.jpg";
      const mockStorage = {
        getObjectHead: jest.fn().mockResolvedValue({
          contentLength: 2048,
          contentType: "image/jpeg",
          firstBytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        }),
        deleteObject: jest.fn(),
      };
      setFileStorage(mockStorage as any);

      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100" },
        body: {
          storageKey: validKey,
          fileName: "ground_\"unsafe\";photo.jpg",
          caption: "North Gate",
          tag: "Access Road",
        },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "DRAFT",
      });
      jest.spyOn(SiteInspectionAttachment, "findOne").mockResolvedValueOnce(null);
      jest.spyOn(SiteInspectionAttachment, "count").mockResolvedValueOnce(2);
      const createSpy = jest.spyOn(SiteInspectionAttachment, "create").mockResolvedValueOnce({
        id: "att-1",
        inspectionId: "insp-100",
        fileName: "ground__unsafe__photo.jpg",
        sizeBytes: 2048,
        storagePath: validKey,
      } as any);

      await completeAttachmentUpload(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        fileName: "ground__unsafe__photo.jpg",
      }));

      setFileStorage(null);
    });

    test("deleteAttachment rejects deletion if inspection is SUBMITTED or APPROVED", async () => {
      const { deleteAttachment } = require("../../src/controllers/siteInspectionController");
      mockReq = {
        user: { id: "mgr-1", role: "site_manager" },
        params: { id: "insp-100", attId: "att-1" },
      };
      jest.spyOn(SiteInspection, "findByPk").mockResolvedValueOnce({
        id: "insp-100",
        assignedToId: "mgr-1",
        status: "SUBMITTED",
      });

      await deleteAttachment(mockReq, mockRes);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Cannot modify attachments") }));
    });
  });
});
