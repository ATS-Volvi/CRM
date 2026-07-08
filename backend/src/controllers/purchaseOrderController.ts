import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const purchaseOrders = await sequelize.models.PurchaseOrder.findAll({
      include: [
        { 
          model: sequelize.models.Quote, 
          as: "quote", 
          include: [{ 
            model: sequelize.models.Deal, 
            as: "deal",
            include: [{ model: sequelize.models.Lead, as: "lead" }] 
          }] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(purchaseOrders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { quoteId, amount, poNumber } = req.body;
    
    const quote = await sequelize.models.Quote.findByPk(quoteId, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const po = await sequelize.models.PurchaseOrder.create({
      id: require('crypto').randomUUID(),
      quoteId,
      amount,
      poNumber,
      status: "Pending",
      generatedDate: new Date()
    });

    // Notify the salesperson (deal owner)
    const ownerId = (quote as any).deal?.ownerId;
    if (ownerId) {
      await createNotification(
        ownerId,
        'info',
        'Purchase Order Created',
        `PO #${poNumber} was created for your deal ${(quote as any).deal?.name}.`,
        `/purchase-orders`
      );
    }

    res.status(201).json(po);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
