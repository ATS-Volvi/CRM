import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;

    const docs = await sequelize.models.Document.findAll({
      where,
      include: [{ model: sequelize.models.User, as: "uploadedBy", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDocument = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, name, fileType, fileSize, fileUrl, version } = req.body;
    const doc = await sequelize.models.Document.create({
      id: require("crypto").randomUUID(),
      leadId: leadId || null,
      customerId: customerId || null,
      uploadedById: (req as any).user?.id || null,
      name,
      fileType: fileType || "application/pdf",
      fileSize: parseInt(fileSize || "102400", 10),
      fileUrl: fileUrl || `/uploads/${name}`,
      version: version || "1.0"
    });

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "Document",
        title: `Document Uploaded: ${name}`,
        notes: `Version ${version || "1.0"}`,
        createdById: (req as any).user?.id || null
      });
    }

    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
