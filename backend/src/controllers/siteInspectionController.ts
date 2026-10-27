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

// Multer memory storage configured for max 25MB files
export const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10,
  },
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

function validateFileMagic(buffer: Buffer, mimeType: string, originalName: string): boolean {
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
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  if (mimeType === "application/pdf") {
    return buffer.toString("ascii", 0, 4) === "%PDF";
  }

  return true;
}

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../uploads");

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

    // Site Managers see only their own inspections
    if (user?.role === "site_manager" || mine === "true") {
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

    // Isolation check for Site Manager
    if (user?.role === "site_manager" && inspection.assignedToId !== user.id) {
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

    if (user?.role === "site_manager" && existing.assignedToId !== user.id) {
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

    if (user?.role === "site_manager" && existing.assignedToId !== user.id) {
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
    const { action, comment } = req.body;

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

export const uploadSiteAttachments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const inspectionId = req.params.id as string;

    const inspection: any = await SiteInspection.findByPk(inspectionId);
    if (!inspection) return res.status(404).json({ error: "Site inspection not found" });

    if (user?.role === "site_manager" && inspection.assignedToId !== user.id) {
      return res.status(403).json({ error: "Access denied: you may only upload to inspections assigned to you." });
    }

    const existingCount = await SiteInspectionAttachment.count({ where: { inspectionId } });
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    if (existingCount + files.length > 30) {
      return res.status(400).json({ error: "Maximum limit of 30 attachments per inspection exceeded." });
    }

    const uploadDir = path.join(UPLOAD_ROOT, "site-inspections", inspectionId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const createdAttachments: any[] = [];

    for (const file of files) {
      if (!validateFileMagic(file.buffer, file.mimetype, file.originalname)) {
        return res.status(400).json({
          error: `File ${file.originalname} is not a valid JPEG, PNG, WEBP, or PDF file.`,
        });
      }

      // Optional EXIF GPS extraction
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
      const storedFileName = `${crypto.randomUUID()}${fileExt}`;
      const fullPath = path.join(uploadDir, storedFileName);
      fs.writeFileSync(fullPath, file.buffer);

      const relPath = path.join("site-inspections", inspectionId, storedFileName);

      const att = await SiteInspectionAttachment.create({
        id: crypto.randomUUID(),
        inspectionId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: relPath,
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
    const { id, attId } = req.params;
    const { caption, tag } = req.body;

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
    const { id, attId } = req.params;
    const user = (req as any).user;

    const att: any = await SiteInspectionAttachment.findOne({
      where: { id: attId, inspectionId: id },
    });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

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
    const { id, attId } = req.params;
    const att: any = await SiteInspectionAttachment.findOne({
      where: { id: attId, inspectionId: id },
    });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

    const safePath = path.resolve(UPLOAD_ROOT, att.storagePath);
    if (!safePath.startsWith(UPLOAD_ROOT)) {
      return res.status(403).json({ error: "Path traversal rejected" });
    }

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: "File not found on storage" });
    }

    res.setHeader("Content-Type", att.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${att.fileName}"`);
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
