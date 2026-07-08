import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

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

    if (!quoteId || !amount || !poNumber) {
      return res.status(400).json({ error: "quoteId, amount, and poNumber are required." });
    }

    // Reconciliation Check: Compare PO value with the accepted Quote value
    const quote = await sequelize.models.Quote.findByPk(quoteId, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });

    if (!quote) return res.status(404).json({ error: "Quote not found." });

    const mismatch = Number((quote as any).totalAmount) !== Number(amount);

    // Create PO
    const purchaseOrder = await sequelize.models.PurchaseOrder.create({
      id: require('crypto').randomUUID(),
      quoteId,
      amount,
      poNumber,
      status: mismatch ? "Flagged/Mismatch" : "Accepted"
    });

    // Auto-update linked deal status to "Won"
    const deal = (quote as any).deal;
    if (deal) {
      const wonStage = await sequelize.models.PipelineStage.findOne({
        where: { name: "Won" }
      });
      if (wonStage) {
        await deal.update({ stageId: (wonStage as any).id });
      }
    }

    res.status(201).json({ purchaseOrder, mismatch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, amount, poNumber } = req.body;

    const purchaseOrder = await sequelize.models.PurchaseOrder.findByPk(id as string);
    if (!purchaseOrder) return res.status(404).json({ error: "Purchase Order not found." });

    await purchaseOrder.update({
      status: status !== undefined ? status : (purchaseOrder as any).status,
      amount: amount !== undefined ? amount : (purchaseOrder as any).amount,
      poNumber: poNumber !== undefined ? poNumber : (purchaseOrder as any).poNumber
    });

    res.json(purchaseOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

