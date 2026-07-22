import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getMeetings = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, organizerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (organizerId) where.organizerId = organizerId;

    const meetings = await sequelize.models.Meeting.findAll({
      where,
      include: [{ model: sequelize.models.User, as: "organizer", attributes: ["id", "name"] }],
      order: [["date", "ASC"], ["time", "ASC"]]
    });
    res.json(meetings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createMeeting = async (req: Request, res: Response) => {
  try {
    const { title, date, time, attendees, location, videoLink, agenda, notes, outcome, leadId, customerId } = req.body;
    const meeting = await sequelize.models.Meeting.create({
      id: require("crypto").randomUUID(),
      title,
      date,
      time,
      attendees,
      location,
      videoLink,
      agenda,
      notes,
      outcome: outcome || "Scheduled",
      leadId: leadId || null,
      customerId: customerId || null,
      organizerId: (req as any).user?.id || null
    });

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "Meeting",
        title: `Meeting Scheduled: ${title}`,
        notes: `Date: ${date} at ${time}. ${agenda || ""}`,
        createdById: (req as any).user?.id || null
      });
    }

    res.status(201).json(meeting);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
