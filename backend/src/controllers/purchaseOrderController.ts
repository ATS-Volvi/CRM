import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { triggerTemplatedEmail } from "../services/emailService";

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
      include: [{ 
        model: sequelize.models.Deal, 
        as: "deal",
        include: [{ model: sequelize.models.Lead, as: "lead" }]
      }]
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

    // 3. PO THANK-YOU AUTOMATION
    const lead = (quote as any).deal?.lead;
    if (lead && lead.email) {
      triggerTemplatedEmail("po_thank_you", lead.email, {
        lead_name: lead.firstName || 'there',
        company_name: lead.company || "your company",
        po_number: poNumber,
        sender_company_name: process.env.COMPANY_NAME || "Our Company"
      }, lead.id).catch(err => console.error("Failed to send PO Thank You email", err));
    }

    res.status(201).json(po);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
