import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getQuotes = async (req: Request, res: Response) => {
  try {
    const { search, status, startDate, endDate, salespersonId, category, valueBand } = req.query;
    const { Op } = require("sequelize");

    const where: any = {};
    if (status && status !== "All Statuses" && status !== "All") {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    if (valueBand) {
      if (valueBand === "low") {
        where.totalAmount = { [Op.lte]: 10000 };
      } else if (valueBand === "medium") {
        where.totalAmount = { [Op.gt]: 10000, [Op.lte]: 50000 };
      } else if (valueBand === "high") {
        where.totalAmount = { [Op.gt]: 50000 };
      }
    }

    const dealWhere: any = {};
    if (salespersonId) {
      dealWhere.ownerId = salespersonId;
    }

    const leadWhere: any = {};
    if (search) {
      const searchStr = `%${search}%`;
      leadWhere[Op.or] = [
        { firstName: { [Op.like]: searchStr } },
        { lastName: { [Op.like]: searchStr } },
        { company: { [Op.like]: searchStr } }
      ];
    }

    const lineItemInclude: any = {
      model: sequelize.models.QuoteLineItem,
      as: "QuoteLineItems",
      include: []
    };

    if (category) {
      lineItemInclude.include.push({
        model: sequelize.models.PriceBookEntry,
        as: "product",
        where: { category }
      });
    } else {
      lineItemInclude.include.push({
        model: sequelize.models.PriceBookEntry,
        as: "product"
      });
    }

    const quotes = await sequelize.models.Quote.findAll({
      where,
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          where: Object.keys(dealWhere).length > 0 ? dealWhere : undefined,
          include: [
            {
              model: sequelize.models.Lead,
              as: "lead",
              where: Object.keys(leadWhere).length > 0 ? leadWhere : undefined
            },
            {
              model: sequelize.models.User,
              as: "owner"
            }
          ]
        },
        lineItemInclude
      ],
      order: [['createdAt', 'DESC']]
    });

    // If search term was provided but matched the quoteNumber itself, or if we need to filter:
    let filteredQuotes = quotes;
    if (search) {
      const searchLower = String(search).toLowerCase();
      filteredQuotes = quotes.filter((q: any) => {
        const matchesNum = q.quoteNumber && q.quoteNumber.toLowerCase().includes(searchLower);
        const matchesLead = q.deal && q.deal.lead;
        return matchesNum || matchesLead;
      });
    }

    if (category) {
      filteredQuotes = filteredQuotes.filter((q: any) => {
        return q.QuoteLineItems && q.QuoteLineItems.some((li: any) => li.product);
      });
    }

    res.json(filteredQuotes);
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

    // Fetch associated deal and lead to check strategic account status
    const deal = await sequelize.models.Deal.findByPk(dealId, {
      include: [{ model: sequelize.models.Lead, as: "lead" }]
    });
    const isStrategic = deal && (deal as any).lead && (deal as any).lead.isStrategic;

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
          totalPrice: item.quantity * requestedPrice,
          isOptional: item.isOptional || false
        });
      }
    }

    // Bypass approval if it's a strategic account
    if (isStrategic) {
      approvalRequired = false;
    }

    // Exclude optional items from the main total amount
    const totalAmount = verifiedItems
      .filter(item => !item.isOptional)
      .reduce((acc, item) => acc + item.totalPrice, 0);

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
      let assignedApproverId = null;
      let commentsExtra = "";
      
      const manager = await sequelize.models.User.findOne({ where: { role: "sales_manager" } });
      if (manager) {
        assignedApproverId = (manager as any).id;
        if ((manager as any).onLeave && (manager as any).delegatedUserId) {
          assignedApproverId = (manager as any).delegatedUserId;
          commentsExtra = ` (Delegated from ${(manager as any).name} due to leave)`;
        }
      }

      await sequelize.models.ApprovalRequest.create({
        id: require('crypto').randomUUID(),
        targetId: (quote as any).id,
        type: "Quote",
        status: "Pending",
        requestedById: userId,
        assignedApproverId,
        comments: `Discount limit of ${maxAllowedDiscount}% exceeded by ${userRole}.${commentsExtra}`
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

    const deal = await sequelize.models.Deal.findByPk((quote as any).dealId);
    if (deal && (deal as any).leadId) {
      await sequelize.models.Activity.create({
        id: require('crypto').randomUUID(),
        leadId: (deal as any).leadId,
        type: "note",
        outcome: `Quote ${(quote as any).quoteNumber || (quote as any).id} Sent`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: (req as any).user?.id || "mock-user"
      });
      // Feature 13 trigger: Send Quote Sent email notification
      const { triggerCommunication } = require("../services/communicationService");
      await triggerCommunication("quote_sent", {
        leadId: (deal as any).leadId,
        salespersonId: (req as any).user?.id || (deal as any).ownerId,
        quoteValue: (quote as any).totalAmount
      });
    }

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

      if ((quote as any).deal?.leadId) {
        await sequelize.models.Activity.create({
          id: require('crypto').randomUUID(),
          leadId: (quote as any).deal.leadId,
          type: "note",
          outcome: `Quote ${(quote as any).quoteNumber || (quote as any).id} Viewed by Client`,
          mentioned_user_ids: "[]",
          pinned: false,
          createdById: "system"
        });
      }
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

export const signQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signedBy } = req.body;

    const quote = await sequelize.models.Quote.findByPk(id as string, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    await quote.update({
      status: "Accepted",
      acceptedAt: new Date()
    });

    // Create Activity Log
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      leadId: (quote as any).deal?.leadId || null,
      type: "note",
      outcome: `Quote ${(quote as any).quoteNumber} signed via simulated DocuSign by ${signedBy || "Client"}.`,
      createdById: (req as any).user?.id || "mock-user"
    });

    res.json({ message: "Quote successfully signed via DocuSign simulation.", quote });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuoteHistoryByClient = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(leadId));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const { Op } = require("sequelize");
    const matchConditions: any[] = [{ id: leadId }];
    if ((lead as any).company) {
      matchConditions.push({ company: { [Op.like]: (lead as any).company } });
    }
    if ((lead as any).email) {
      matchConditions.push({ email: { [Op.like]: (lead as any).email } });
    }

    const leads = await sequelize.models.Lead.findAll({
      where: { [Op.or]: matchConditions }
    });
    const leadIds = leads.map((l: any) => l.id);

    const quotes = await sequelize.models.Quote.findAll({
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          where: { leadId: { [Op.in]: leadIds } },
          include: [
            { model: sequelize.models.User, as: "owner" },
            { model: sequelize.models.Lead, as: "lead" }
          ]
        },
        {
          model: sequelize.models.QuoteLineItem,
          as: "QuoteLineItems",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(quotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSimilarQuotesStats = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { leadId } = req.query;
    const { Op } = require("sequelize");

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const lead = leadId ? await sequelize.models.Lead.findByPk(leadId as string) : null;
    const industry = lead ? (lead as any).industry : null;

    const product = await sequelize.models.PriceBookEntry.findByPk(productId as string);
    const floorPrice = product ? Number((product as any).minPrice || 0) : 0;

    const items = await sequelize.models.QuoteLineItem.findAll({
      where: { productId },
      include: [
        {
          model: sequelize.models.PriceBookEntry,
          as: "product"
        },
        {
          model: sequelize.models.Quote,
          as: "quote",
          where: {
            status: "Accepted",
            createdAt: { [Op.gte]: twelveMonthsAgo }
          },
          include: [
            {
              model: sequelize.models.Deal,
              as: "deal",
              include: [{ model: sequelize.models.Lead, as: "lead" }]
            }
          ]
        }
      ]
    });

    let filteredItems = items;
    if (industry) {
      filteredItems = items.filter((item: any) => {
        const itemIndustry = item.quote?.deal?.lead?.industry;
        return itemIndustry && itemIndustry.toLowerCase() === industry.toLowerCase();
      });
    }

    if (filteredItems.length === 0) {
      filteredItems = items;
    }

    if (filteredItems.length === 0) {
      return res.json({ min: 0, median: 0, max: 0, count: 0, floorPrice, quotes: [] });
    }

    const prices = filteredItems.map((item: any) => Number(item.unitPrice)).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    
    const half = Math.floor(prices.length / 2);
    const median = prices.length % 2 !== 0 
      ? prices[half] 
      : (prices[half - 1] + prices[half]) / 2;

    const quotesMap: Record<string, any> = {};
    for (const item of filteredItems as any[]) {
      const q = item.quote;
      if (!q) continue;
      const quoteId = q.id;
      if (!quotesMap[quoteId]) {
        const leadVal = q.deal?.lead;
        quotesMap[quoteId] = {
          quoteId,
          quoteNumber: q.quoteNumber,
          companyName: leadVal ? (leadVal.company || leadVal.name || "N/A") : "N/A",
          status: q.status,
          totalAmount: Number(q.totalAmount),
          createdAt: q.createdAt,
          requestedItems: []
        };
      }
      quotesMap[quoteId].requestedItems.push({
        productName: item.product?.name || "Product Details",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0)
      });
    }
    const quotesList = Object.values(quotesMap);

    res.json({ min, median, max, count: prices.length, floorPrice, quotes: quotesList });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

