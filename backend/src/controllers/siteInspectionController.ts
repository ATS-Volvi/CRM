import { Request, Response } from "express";
import {
  sequelize,
  SiteBase,
  SiteFacility,
  SiteInspection,
  SiteInspectionService,
  SiteInspectionAttachment,
  Lead,
  User,
} from "@nexus-crm/database";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import {
  APPROVER_ROLES,
  getSiteInspectionGate,
  requestSiteInspection,
  saveInspectionDraft,
  validateForSubmit,
  submitInspection,
  reviewInspection,
  reassignInspection,
} from "../services/siteInspectionService";
import {
  getFileStorage,
  getUploadRoot,
  generateInspectionStorageKey,
  LocalFileStorage,
} from "../services/fileStorage";

// Multer memory storage configured for max 25MB files
export const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10,
  },
});

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export function validateFileMagic(buffer: Buffer, mimeType: string, originalName: string): boolean {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false;

  if (buffer.length < 4) return false;

  // Check magic bytes
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === "image/webp") {
    // RIFF....WEBP
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  if (mimeType === "application/pdf") {
    return buffer.toString("ascii", 0, 4) === "%PDF";
  }

  return true;
}

const UPLOAD_ROOT = getUploadRoot();


export const getMasterData = async (req: Request, res: Response) => {
  try {
    const bases = await SiteBase.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });
    const facilities = await SiteFacility.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });

    res.json({
      bases,
      facilities,
      roadConditions: ["Good", "Fair", "Poor"],
      volumeUnits: ["L", "m3", "ton", "loads"],
      serviceTypes: ["SEWAGE", "GENERAL", "HAZARDOUS"],
      storageDriver: (process.env.STORAGE_DRIVER || "local").toLowerCase(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSiteManagers = async (req: Request, res: Response) => {
  try {
    const siteManagers = await User.findAll({
      where: { role: "site_manager" },
      attributes: ["id", "name", "email", "role", "status", "phone"],
      order: [["name", "ASC"]],
    });
    res.json(siteManagers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSiteBase = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!APPROVER_ROLES.includes(user?.role)) {
      return res.status(403).json({ error: "Only managers may add site bases." });
    }
    const base = await SiteBase.create({
      ...req.body,
      id: crypto.randomUUID(),
    });
    res.status(201).json(base);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateSiteBase = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!APPROVER_ROLES.includes(user?.role)) {
      return res.status(403).json({ error: "Only managers may update site bases." });
    }
    const base = await SiteBase.findByPk(req.params.id as string);
    if (!base) return res.status(404).json({ error: "Site base not found" });
    await base.update(req.body);
    res.json(base);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const createSiteFacility = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!APPROVER_ROLES.includes(user?.role)) {
      return res.status(403).json({ error: "Only managers may add site facilities." });
    }
    const facility = await SiteFacility.create({
      ...req.body,
      id: crypto.randomUUID(),
    });
    res.status(201).json(facility);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateSiteFacility = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!APPROVER_ROLES.includes(user?.role)) {
      return res.status(403).json({ error: "Only managers may update site facilities." });
    }
    const facility = await SiteFacility.findByPk(req.params.id as string);
    if (!facility) return res.status(404).json({ error: "Site facility not found" });
    await facility.update(req.body);
    res.json(facility);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listSiteInspections = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, q, mine } = req.query;

    const where: any = {};

    // Site Managers see only their own inspections (or unassigned if not strictly filtering for mine)
    if (user?.role === "site_manager") {
      if (mine === "true") {
        where.assignedToId = user?.id;
      } else {
        where[Op.or] = [
          { assignedToId: user?.id },
          { assignedToId: null }
        ];
      }
    } else if (mine === "true") {
      where.assignedToId = user?.id;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q) {
      const queryStr = `%${String(q).trim()}%`;
      where[Op.or] = [
        { inspectionNumber: { [Op.like]: queryStr } },
        { clientOrganization: { [Op.like]: queryStr } },
        { siteName: { [Op.like]: queryStr } },
        { rfqNumber: { [Op.like]: queryStr } },
      ];
    }

    const inspections = await SiteInspection.findAll({
      where,
      include: [
        { model: Lead, as: "lead", attributes: ["id", "firstName", "lastName", "company", "leadNumber", "status"] },
        { model: User, as: "assignedTo", attributes: ["id", "name", "email", "role"] },
        { model: SiteBase, as: "base" },
        { model: SiteInspectionService, as: "services" },
        { model: SiteInspectionAttachment, as: "attachments", attributes: ["id", "fileName", "mimeType", "tag"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(inspections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSiteInspectionById = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const inspection: any = await SiteInspection.findByPk(req.params.id as string, {
      include: [
        { model: Lead, as: "lead" },
        { model: User, as: "assignedTo", attributes: ["id", "name", "email", "role"] },
        { model: User, as: "reviewedBy", attributes: ["id", "name", "email", "role"] },
        { model: SiteBase, as: "base" },
        {
          model: SiteInspectionService,
          as: "services",
          include: [{ model: SiteFacility, as: "facility" }],
        },
        {
          model: SiteInspectionAttachment,
          as: "attachments",
          include: [{ model: User, as: "uploadedBy", attributes: ["id", "name"] }],
        },
      ],
    });

    if (!inspection) return res.status(404).json({ error: "Site inspection not found" });

    // Isolation check for Site Manager: can only view inspections assigned to them or unassigned
    if (user?.role === "site_manager" && inspection.assignedToId && inspection.assignedToId !== user.id) {
      return res.status(403).json({ error: "Access denied: you may only view inspections assigned to you." });
    }

    res.json(inspection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveSiteInspectionDraft = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;

    const existing: any = await SiteInspection.findByPk(id);
    if (!existing) return res.status(404).json({ error: "Site inspection not found" });

    if (user?.role === "site_manager" && existing.assignedToId && existing.assignedToId !== user.id) {
      return res.status(403).json({ error: "Access denied: you may only edit inspections assigned to you." });
    }

    const updated = await saveInspectionDraft(id, req.body, user?.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const checkCompleteness = async (req: Request, res: Response) => {
  try {
    const result = await validateForSubmit(req.params.id as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const submitSiteInspection = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;

    const existing: any = await SiteInspection.findByPk(id);
    if (!existing) return res.status(404).json({ error: "Site inspection not found" });

    if (user?.role === "site_manager" && existing.assignedToId && existing.assignedToId !== user.id) {
      return res.status(403).json({ error: "Access denied: you may only submit inspections assigned to you." });
    }

    const inspection = await submitInspection(id, req.body, user?.id);
    res.json(inspection);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const reviewSiteInspection = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const action = req.body.action || req.body.decision;
    const comment = req.body.comment;

    if (!user || !APPROVER_ROLES.includes(user.role)) {
      return res.status(403).json({ error: "Only authorized managers or approvers may review inspections." });
    }

    const reviewed = await reviewInspection(id, action, user.id, user.role, comment);
    res.json(reviewed);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const reassignSiteInspection = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const { assignedToId } = req.body;

    if (!user || !APPROVER_ROLES.includes(user.role)) {
      return res.status(403).json({ error: "Only managers may reassign site inspections." });
    }

    const reassigned = await reassignInspection(id, assignedToId, user.role);
    res.json(reassigned);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Sanitize filename to prevent header injection or special character exploits
function sanitizeFileName(rawName: string): string {
  // Strip null bytes, control characters, quotes, semicolons, path separators
  const base = path.basename(rawName).replace(/[\r\n\0"';\\/]/g, "_").trim();
  return base || "attachment";
}

// Helper to verify user permissions and inspection editability for attachment modifications
async function checkAttachmentPermissionAndEditable(
  inspectionId: string,
  user: any
): Promise<{ inspection: any; errorStatus?: number; errorMessage?: string }> {
  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) {
    return { inspection: null, errorStatus: 404, errorMessage: "Site inspection not found" };
  }

  // Permission check: assigned site_manager (or unassigned) or admin
  const isAssigned = user?.role === "site_manager" && (!inspection.assignedToId || inspection.assignedToId === user.id);
  const isAdmin = user?.role === "admin";
  if (!isAssigned && !isAdmin) {
    return {
      inspection,
      errorStatus: 403,
      errorMessage: "Access denied: only the assigned site manager or an administrator may modify attachments.",
    };
  }

  // Inspection must be in an editable status
  const EDITABLE_STATUSES = ["REQUESTED", "DRAFT", "CHANGES_REQUESTED"];
  if (!EDITABLE_STATUSES.includes(inspection.status)) {
    return {
      inspection,
      errorStatus: 400,
      errorMessage: `Cannot modify attachments when inspection status is ${inspection.status}.`,
    };
  }

  return { inspection };
}

/**
 * POST /site-inspections/:id/attachments/presign
 * body: { fileName, mimeType, sizeBytes }
 */
export const presignAttachmentUpload = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const inspectionId = req.params.id as string;
    const { fileName, mimeType, sizeBytes } = req.body;

    if (!fileName || !mimeType || typeof sizeBytes !== "number") {
      return res.status(400).json({ error: "fileName, mimeType, and sizeBytes are required." });
    }

    const { errorStatus, errorMessage } = await checkAttachmentPermissionAndEditable(inspectionId, user);
    if (errorStatus) {
      return res.status(errorStatus).json({ error: errorMessage });
    }

    // Validate extension & mime
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: `Extension '${ext}' is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` });
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: `MIME type '${mimeType}' is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` });
    }

    // Validate size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
      return res.status(400).json({ error: "File size exceeds the 25 MB limit or is invalid." });
    }

    // Max 30 files per inspection
    const existingCount = await SiteInspectionAttachment.count({ where: { inspectionId } });
    if (existingCount >= 30) {
      return res.status(400).json({ error: "Maximum limit of 30 attachments per inspection exceeded." });
    }

    const storageKey = generateInspectionStorageKey(inspectionId, ext);
    const storage = getFileStorage();
    const expiresIn = 300; // 5 minutes

    const uploadUrl = await storage.getSignedUploadUrl(storageKey, {
      contentType: mimeType,
      expiresInSeconds: expiresIn,
    });

    res.json({
      uploadUrl,
      storageKey,
      expiresIn,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /site-inspections/:id/attachments/complete
 * body: { storageKey, fileName, caption, tag }
 */
export const completeAttachmentUpload = async (req: Request, res: Response) => {
  const inspectionId = req.params.id as string;
  const user = (req as any).user;
  const { storageKey, fileName, caption, tag } = req.body;
  const storage = getFileStorage();

  if (!storageKey || !fileName) {
    return res.status(400).json({ error: "storageKey and fileName are required." });
  }

  // 1. Confirm the key belongs to this inspection
  // Strict regex: site-inspections/<this inspectionId>/<uuid><ext>
  // Disallows backslashes, "..", or foreign inspection IDs
  if (storageKey.includes("..") || storageKey.includes("\\")) {
    return res.status(400).json({ error: "Invalid storageKey: path traversal or backslashes detected." });
  }

  const expectedPattern = new RegExp(`^site-inspections/${inspectionId}/[0-9a-fA-F-]+(\\.[a-zA-Z0-9]+)$`);
  if (!expectedPattern.test(storageKey)) {
    return res.status(400).json({ error: "Invalid storageKey: key does not belong to this inspection or format is invalid." });
  }

  const { errorStatus, errorMessage } = await checkAttachmentPermissionAndEditable(inspectionId, user);
  if (errorStatus) {
    return res.status(errorStatus).json({ error: errorMessage });
  }

  // Prevent duplicate registration of the same storageKey
  const duplicate = await SiteInspectionAttachment.findOne({ where: { storagePath: storageKey } });
  if (duplicate) {
    return res.status(400).json({ error: "Attachment with this storage key has already been registered." });
  }

  const existingCount = await SiteInspectionAttachment.count({ where: { inspectionId } });
  if (existingCount >= 30) {
    await storage.deleteObject(storageKey).catch(() => {});
    return res.status(400).json({ error: "Maximum limit of 30 attachments per inspection exceeded." });
  }

  // 2. Read first bytes and size from storage
  let head: any;
  try {
    head = await storage.getObjectHead(storageKey, 64);
  } catch (headErr: any) {
    return res.status(400).json({ error: `Failed to inspect uploaded file in storage: ${headErr.message}` });
  }

  const MAX_SIZE = 25 * 1024 * 1024;
  if (!head || head.contentLength <= 0 || head.contentLength > MAX_SIZE) {
    await storage.deleteObject(storageKey).catch(() => {});
    return res.status(400).json({ error: "Uploaded file is empty or exceeds the 25 MB limit." });
  }

  // Determine mime from extension and validate magic bytes
  const ext = path.extname(fileName).toLowerCase();
  let mimeType = head.contentType;
  if (!mimeType || mimeType === "application/octet-stream") {
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".pdf") mimeType = "application/pdf";
  }

  const firstBytes = head.firstBytes || Buffer.alloc(0);
  const isValid = validateFileMagic(firstBytes, mimeType, fileName);
  if (!isValid) {
    await storage.deleteObject(storageKey).catch(() => {});
    return res.status(400).json({ error: "Uploaded file content does not match declared type (magic byte check failed)." });
  }

  // 3. Extract EXIF GPS with exifr if image
  let latitude: number | null = null;
  let longitude: number | null = null;
  let takenAt: Date | null = null;

  if (mimeType.startsWith("image/")) {
    try {
      const exifr = require("exifr");
      let exifBuffer = firstBytes;
      if (storage instanceof LocalFileStorage) {
        const fullLocalPath = path.resolve(UPLOAD_ROOT, storageKey);
        if (fs.existsSync(fullLocalPath)) {
          exifBuffer = fs.readFileSync(fullLocalPath);
        }
      } else {
        try {
          const s3Head = await storage.getObjectHead(storageKey, 65536);
          if (s3Head.firstBytes) exifBuffer = s3Head.firstBytes;
        } catch {}
      }

      const exifData = await exifr.parse(exifBuffer, { gps: true, tiff: true });
      if (exifData) {
        if (typeof exifData.latitude === "number") latitude = exifData.latitude;
        if (typeof exifData.longitude === "number") longitude = exifData.longitude;
        if (exifData.DateTimeOriginal) takenAt = new Date(exifData.DateTimeOriginal);
      }
    } catch (exifErr) {
      // EXIF parsing is non-fatal
    }
  }

  const sanitized = sanitizeFileName(fileName);

  // 4. Create SiteInspectionAttachments row
  try {
    const att = await SiteInspectionAttachment.create({
      id: crypto.randomUUID(),
      inspectionId,
      fileName: sanitized,
      mimeType,
      sizeBytes: head.contentLength,
      storagePath: storageKey,
      caption: caption || null,
      tag: tag || "Site Overview",
      latitude,
      longitude,
      takenAt: takenAt || new Date(),
      uploadedById: user?.id || null,
    });

    res.status(201).json(att);
  } catch (createErr: any) {
    await storage.deleteObject(storageKey).catch(() => {});
    res.status(500).json({ error: createErr.message });
  }
};

export const uploadSiteAttachments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const inspectionId = req.params.id as string;

    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    // Validate magic bytes and format first
    for (const file of files) {
      if (!validateFileMagic(file.buffer, file.mimetype, file.originalname)) {
        return res.status(400).json({
          error: `File ${file.originalname} is not a valid JPEG, PNG, WEBP, or PDF file.`,
        });
      }
    }

    const { errorStatus, errorMessage } = await checkAttachmentPermissionAndEditable(inspectionId, user);
    if (errorStatus) {
      return res.status(errorStatus).json({ error: errorMessage });
    }

    const existingCount = await SiteInspectionAttachment.count({ where: { inspectionId } });
    if (existingCount + files.length > 30) {
      return res.status(400).json({ error: "Maximum limit of 30 attachments per inspection exceeded." });
    }

    const storage = getFileStorage();
    const createdAttachments: any[] = [];

    for (const file of files) {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let takenAt: Date | null = null;

      if (file.mimetype.startsWith("image/")) {
        try {
          const exifr = require("exifr");
          const exifData = await exifr.parse(file.buffer, { gps: true, tiff: true });
          if (exifData) {
            if (typeof exifData.latitude === "number") latitude = exifData.latitude;
            if (typeof exifData.longitude === "number") longitude = exifData.longitude;
            if (exifData.DateTimeOriginal) takenAt = new Date(exifData.DateTimeOriginal);
          }
        } catch (exifErr) {
          // EXIF parsing non-fatal
        }
      }

      const fileExt = path.extname(file.originalname).toLowerCase();
      const storageKey = generateInspectionStorageKey(inspectionId, fileExt);

      await storage.putObject(storageKey, file.buffer, {
        contentType: file.mimetype,
      });

      const sanitized = sanitizeFileName(file.originalname);

      const att = await SiteInspectionAttachment.create({
        id: crypto.randomUUID(),
        inspectionId,
        fileName: sanitized,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: storageKey,
        caption: req.body.caption || null,
        tag: req.body.tag || "Site Overview",
        latitude,
        longitude,
        takenAt: takenAt || new Date(),
        uploadedById: user?.id || null,
      });

      createdAttachments.push(att);
    }

    res.status(201).json(createdAttachments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAttachmentMetadata = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const attId = req.params.attId as string;
    const { caption, tag } = req.body;
    const user = (req as any).user;

    const { errorStatus, errorMessage } = await checkAttachmentPermissionAndEditable(id, user);
    if (errorStatus) {
      return res.status(errorStatus).json({ error: errorMessage });
    }

    const att: any = await SiteInspectionAttachment.findOne({
      where: { id: attId, inspectionId: id },
    });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

    await att.update({
      ...(caption !== undefined ? { caption } : {}),
      ...(tag !== undefined ? { tag } : {}),
    });

    res.json(att);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAttachment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const attId = req.params.attId as string;
    const user = (req as any).user;

    // Check permission and editable status (must not be SUBMITTED or APPROVED)
    const { errorStatus, errorMessage } = await checkAttachmentPermissionAndEditable(id, user);
    if (errorStatus) {
      return res.status(errorStatus).json({ error: errorMessage });
    }

    const att: any = await SiteInspectionAttachment.findOne({
      where: { id: attId, inspectionId: id },
    });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

    const storage = getFileStorage();
    // Delete from storage (handles both local and s3)
    try {
      await storage.deleteObject(att.storagePath);
    } catch (e) {
      console.warn("Failed to delete stored object:", e);
    }

    // Also support fallback cleanup for older rows with legacy relative paths
    const fullPath = path.resolve(UPLOAD_ROOT, att.storagePath);
    if (fullPath.startsWith(UPLOAD_ROOT) && fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.warn("Failed to delete physical file:", e);
      }
    }

    await att.destroy();
    res.json({ success: true, message: "Attachment deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttachmentFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const attId = req.params.attId as string;
    const user = (req as any).user;

    const inspection: any = await SiteInspection.findByPk(id, {
      include: [{ model: Lead, as: "lead" }],
    });
    if (!inspection) return res.status(404).json({ error: "Site inspection not found" });

    // Download authorization check:
    // Allowed: approvers, assigned site_manager, admin, or the lead owner
    const isApprover = APPROVER_ROLES.includes(user?.role);
    const isAssigned = inspection.assignedToId === user?.id;
    const isLeadOwner = inspection.lead?.assignedToId === user?.id;
    const isAdmin = user?.role === "admin";

    if (!isApprover && !isAssigned && !isLeadOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied: you do not have permission to view attachments for this inspection." });
    }

    const att: any = await SiteInspectionAttachment.findOne({
      where: { id: attId, inspectionId: id },
    });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

    const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
    const safeName = sanitizeFileName(att.fileName);

    // If driver is s3, return JSON or redirect to short-lived (60 second) signed download URL
    if (driver === "s3") {
      const storage = getFileStorage();
      const signedUrl = await storage.getSignedDownloadUrl(att.storagePath, {
        expiresInSeconds: 60,
        responseContentDisposition: `inline; filename="${safeName}"`,
      });

      // If client requested JSON via Accept header or format query param, return JSON
      if (req.headers.accept?.includes("application/json") || req.query.format === "json") {
        return res.json({ url: signedUrl, expiresIn: 60 });
      }

      return res.redirect(signedUrl);
    }

    // Local driver or fallback for legacy files
    const safePath = path.resolve(UPLOAD_ROOT, att.storagePath);
    if (!safePath.startsWith(UPLOAD_ROOT)) {
      return res.status(403).json({ error: "Path traversal rejected" });
    }

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: "File not found on storage" });
    }

    res.setHeader("Content-Type", att.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    fs.createReadStream(safePath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const getLeadSiteInspection = async (req: Request, res: Response) => {
  try {
    const leadId = req.params.leadId as string;
    const gate = await getSiteInspectionGate(leadId);

    const inspection = await SiteInspection.findOne({
      where: { leadId },
      include: [
        { model: SiteInspectionService, as: "services" },
        { model: SiteInspectionAttachment, as: "attachments" },
        { model: SiteBase, as: "base" },
        { model: User, as: "assignedTo", attributes: ["id", "name", "email", "role"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      gate,
      inspection,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const requestLeadSiteInspectionEndpoint = async (req: Request, res: Response) => {
  try {
    const leadId = req.params.leadId as string;
    const user = (req as any).user;
    const { requestNote } = req.body;

    const inspection = await requestSiteInspection(leadId, user?.id, requestNote);
    res.status(201).json(inspection);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
