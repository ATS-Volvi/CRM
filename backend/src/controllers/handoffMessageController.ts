import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { getLeadAccessLevel, getDealAccessLevel } from "../services/handoffAccessService";
import { createNotification } from "../services/notificationEngine";

/**
 * Helper to fetch structured handoff room participants (firstQualifyingRep, previousOwner, currentOwner, allParticipants)
 */
export async function getHandoffParticipants(dealOrLeadId: { dealId?: string; leadId?: string }) {
  const { User, Lead, Deal, LeadReassignmentHistory, DealReassignmentHistory } = sequelize.models;
  const participantMap = new Map<string, any>();

  let targetLeadId = dealOrLeadId.leadId;
  let targetDealId = dealOrLeadId.dealId;
  let deal: any = null;
  let lead: any = null;

  if (targetDealId) {
    deal = await Deal.findByPk(targetDealId);
    if (deal && deal.leadId) targetLeadId = deal.leadId;
  }
  if (targetLeadId) {
    lead = await Lead.findByPk(targetLeadId);
  }

  // 1. First Qualifying Rep (from Lead.assignedToId or oldest LeadReassignmentHistory)
  let firstQualifyingRepId: string | null = lead?.assignedToId || null;
  let firstQualifyingRep: any = null;

  if (targetLeadId && LeadReassignmentHistory) {
    const oldestLeadHist: any = await LeadReassignmentHistory.findOne({
      where: { leadId: targetLeadId },
      order: [["createdAt", "ASC"]]
    });
    if (oldestLeadHist?.oldAssignedToId) {
      firstQualifyingRepId = oldestLeadHist.oldAssignedToId;
    }
  }

  // 2. Previous Owner (Immediate Predecessor) & All Participants
  let previousOwnerId: string | null = null;
  let currentOwnerId: string | null = deal?.ownerId || lead?.assignedToId || null;

  if (targetDealId && DealReassignmentHistory) {
    const dealHists: any[] = await DealReassignmentHistory.findAll({
      where: { dealId: targetDealId },
      order: [["createdAt", "DESC"]]
    });
    if (dealHists.length > 0) {
      previousOwnerId = dealHists[0].oldOwnerId;
      for (const h of dealHists) {
        if (h.oldOwnerId) participantMap.set(h.oldOwnerId, true);
        if (h.newOwnerId) participantMap.set(h.newOwnerId, true);
      }
    }
  }

  if (targetLeadId && LeadReassignmentHistory) {
    const leadHists: any[] = await LeadReassignmentHistory.findAll({
      where: { leadId: targetLeadId },
      order: [["createdAt", "DESC"]]
    });
    if (leadHists.length > 0 && !previousOwnerId) {
      previousOwnerId = leadHists[0].oldAssignedToId;
    }
    for (const h of leadHists) {
      if (h.oldAssignedToId) participantMap.set(h.oldAssignedToId, true);
      if (h.newAssignedToId) participantMap.set(h.newAssignedToId, true);
    }
  }

  if (firstQualifyingRepId) participantMap.set(firstQualifyingRepId, true);
  if (currentOwnerId) participantMap.set(currentOwnerId, true);

  const participantIds = Array.from(participantMap.keys());
  const users: any[] = await User.findAll({
    where: { id: participantIds },
    attributes: ["id", "name", "email", "role", "department", "territory"]
  });

  const usersById = new Map(users.map(u => [u.id, u.toJSON ? u.toJSON() : u]));

  firstQualifyingRep = firstQualifyingRepId ? usersById.get(firstQualifyingRepId) || null : null;
  const previousOwner = previousOwnerId ? usersById.get(previousOwnerId) || null : null;
  const currentOwner = currentOwnerId ? usersById.get(currentOwnerId) || null : null;

  return {
    firstQualifyingRep,
    previousOwner,
    currentOwner,
    allParticipants: users,
    participantIds
  };
}

/**
 * GET /api/v1/handoff-messages
 * Lists handoff chat messages for a deal or lead with pagination.
 * Room participation (canRead: true) grants full read access.
 */
export async function getHandoffMessages(req: Request, res: Response) {
  try {
    const { dealId, leadId, page = "1", limit = "50" } = req.query as any;
    const user = (req as any).user;

    if (!dealId && !leadId) {
      return res.status(400).json({ error: "Missing required parameter: dealId or leadId" });
    }

    const { Lead, Deal, HandoffMessage, User } = sequelize.models;
    let access = { canRead: false, accessLevel: "none" };

    if (dealId) {
      const deal = await Deal.findByPk(String(dealId));
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      access = await getDealAccessLevel(user?.id, user?.role, deal);
    } else if (leadId) {
      const lead = await Lead.findByPk(String(leadId));
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      access = await getLeadAccessLevel(user?.id, user?.role, lead);
    }

    // Room Membership Check: canRead grants full room access
    if (!access.canRead) {
      return res.status(403).json({ error: "Forbidden — You are not a participant in this handoff thread" });
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (dealId) whereClause.dealId = String(dealId);
    if (leadId) whereClause.leadId = String(leadId);

    const { count, rows } = await HandoffMessage.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "email", "role"]
        },
        {
          model: User,
          as: "recipient",
          attributes: ["id", "name", "email", "role"]
        }
      ],
      order: [["createdAt", "ASC"]],
      limit: limitNum,
      offset
    });

    const participants = await getHandoffParticipants({
      dealId: dealId ? String(dealId) : undefined,
      leadId: leadId ? String(leadId) : undefined
    });

    return res.json({
      data: rows,
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
      participants
    });
  } catch (error: any) {
    console.error("[getHandoffMessages] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch handoff messages" });
  }
}

/**
 * POST /api/v1/handoff-messages
 * Posts a message to the handoff chat thread.
 * Decoupled Check: Room participation (canRead: true) grants full message posting write access,
 * completely independent of deal view-only status (canWrite).
 */
export async function sendHandoffMessage(req: Request, res: Response) {
  try {
    const { dealId, leadId, message, recipientId } = req.body;
    const user = (req as any).user;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }
    if (!dealId && !leadId) {
      return res.status(400).json({ error: "Missing required parameter: dealId or leadId" });
    }

    const { Lead, Deal, HandoffMessage, User } = sequelize.models;
    let access = { canRead: false, accessLevel: "none" };
    let recordTitle = "";

    if (dealId) {
      const deal: any = await Deal.findByPk(String(dealId));
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      access = await getDealAccessLevel(user?.id, user?.role, deal);
      recordTitle = deal.name || "Opportunity";
    } else if (leadId) {
      const lead: any = await Lead.findByPk(String(leadId));
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      access = await getLeadAccessLevel(user?.id, user?.role, lead);
      recordTitle = `${lead.firstName} ${lead.lastName}`.trim() || "Lead";
    }

    // Room Membership Check: canRead is required for room writing, NOT deal canWrite!
    if (!access.canRead) {
      return res.status(403).json({ error: "Forbidden — You are not a participant in this handoff thread" });
    }

    const newMessage = await HandoffMessage.create({
      dealId: dealId || null,
      leadId: leadId || null,
      senderId: user.id,
      recipientId: recipientId || null,
      message: message.trim(),
      isRead: false
    });

    const fullMessage = await HandoffMessage.findByPk((newMessage as any).id, {
      include: [
        { model: User, as: "sender", attributes: ["id", "name", "email", "role"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "role"] }
      ]
    });

    // Notify other room participants
    const participants = await getHandoffParticipants({
      dealId: dealId ? String(dealId) : undefined,
      leadId: leadId ? String(leadId) : undefined
    });

    for (const p of participants.allParticipants) {
      if (p.id !== user.id) {
        createNotification({
          userId: p.id,
          type: "HANDOFF_CHAT_MENTION",
          title: `Handoff Chat: ${user.name || "Teammate"}`,
          message: `New message on '${recordTitle}': "${message.trim().substring(0, 60)}..."`
        }).catch(err => console.error("Failed to trigger handoff chat notification:", err));
      }
    }

    return res.status(201).json(fullMessage);
  } catch (error: any) {
    console.error("[sendHandoffMessage] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to send handoff message" });
  }
}

/**
 * PUT /api/v1/handoff-messages/:id
 * Edits an existing message (sender or admin only).
 */
export async function updateHandoffMessage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const user = (req as any).user;

    const { HandoffMessage, User } = sequelize.models;
    const msg: any = await HandoffMessage.findByPk(String(id));
    if (!msg) return res.status(404).json({ error: "Message not found" });

    // Sender or Admin check
    if (msg.senderId !== user?.id && user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden — You can only edit your own messages" });
    }

    await msg.update({ message: message.trim() });
    const updated = await HandoffMessage.findByPk(msg.id, {
      include: [
        { model: User, as: "sender", attributes: ["id", "name", "email", "role"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "role"] }
      ]
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update handoff message" });
  }
}

/**
 * DELETE /api/v1/handoff-messages/:id
 * Deletes a message (sender or admin only).
 */
export async function deleteHandoffMessage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const { HandoffMessage } = sequelize.models;
    const msg: any = await HandoffMessage.findByPk(String(id));
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (msg.senderId !== user?.id && user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden — You can only delete your own messages" });
    }

    await msg.destroy();
    return res.json({ success: true, message: "Handoff message deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to delete handoff message" });
  }
}
