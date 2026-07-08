import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await sequelize.models.Invoice.findAll({
      include: [
        { 
          model: sequelize.models.Quote, 
          as: "quote", 
          include: [{ model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }] 
        },
        { model: sequelize.models.InvoiceLineItem, as: "lineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createInvoiceFromQuote = async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.body;
    
    // We need to fetch QuoteLineItem as "quoteLineItems" if we didn't alias it that way, but let's check index.ts. 
    // In index.ts: Quote.hasMany(QuoteLineItem, { foreignKey: "quoteId" }); 
    // It doesn't have an alias, so it defaults to "QuoteLineItems". Let's fetch the items separately.
    const quote = await sequelize.models.Quote.findByPk(quoteId);

    if (!quote) return res.status(404).json({ error: "Quote not found" });
    if ((quote as any).status !== 'Approved') return res.status(400).json({ error: "Only approved quotes can be invoiced" });

    // Ensure not already invoiced
    const existing = await sequelize.models.Invoice.findOne({ where: { quoteId } });
    if (existing) return res.status(400).json({ error: "Invoice already exists for this quote" });

    const invoice = await sequelize.models.Invoice.create({
      id: require('crypto').randomUUID(),
      quoteId,
      status: "Draft",
      totalAmount: (quote as any).totalAmount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
    });

    const quoteItems: any[] = await sequelize.models.QuoteLineItem.findAll({ where: { quoteId } });
    if (quoteItems.length > 0) {
      const lineItemsData = quoteItems.map((item: any) => ({
        id: require('crypto').randomUUID(),
        invoiceId: (invoice as any).id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }));
      await sequelize.models.InvoiceLineItem.bulkCreate(lineItemsData);
    }

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateInvoiceStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const invoice = await sequelize.models.Invoice.findByPk(String(id));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    
    await invoice.update({ status });
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
