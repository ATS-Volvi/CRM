import { Request, Response } from "express";
import crypto from "crypto";
import { sequelize } from "@nexus-crm/database";

export const createSupportTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId, assetId, category, description } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { SupportTicket, Account, User, Asset } = sequelize.models;

    if (!accountId) {
      res.status(400).json({ error: "accountId is required" });
      return;
    }

    const account: any = await Account.findByPk(accountId);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const ticketId = crypto.randomUUID();
    await SupportTicket.create({
      id: ticketId,
      accountId,
      assetId: assetId || null,
      raisedBy: userId || null,
      status: "open",
      category: category || "issue",
      description
    });

    const createdTicket = await SupportTicket.findByPk(ticketId, {
      include: [
        { model: Account, as: "account", attributes: ["id", "name", "email", "phone"] },
        { model: User, as: "raisedByUser", attributes: ["id", "name", "email", "role"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber", "status"] }
      ]
    });

    res.status(201).json(createdTicket);
  } catch (error: any) {
    console.error("[createSupportTicket]", error);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
};

export const listSupportTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId, assetId, status, category, search } = req.query;
    const { SupportTicket, User, Asset, Account } = sequelize.models;
    const { Op } = require("sequelize");

    const whereClause: any = {};
    if (accountId) whereClause.accountId = accountId;
    if (assetId) whereClause.assetId = assetId;
    if (status && status !== "all") whereClause.status = status;
    if (category && category !== "all") whereClause.category = category;
    if (search) {
      whereClause.description = { [Op.iLike]: `%${search}%` };
    }

    const tickets = await SupportTicket.findAll({
      where: whereClause,
      include: [
        { model: Account, as: "account", attributes: ["id", "name", "email", "phone"] },
        { model: User, as: "raisedByUser", attributes: ["id", "name", "email", "role"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber", "status"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(tickets);
  } catch (error: any) {
    console.error("[listSupportTickets]", error);
    res.status(500).json({ error: "Failed to list support tickets" });
  }
};

export const getSupportTicketById = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const { SupportTicket, User, Asset, Account } = sequelize.models;

    const ticket = await SupportTicket.findByPk(String(ticketId), {
      include: [
        { model: Account, as: "account", attributes: ["id", "name", "email", "phone"] },
        { model: User, as: "raisedByUser", attributes: ["id", "name", "email", "role"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber", "status"] }
      ]
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(ticket);
  } catch (error: any) {
    console.error("[getSupportTicketById]", error);
    res.status(500).json({ error: "Failed to fetch support ticket" });
  }
};

export const updateSupportTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const { status, category, description } = req.body;
    const { SupportTicket, User, Asset, Account } = sequelize.models;

    const ticket: any = await SupportTicket.findByPk(String(ticketId));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    let resolvedAt = ticket.resolvedAt;
    if (status === "resolved" || status === "closed") {
      if (!resolvedAt) resolvedAt = new Date();
    } else if (status === "open" || status === "in_progress") {
      resolvedAt = null;
    }

    await ticket.update({
      status: status !== undefined ? status : ticket.status,
      category: category !== undefined ? category : ticket.category,
      description: description !== undefined ? description : ticket.description,
      resolvedAt
    });

    const updated = await SupportTicket.findByPk(String(ticketId), {
      include: [
        { model: Account, as: "account", attributes: ["id", "name", "email", "phone"] },
        { model: User, as: "raisedByUser", attributes: ["id", "name", "email", "role"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber", "status"] }
      ]
    });

    res.json(updated);
  } catch (error: any) {
    console.error("[updateSupportTicket]", error);
    res.status(500).json({ error: "Failed to update support ticket" });
  }
};
