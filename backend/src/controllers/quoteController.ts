import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getQuotes = async (req: Request, res: Response) => {
  try {
    const quotes = await sequelize.models.Quote.findAll({
      include: [
        { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(quotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createQuote = async (req: Request, res: Response) => {
  try {
    const { dealId, items, status, expirationDate } = req.body;
    
    // Create quote
    const quote = await sequelize.models.Quote.create({
      id: require('crypto').randomUUID(),
      dealId,
      status: status || "Draft",
      totalAmount: items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0),
      expirationDate: expirationDate || null
    });

    // Create line items
    if (items && items.length > 0) {
      const lineItemsData = items.map((item: any) => ({
        id: require('crypto').randomUUID(),
        quoteId: (quote as any).id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice
      }));
      await sequelize.models.QuoteLineItem.bulkCreate(lineItemsData);
    }

    res.status(201).json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
