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
    const { dealId, items, status, expirationDate, parentQuoteId } = req.body;
    const year = new Date().getFullYear();
    let quoteNum = "";
    let ver = 1;

    if (parentQuoteId) {
      // Versioning / Revision flow
      const parent = await sequelize.models.Quote.findByPk(parentQuoteId);
      if (parent) {
        quoteNum = (parent as any).quoteNumber;
        ver = Number((parent as any).version || 1) + 1;
        // Mark old quote as revised/superseded (we'll use status 'Superseded' or keep it as Accepted/Draft)
        await parent.update({ status: "Superseded" });
      }
    }

    if (!quoteNum) {
      // Auto Quote Numbering: QT-{YEAR}-{SEQ}
      const count = await sequelize.models.Quote.count();
      const seq = String(count + 1).padStart(5, '0');
      quoteNum = `QT-${year}-${seq}`;
    }

    // Verify items and check pricing limits
    const verifiedItems = [];
    const userId = (req as any).user?.id || "mock-user";
    const userRole = (req as any).user?.role || "sales_rep";

    // Define standard discount limits
    const roleDiscountLimits: Record<string, number> = {
      sales_rep: 5,
      sales_manager: 15,
      director: 25,
      admin: 100
    };
    const maxAllowedDiscount = roleDiscountLimits[userRole] || 5;
    let approvalRequired = false;

    if (items && items.length > 0) {
      for (const item of items) {
        const product = await sequelize.models.PriceBookEntry.findByPk(item.productId);
        if (!product) {
          return res.status(400).json({ error: `Product with ID ${item.productId} not found.` });
        }

        const listPrice = Number((product as any).unitPrice);
        const floorPrice = (product as any).minPrice !== null ? Number((product as any).minPrice) : null;
        const requestedPrice = Number(item.unitPrice);

        // Enforce hard floor price check
        if (floorPrice !== null && requestedPrice < floorPrice) {
          return res.status(400).json({ 
            error: `Hard limit violation: Price for product '${(product as any).name}' ($${requestedPrice}) is below the floor price limit ($${floorPrice}).` 
          });
        }

        // Check if discount exceeds user threshold
        const discountPct = ((listPrice - requestedPrice) / listPrice) * 100;
        if (discountPct > maxAllowedDiscount) {
          approvalRequired = true;
        }

        verifiedItems.push({
          id: require('crypto').randomUUID(),
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: requestedPrice,
          totalPrice: item.quantity * requestedPrice
        });
      }
    }

    const totalAmount = verifiedItems.reduce((acc, item) => acc + item.totalPrice, 0);

    // Create quote
    const quote = await sequelize.models.Quote.create({
      id: require('crypto').randomUUID(),
      dealId,
      status: approvalRequired ? "Pending Approval" : (status || "Draft"),
      totalAmount,
      expirationDate: expirationDate || null,
      quoteNumber: quoteNum,
      version: ver
    });

    // Create line items
    if (verifiedItems.length > 0) {
      const lineItemsData = verifiedItems.map(item => ({
        ...item,
        quoteId: (quote as any).id
      }));
      await sequelize.models.QuoteLineItem.bulkCreate(lineItemsData);
    }

    // Auto-create approval request if threshold is breached
    if (approvalRequired) {
      await sequelize.models.ApprovalRequest.create({
        id: require('crypto').randomUUID(),
        targetId: (quote as any).id,
        type: "Quote",
        status: "Pending",
        requestedById: userId,
        comments: `Discount limit of ${maxAllowedDiscount}% exceeded by ${userRole}.`
      });
    }

    res.status(201).json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, expirationDate } = req.body;
    
    const quote = await sequelize.models.Quote.findByPk(String(id));
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const q = quote as any;
    if (status && status !== q.status) {
      q.status = status;
      q.statusChangedAt = new Date();
    }
    
    if (expirationDate) q.expirationDate = expirationDate;

    await q.save();
    res.json(q);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quote = await sequelize.models.Quote.findByPk(id as string);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    await quote.update({
      status: "Sent",
      sentAt: new Date()
    });
    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Using id directly for viewing public quote
    const quote = await sequelize.models.Quote.findByPk(id as string, {
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
        { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }
      ]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    // Mark as Viewed if status is Sent
    if ((quote as any).status === "Sent") {
      await quote.update({
        status: "Viewed",
        viewedAt: new Date()
      });
    }

    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuoteRecommendations = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: "dealId is required" });

    const { getPriceWinRateSuggestion } = require("../services/pricingEngine");
    const { suggestBundleOrItems } = require("../services/recommendationEngine");

    // Fetch the deal to get its amount/context
    const deal = await sequelize.models.Deal.findByPk(dealId as string);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const amount = Number((deal as any).amount || 0);
    const leadId = (deal as any).leadId;

    let recommendations: any[] = [];

    if (leadId) {
      // Use smart context matching + co-occurrence patterns
      recommendations = await suggestBundleOrItems(leadId);
    } else {
      // Fallback matching
      const entries = await sequelize.models.PriceBookEntry.findAll();
      let recommendedCategory = "Standard Tier";
      if (amount > 50000) {
        recommendedCategory = "Enterprise VIP";
      }
      const rawRecs = entries.filter((e: any) => (e.category || "").includes(recommendedCategory)).slice(0, 3);
      recommendations = rawRecs.map((r: any) => ({
        productId: r.id,
        sku: r.sku,
        name: r.name,
        unitPrice: Number(r.unitPrice),
        reason: "Recommended based on deal size."
      }));
    }
    
    // Inject pricing win-rate intelligence on top of recommendations
    const suggestedLineItems = await Promise.all(
      recommendations.map(async (r: any) => {
        const { suggestedPrice, winRateCurve } = await getPriceWinRateSuggestion(r.productId);
        
        // Use optimal suggestion if catalog unit price matches
        const finalPrice = suggestedPrice || r.unitPrice;

        return {
          productId: r.productId,
          sku: r.sku,
          name: r.name,
          quantity: 1,
          unitPrice: finalPrice,
          originalPrice: r.unitPrice,
          winRateCurve,
          reason: `${r.reason} Suggested optimal price is $${finalPrice.toFixed(2)} (estimated win confidence: ${winRateCurve}).`
        };
      })
    );

    res.json(suggestedLineItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateQuotePdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const PDFDocument = require("pdfkit");

    const quote = await sequelize.models.Quote.findByPk(id as string, {
      include: [
        { 
          model: sequelize.models.QuoteLineItem, 
          as: "QuoteLineItems", 
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] 
        },
        { 
          model: sequelize.models.Deal, 
          as: "deal", 
          include: [{ model: sequelize.models.Lead, as: "lead" }] 
        }
      ]
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const doc = new PDFDocument({ margin: 50 });

    // Set Response Headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Quote_${(quote as any).quoteNumber || id}.pdf`
    );

    doc.pipe(res);

    // PDF Layout Styling
    doc
      .fillColor("#0f172a")
      .fontSize(20)
      .text("NEXUS CRM - QUOTATION", { align: "center" })
      .moveDown(1.5);

    // Quote Info block
    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(`Quote Number: ${(quote as any).quoteNumber || "N/A"}`)
      .text(`Version: ${(quote as any).version || 1}`)
      .text(`Date: ${new Date((quote as any).createdAt).toLocaleDateString()}`)
      .text(`Valid Until: ${(quote as any).expirationDate ? new Date((quote as any).expirationDate).toLocaleDateString() : "30 Days from Issue"}`)
      .moveDown();

    // Client details
    const lead = (quote as any).deal?.lead;
    if (lead) {
      doc
        .fontSize(12)
        .fillColor("#0f172a")
        .text("Prepared For:", { underline: true })
        .fontSize(10)
        .fillColor("#475569")
        .text(`Name: ${lead.firstName} ${lead.lastName}`)
        .text(`Company: ${lead.company || "N/A"}`)
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

    const items = (quote as any).QuoteLineItems || [];
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
    const totalAmount = Number((quote as any).totalAmount).toFixed(2);
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text(`Total Amount: $${totalAmount}`, 400, doc.y, { align: "right" });

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

