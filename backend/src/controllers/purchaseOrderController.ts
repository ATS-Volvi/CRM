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
