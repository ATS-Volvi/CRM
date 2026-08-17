import { Request, Response } from "express";
import crypto from "crypto";
import { sequelize } from "@nexus-crm/database";

export const createSupportTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId, assetId, category, description } = req.body;
    const userId = (req as any).user.userId;
    const { SupportTicket, Account } = sequelize.models;

    if (!accountId) {
      res.status(400).json({ error: "accountId is required" });
      return;
    }

    const account: any = await Account.findByPk(accountId);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Default to the user creating it if we want to inherit,
    // or we can inherit from a Deal's senior_ae if we had a direct deal link.
    // For now, raisedBy is the user creating the ticket.
    const ticket = await SupportTicket.create({
      id: crypto.randomUUID(),
      accountId,
      assetId: assetId || null,
      raisedBy: userId,
      status: "open",
      category: category || "issue",
      description
    });

    res.status(201).json(ticket);
  } catch (error: any) {
    console.error("[createSupportTicket]", error);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
};

export const listSupportTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId, assetId } = req.query;
    const { SupportTicket, User, Asset } = sequelize.models;

    const whereClause: any = {};
    if (accountId) whereClause.accountId = accountId;
    if (assetId) whereClause.assetId = assetId;

    const tickets = await SupportTicket.findAll({
      where: whereClause,
      include: [
        { model: User, as: "raisedByUser", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(tickets);
  } catch (error: any) {
    console.error("[listSupportTickets]", error);
    res.status(500).json({ error: "Failed to list support tickets" });
  }
};

export const updateSupportTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const { status, category, description } = req.body;
    const { SupportTicket } = sequelize.models;

    const ticket: any = await SupportTicket.findByPk(String(ticketId));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    let resolvedAt = ticket.resolvedAt;
    if (status === "resolved" || status === "closed") {
      if (!resolvedAt) resolvedAt = new Date();
    } else {
      resolvedAt = null;
    }

    await ticket.update({
      status: status !== undefined ? status : ticket.status,
      category: category !== undefined ? category : ticket.category,
      description: description !== undefined ? description : ticket.description,
      resolvedAt
    });

    res.json(ticket);
  } catch (error: any) {
    console.error("[updateSupportTicket]", error);
    res.status(500).json({ error: "Failed to update support ticket" });
  }
};
