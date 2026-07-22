import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getCallLogs = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;

    const logs = await sequelize.models.CallLog.findAll({
      where,
      include: [{ model: sequelize.models.User, as: "user", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCallLog = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, direction, durationSeconds, outcome, notes, followUpDate, recordingUrl } = req.body;
    const callLog = await sequelize.models.CallLog.create({
      id: require("crypto").randomUUID(),
      leadId: leadId || null,
      customerId: customerId || null,
      userId: (req as any).user?.id || null,
      direction: direction || "Outbound",
      durationSeconds: parseInt(durationSeconds || "0", 10),
      outcome: outcome || "Connected",
      notes: notes || null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      recordingUrl: recordingUrl || null
    });

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "Call",
        title: `${direction || "Outbound"} Call (${outcome || "Connected"})`,
        notes: notes || `Duration: ${durationSeconds || 0} seconds`,
        createdById: (req as any).user?.id || null
      });
    }

    res.status(201).json(callLog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
