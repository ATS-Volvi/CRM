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
    const invoice = await sequelize.models.Invoice.findByPk(id as string);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    
    await invoice.update({ status });
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateInvoicePdf = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const PDFDocument = require("pdfkit");

    const invoice = await sequelize.models.Invoice.findByPk(id as string, {
      include: [
        { 
          model: sequelize.models.InvoiceLineItem, 
          as: "lineItems", 
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] 
        },
        { 
          model: sequelize.models.Quote, 
          as: "quote", 
          include: [{ 
            model: sequelize.models.Deal, 
            as: "deal", 
            include: [{ model: sequelize.models.Lead, as: "lead" }] 
          }] 
        }
      ]
    });

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_INV-${id.substring(0, 6).toUpperCase()}.pdf`
    );

    doc.pipe(res);

    // PDF Layout Styling
    doc
      .fillColor("#0f172a")
      .fontSize(20)
      .text("NEXUS CRM - INVOICE", { align: "center" })
      .moveDown(1.5);

    // Info block
    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(`Invoice Ref: INV-${id.substring(0, 6).toUpperCase()}`)
      .text(`Status: ${(invoice as any).status}`)
      .text(`Date: ${new Date((invoice as any).createdAt).toLocaleDateString()}`)
      .text(`Due Date: ${new Date((invoice as any).dueDate).toLocaleDateString()}`)
      .moveDown();

    // Client details
    const lead = (invoice as any).quote?.deal?.lead;
    if (lead) {
      doc
        .fontSize(12)
        .fillColor("#0f172a")
        .text("Billed To:", { underline: true })
        .fontSize(10)
        .fillColor("#475569")
        .text(`Company: ${lead.company || "N/A"}`)
        .text(`Contact: ${lead.firstName} ${lead.lastName}`)
        .text(`Email: ${lead.email}`)
        .moveDown(1.5);
    }

    // Line Items Title
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text("Line Items:", { underline: true })
      .moveDown(0.5);

    // Items table header
    doc
      .fontSize(10)
      .text("Product/Service Description", 50, doc.y, { width: 250 })
      .text("Qty", 320, doc.y)
      .text("Unit Price", 380, doc.y)
      .text("Total", 470, doc.y)
      .moveDown(0.3);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cbd5e1").stroke().moveDown(0.5);

    const items = (invoice as any).lineItems || [];
    items.forEach((item: any) => {
      const productName = item.product?.name || "Product/Service";
      const qty = item.quantity;
      const unit = Number(item.unitPrice).toFixed(2);
      const total = Number(item.totalPrice).toFixed(2);

      doc
        .fillColor("#475569")
        .text(productName, 50, doc.y, { width: 250 })
        .text(qty.toString(), 320, doc.y)
        .text(`$${unit}`, 380, doc.y)
        .text(`$${total}`, 470, doc.y)
        .moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cbd5e1").stroke().moveDown(0.5);

    // Total Amount Block
    const totalAmount = Number((invoice as any).totalAmount).toFixed(2);
    const taxAmount = Number((invoice as any).totalAmount * 0.05).toFixed(2);
    const totalDue = Number((invoice as any).totalAmount * 1.05).toFixed(2);
    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .text(`Subtotal: $${totalAmount}`, 380, doc.y, { align: "right" })
      .text(`Tax (5%): $${taxAmount}`, 380, doc.y, { align: "right" })
      .fontSize(12)
      .text(`Total Due: $${totalDue}`, 380, doc.y, { align: "right" })
      .moveDown();

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
