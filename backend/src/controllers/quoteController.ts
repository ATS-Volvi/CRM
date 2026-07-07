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

export const getQuoteRecommendations = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: "dealId is required" });

    // Fetch the deal to get its amount/context
    const deal = await sequelize.models.Deal.findByPk(dealId as string);
    const amount = deal ? Number((deal as any).amount) : 0;
    
    // Fetch price book entries
    const entries = await sequelize.models.PriceBookEntry.findAll();
    
    // Simple heuristic algorithm:
    // If deal amount > 50k, recommend Enterprise/Premium SKUs
    // If deal amount > 10k, recommend Standard SKUs
    let recommendedCategory = "Standard Tier";
    if (amount > 50000) {
      recommendedCategory = "Enterprise VIP";
    }

    const recommendations = entries.filter((e: any) => (e.category || "").includes(recommendedCategory)).slice(0, 3);
    
    // Map them to line items with a suggested 10% discount for "AI Recommendation"
    const suggestedLineItems = recommendations.map((r: any) => ({
      productId: r.id,
      sku: r.sku,
      name: r.name,
      quantity: 1,
      unitPrice: Number(r.msrp) * 0.9, // 10% discount
      originalPrice: Number(r.msrp),
      reason: `Based on the deal size ($${amount}), we recommend the ${r.name} with a 10% bundle discount.`
    }));

    res.json(suggestedLineItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
