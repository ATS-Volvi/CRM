import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { updateFulfillmentStatus, updateFulfillmentItem } from "../services/supplyFulfillmentService";

export const getFulfillments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { status, priority, assignedUserId, search } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedUserId) where.assignedUserId = assignedUserId;

    const orderWhere: any = {};
    if (search) {
      orderWhere[Op.or] = [
        { poNumber: { [Op.iLike]: `%${search}%` } },
        { notes: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { rows, count } = await sequelize.models.Fulfillment.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: sequelize.models.FulfillmentItem,
          as: "items",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        },
        {
          model: sequelize.models.PurchaseOrder,
          as: "order",
          where: Object.keys(orderWhere).length > 0 ? orderWhere : undefined,
          include: [
            {
              model: sequelize.models.Quote,
              as: "quote",
              include: [
                {
                  model: sequelize.models.Deal,
                  as: "deal",
                  include: [
                    { model: sequelize.models.Account, as: "account" },
                    { model: sequelize.models.User, as: "owner" }
                  ]
                }
              ]
            },
            { model: sequelize.models.User, as: "salesOwner" }
          ]
        },
        { model: sequelize.models.User, as: "assignedUser" }
      ]
    });

    res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFulfillmentById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const fulfillment = await sequelize.models.Fulfillment.findByPk(id, {
      include: [
        {
          model: sequelize.models.FulfillmentItem,
          as: "items",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        },
        {
          model: sequelize.models.PurchaseOrder,
          as: "order",
          include: [
            {
              model: sequelize.models.Quote,
              as: "quote",
              include: [
                {
                  model: sequelize.models.Deal,
                  as: "deal",
                  include: [
                    { model: sequelize.models.Account, as: "account" },
                    { model: sequelize.models.User, as: "owner" }
                  ]
                }
              ]
            },
            { model: sequelize.models.User, as: "salesOwner" }
          ]
        },
        { model: sequelize.models.User, as: "assignedUser" }
      ]
    });

    if (!fulfillment) return res.status(404).json({ error: "Fulfillment not found." });
    res.json(fulfillment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFulfillmentByOrderId = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const fulfillment = await sequelize.models.Fulfillment.findOne({
      where: { orderId },
      include: [
        {
          model: sequelize.models.FulfillmentItem,
          as: "items",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        },
        { model: sequelize.models.User, as: "assignedUser" }
      ]
    });

    if (!fulfillment) return res.status(404).json({ error: "Fulfillment not found for this order." });
    res.json(fulfillment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const changeFulfillmentStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, updates } = req.body;
    const userId = (req as any).user?.id;

    if (!status) {
      return res.status(400).json({ error: "status is required." });
    }

    const result = await updateFulfillmentStatus(id, status, updates, userId);
    res.json({ message: `Fulfillment status updated to ${status}`, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateFulfillmentItemStatus = async (req: Request, res: Response) => {
  try {
    const itemId = String(req.params.itemId);
    const updates = req.body;
    const userId = (req as any).user?.id;

    const result = await updateFulfillmentItem(itemId, updates, userId);
    res.json({ message: "Fulfillment item updated", item: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
