import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { checkRecordAccess } from "../services/handoffAccessService";
import { evaluateQuoteApproval, createApprovalAuditLog } from "../services/approvalEngine";
import { triggerQuoteApprovalNotifications } from "../services/notificationEngine";
import { processOpportunityEvent } from "../services/opportunityAutomationEngine";
import { deliverQuote, resolveDeliveryChannel, getQuoteContact, buildQuotePdfBuffer, recordQuoteDeliveryEvent, markQuoteAsViewed, sendFinalAgreedQuoteEmail } from "../services/quoteDeliveryService";

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
        {
          model: sequelize.models.QuoteDelivery,
          as: "deliveries",
          required: false
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
    const user = (req as any).user;

    if (dealId) {
      const access = await checkRecordAccess(user?.id, user?.role, { dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This deal has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

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

    // Verify items and calculate totals
    const rawItems = (items && items.length > 0) ? items : (req.body.lineItems && req.body.lineItems.length > 0 ? req.body.lineItems : []);
    const verifiedItems: any[] = [];
    const userId = (req as any).user?.id || "mock-user";

    if (rawItems && rawItems.length > 0) {
      for (const item of rawItems) {
        const isCustom = !!item.isCustom;
        let product: any = null;
        const catalogId = item.catalogItemId || item.productId;

        if (!isCustom && catalogId) {
          product = await sequelize.models.PriceBookEntry.findByPk(catalogId);
        }

        const requestedPrice = Number(item.unitPrice || item.totalPrice || 0);
        const minSellingPrice = product?.minSellingPrice ? Number(product.minSellingPrice) : (product?.minPrice ? Number(product.minPrice) : null);
        const qty = Number(item.quantity || 1);
        const discountPct = Number(item.discount || 0);
        const taxPct = Number(item.tax || 0);

        // Pre-tax line price after discount
        const lineSubtotal = item.totalPrice && !item.unitPrice
          ? Number(item.totalPrice)
          : qty * requestedPrice * (1 - discountPct / 100);
        const lineTaxAmount = lineSubtotal * (taxPct / 100);
        const lineTotal = lineSubtotal + lineTaxAmount;

        verifiedItems.push({
          id: require('crypto').randomUUID(),
          productId: catalogId || null,
          catalogItemId: catalogId || null,
          quantity: qty,
          unitPrice: requestedPrice,
          discount: discountPct,
          tax: taxPct,
          totalPrice: parseFloat(lineSubtotal.toFixed(2)),
          totalAmount: parseFloat(lineTotal.toFixed(2)),
          isOptional: item.isOptional || false,
          isCustom: isCustom || !catalogId,
          customDescription: isCustom ? (item.customDescription || item.description || item.nameOverride || "Custom Line Item") : null,
          description: item.description || item.nameOverride || product?.name || null,
          internalCostSnapshot: product?.internalCost ? Number(product.internalCost) : null,
          belowFloorPrice: minSellingPrice !== null && requestedPrice < minSellingPrice
        });
      }
    }

    // Exclude optional items from the main total amount, or fallback to body totalAmount
    const calculatedItemsTotal = verifiedItems
      .filter(item => !item.isOptional)
      .reduce((acc, item) => acc + item.totalPrice, 0);

    const totalAmount = calculatedItemsTotal > 0
      ? calculatedItemsTotal
      : (Number(req.body.totalAmount) || 0);

    // Initial quote creation saves as Draft or Sent directly to client
    // Internal management approval is triggered from Opportunity page after customer acceptance
    const finalStatus = status || "Sent";

    // Create quote
    const quote = await sequelize.models.Quote.create({
      id: require('crypto').randomUUID(),
      dealId,
      status: finalStatus,
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


    if ((quote as any).dealId) {
      processOpportunityEvent({
        opportunityId: (quote as any).dealId,
        type: "QuoteCreated",
        actorId: (req as any).user?.id || userId || null,
        payload: {
          quoteId: (quote as any).id,
          quoteNumber: (quote as any).quoteNumber,
          version: (quote as any).version,
          totalAmount: (quote as any).totalAmount
        }
      }).catch(err => console.warn("Opportunity event notice:", err.message));
    }


    res.status(201).json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, expirationDate, totalAmount, items, isFinalAgreed } = req.body;
    
    const quote = await sequelize.models.Quote.findByPk(String(id), {
      include: [{ model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const user = (req as any).user;
    if ((quote as any).dealId) {
      const access = await checkRecordAccess(user?.id, user?.role, { dealId: (quote as any).dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This quote's deal has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    const q = quote as any;
    const prevStatus = q.status;
    let itemsUpdated = false;

    if (isFinalAgreed !== undefined) {
      const { Op } = require("sequelize");
      q.isFinalAgreed = Boolean(isFinalAgreed);
      if (q.isFinalAgreed && q.dealId) {
        await sequelize.models.Quote.update(
          { isFinalAgreed: false },
          { where: { dealId: q.dealId, id: { [Op.ne]: id } } }
        );
      }
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      await sequelize.models.QuoteLineItem.destroy({ where: { quoteId: id } });
      const newItems = items.map((item: any) => ({
        id: require("crypto").randomUUID(),
        quoteId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        isOptional: item.isOptional || false
      }));
      await sequelize.models.QuoteLineItem.bulkCreate(newItems);
      itemsUpdated = true;
    }

    if (totalAmount !== undefined) {
      q.totalAmount = totalAmount;
    } else if (itemsUpdated) {
      const updatedLineItems: any = await sequelize.models.QuoteLineItem.findAll({ where: { quoteId: id } });
      q.totalAmount = updatedLineItems
        .filter((item: any) => !item.isOptional)
        .reduce((acc: number, item: any) => acc + Number(item.totalPrice), 0);
    }

    if (expirationDate) q.expirationDate = expirationDate;

    // Re-evaluate approval hierarchy if items or total changed
    if (itemsUpdated || totalAmount !== undefined) {
      const evaluation = await evaluateQuoteApproval(id);
      
      // Edge Case 15 & Acceptance Test 6: If quote was approved or pending approval and now requires higher level
      if (prevStatus === "Approved" || prevStatus === "Pending Approval") {
        if (evaluation.approvalRequired) {
          q.status = "Pending Approval";
          
          // Invalidate existing pending/approved approval request
          await sequelize.models.ApprovalRequest.update(
            { status: "Invalidated" },
            { where: { targetId: id, type: "Quote" } }
          );

          // Create new pending request for required approver
          await sequelize.models.ApprovalRequest.create({
            id: require("crypto").randomUUID(),
            targetId: id,
            type: "Quote",
            status: "Pending",
            requestedById: (req as any).user?.id || evaluation.salesRepId,
            assignedApproverId: evaluation.requiredApproverId,
            comments: `Re-evaluated after quote modification. ${evaluation.reason}`
          });

          await createApprovalAuditLog({
            quoteId: id,
            salesRepId: evaluation.salesRepId,
            approvalLevel: evaluation.approvalLevel,
            requiredLimit: evaluation.repLimit,
            actualQuoteValue: evaluation.quoteValue,
            discount: evaluation.discount,
            margin: evaluation.margin,
            approverId: (req as any).user?.id || null,
            decision: "Invalidated",
            comment: "Quote modified after approval request. Previous approval invalidated and new approval required.",
            previousStatus: prevStatus,
            newStatus: "Pending Approval",
            reason: evaluation.reason
          });
        }
      }
    } else if (status && status !== q.status) {
      q.status = status;
      q.statusChangedAt = new Date();
      if (status === "Accepted") {
        q.acceptedAt = new Date();
      }
    }

    await q.save();

    if (status === "Accepted" && q.dealId) {
      const deal = await sequelize.models.Deal.findByPk(q.dealId);
      if (deal) {
        const wonStage = await sequelize.models.PipelineStage.findOne({
          where: { name: "Won" }
        });
        if (wonStage) {
          await deal.update({ stageId: (wonStage as any).id });
        }
      }
    }

    res.json(q);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { channel, messageCustomization } = req.body || {};
    const userId = (req as any).user?.id;

    const result = await deliverQuote(id, {
      channel,
      userId,
      messageCustomization
    });

    res.json(result);
  } catch (error: any) {
    const statusCode = error.message?.includes("Cannot send quote") || error.message?.includes("not found") ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

export const getQuoteDeliveryPreview = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quote = await sequelize.models.Quote.findByPk(id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const { contact, leadContext } = await getQuoteContact(quote);
    const requestedChannel = typeof req.query.channel === "string" ? req.query.channel : undefined;
    const resolution = resolveDeliveryChannel(contact, requestedChannel, leadContext);

    res.json({
      quoteId: id,
      quoteNumber: (quote as any).quoteNumber,
      totalAmount: (quote as any).totalAmount,
      contact: contact ? {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        whatsappNumber: contact.whatsappNumber,
        preferredCommunicationChannel: contact.preferredCommunicationChannel,
        emailVerified: contact.emailVerified,
        whatsappVerified: contact.whatsappVerified
      } : null,
      leadContext,
      availableChannels: {
        email: Boolean(contact?.email),
        whatsapp: Boolean(contact?.whatsappNumber || contact?.phone)
      },
      recommendedChannel: resolution.channel,
      resolvedRecipient: resolution.recipient,
      resolutionReason: resolution.reason
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuoteDeliveries = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quote = await sequelize.models.Quote.findByPk(id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const deliveries = await sequelize.models.QuoteDelivery.findAll({
      where: { quoteId: id },
      order: [["occurredAt", "ASC"]]
    });

    res.json(deliveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const recordDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, channel, recipient, providerMessageId, notes } = req.body || {};

    const quote = await sequelize.models.Quote.findByPk(id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const { contact } = await getQuoteContact(quote);

    const delivery = await recordQuoteDeliveryEvent(id, {
      channel: channel || (quote as any).sentVia || "EMAIL",
      recipient: recipient || contact?.email || contact?.phone || "Recipient",
      status: status || "DELIVERED",
      providerMessageId,
      notes
    });

    res.status(201).json(delivery);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quote = await sequelize.models.Quote.findByPk(id, {
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
        { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }
      ]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    // Shared Viewed marking and QuoteDelivery history row
    await markQuoteAsViewed(quote, (quote as any).sentVia || "SECURE_LINK");

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
    const quote = await sequelize.models.Quote.findByPk(id as string);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const pdfBuffer = await buildQuotePdfBuffer(id as string);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Quote_${(quote as any).quoteNumber || id}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicQuoteByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const quote = await sequelize.models.Quote.findOne({
      where: { publicAccessToken: token },
      include: [
        {
          model: sequelize.models.QuoteLineItem,
          as: "QuoteLineItems",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        },
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            { model: sequelize.models.Lead, as: "lead" },
            { model: sequelize.models.Account, as: "account" },
            { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email"] }
          ]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ error: "Invalid quotation link. Quotation not found." });
    }

    const expiresAt = (quote as any).publicAccessExpiresAt;
    if (expiresAt && new Date() > new Date(expiresAt)) {
      return res.status(410).json({
        error: "This quotation link has expired. Please contact your sales representative for a revised proposal.",
        expired: true,
        expirationDate: expiresAt
      });
    }

    // Shared Viewed marking and QuoteDelivery history row
    await markQuoteAsViewed(quote, "CUSTOMER_SELF_SERVICE");

    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptPublicQuoteByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { acceptedByName, acceptedByEmail } = req.body || {};

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!acceptedByName || !acceptedByEmail) {
      return res.status(400).json({ error: "acceptedByName and acceptedByEmail are required for self-service confirmation" });
    }

    const quote: any = await sequelize.models.Quote.findOne({
      where: { publicAccessToken: token },
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [{ model: sequelize.models.Lead, as: "lead" }]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ error: "Invalid quotation link." });
    }

    if (quote.publicAccessExpiresAt && new Date() > new Date(quote.publicAccessExpiresAt)) {
      return res.status(410).json({
        error: "This quotation link has expired. Please contact your sales representative.",
        expired: true
      });
    }

    if (quote.status === "Accepted") {
      return res.json({ success: true, message: "Quote is already accepted.", quote });
    }

    // Set quote status to Accepted
    await quote.update({
      status: "Accepted",
      acceptedAt: new Date(),
      statusChangedAt: new Date()
    });

    // Record QuoteDelivery row with CUSTOMER_SELF_SERVICE method
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";
    await recordQuoteDeliveryEvent(quote.id, {
      channel: "CUSTOMER_SELF_SERVICE",
      recipient: acceptedByEmail,
      status: "DELIVERED",
      notes: `Accepted online by customer: ${acceptedByName} (${acceptedByEmail}) from IP ${clientIp}`
    });

    // Activity log on lead
    if (quote.deal?.leadId) {
      await sequelize.models.Activity.create({
        id: require('crypto').randomUUID(),
        leadId: quote.deal.leadId,
        type: "note",
        outcome: `Quote #${quote.quoteNumber || quote.id} accepted online by ${acceptedByName} (${acceptedByEmail}).`,
        createdById: quote.deal?.ownerId || "00000000-0000-0000-0000-000000000000",
        direction: "internal",
        pinned: true
      }).catch((err: any) => console.warn("Activity log notice:", err.message));
    }

    // Trigger Opportunity Won Automation
    if (quote.dealId) {
      try {
        const { Op } = require("sequelize");
        const wonStage = await sequelize.models.PipelineStage.findOne({
          where: { name: { [Op.like]: "%Won%" } }
        });
        if (wonStage && quote.deal) {
          await quote.deal.update({
            stageId: (wonStage as any).id,
            status: "Won",
            closedAt: new Date()
          });
        } else if (quote.deal) {
          await quote.deal.update({
            status: "Won",
            closedAt: new Date()
          });
        }
        await processOpportunityEvent({
          opportunityId: quote.dealId,
          type: "QuoteAccepted",
          payload: {
            quoteId: quote.id,
            acceptedByName,
            acceptedByEmail,
            totalAmount: quote.totalAmount
          }
        });
      } catch (oppErr: any) {
        console.warn("Opportunity won event processing note:", oppErr.message);
      }
    }

    res.json({
      success: true,
      message: "Quotation successfully accepted.",
      quote
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const requestPublicQuoteChanges = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { message, customerName, customerEmail } = req.body || {};

    if (!token) return res.status(400).json({ error: "Token is required" });

    const quote: any = await sequelize.models.Quote.findOne({
      where: { publicAccessToken: token },
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [{ model: sequelize.models.Lead, as: "lead" }]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ error: "Invalid quotation link." });
    }

    if (quote.publicAccessExpiresAt && new Date() > new Date(quote.publicAccessExpiresAt)) {
      return res.status(410).json({
        error: "This quotation link has expired. Please contact your sales representative.",
        expired: true
      });
    }

    // Set quote status to Revision Requested
    await quote.update({
      status: "Revision Requested",
      statusChangedAt: new Date()
    });

    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";
    const notesStr = message
      ? `Customer requested changes: "${message}" (${customerName || 'Customer'} - IP ${clientIp})`
      : `Customer requested quotation revision (${customerName || 'Customer'} - IP ${clientIp})`;

    await recordQuoteDeliveryEvent(quote.id, {
      channel: "CUSTOMER_SELF_SERVICE",
      recipient: customerEmail || "Customer",
      status: "DELIVERED",
      notes: notesStr
    });

    // Notify assigned sales rep
    const repId = quote.deal?.ownerId;
    if (repId) {
      await createNotification(
        repId,
        `Revision Requested: Quote #${quote.quoteNumber || quote.id}`,
        notesStr,
        `/deals/${quote.dealId}`
      ).catch((err: any) => console.warn("Notification notice:", err.message));
    }

    // Activity note on lead
    if (quote.deal?.leadId) {
      await sequelize.models.Activity.create({
        id: require('crypto').randomUUID(),
        leadId: quote.deal.leadId,
        type: "note",
        outcome: `Customer requested revision on Quote #${quote.quoteNumber || quote.id}: "${message || 'Changes requested via portal'}"`,
        createdById: repId || "00000000-0000-0000-0000-000000000000",
        direction: "internal",
        pinned: true
      }).catch((err: any) => console.warn("Activity notice:", err.message));
    }

    res.json({
      success: true,
      message: "Revision request submitted successfully.",
      quote
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const signQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signedBy } = req.body;

    const quote: any = await sequelize.models.Quote.findByPk(id as string, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    await quote.update({
      status: "Accepted",
      acceptedAt: new Date(),
      statusChangedAt: new Date()
    });

    const createdById = (req as any).user?.id || quote.deal?.ownerId || null;

    // Record QuoteDelivery row tagging method as INTERNAL_CONFIRMED
    await recordQuoteDeliveryEvent(quote.id, {
      channel: "INTERNAL_CONFIRMED",
      recipient: signedBy || "Client",
      status: "DELIVERED",
      notes: `Quote agreement confirmed internally by staff member (${signedBy || 'Staff User'})`
    });

    // Create Activity Log
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      leadId: quote.deal?.leadId || null,
      type: "note",
      outcome: `Quote ${quote.quoteNumber || id} signed / confirmed internally by ${signedBy || "Client"}.`,
      createdById: createdById,
      direction: "internal"
    }).catch((err: any) => console.warn("Activity notice:", err.message));

    res.json({ message: "Quote successfully signed via internal confirmation.", quote });
  } catch (error: any) {
    console.error("Error in signQuote:", error);
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

export const getSimilarClientQuotes = async (req: Request, res: Response) => {
  try {
    const { productIds, leadId, dealId } = req.query;
    const { Op } = require("sequelize");

    let idList: string[] = [];

    if (productIds) {
      idList = String(productIds)
        .split(",")
        .map(id => id.trim())
        .filter(Boolean);
    }

    let resolvedLeadId = leadId ? String(leadId) : null;
    let currentLeadCompany: string | null = null;

    if (dealId && !productIds) {
      const deal = await sequelize.models.Deal.findByPk(String(dealId));
      if (deal) {
        resolvedLeadId = (deal as any).leadId;
      }
    }

    if (resolvedLeadId) {
      const lead = await sequelize.models.Lead.findByPk(resolvedLeadId);
      if (lead) {
        currentLeadCompany = (lead as any).company;

        if (idList.length === 0) {
          const { suggestBundleOrItems } = require("../services/recommendationEngine");
          const recs = await suggestBundleOrItems(resolvedLeadId);
          idList = recs.map((r: any) => r.productId).filter(Boolean);
        }
      }
    }

    if (idList.length === 0) {
      return res.json([]);
    }

    // 1. Find quoteIds containing at least one of the productIds
    const matchingItems = await sequelize.models.QuoteLineItem.findAll({
      where: { productId: { [Op.in]: idList } },
      attributes: ["quoteId"],
      raw: true
    });
    const quoteIds = Array.from(new Set(matchingItems.map((item: any) => item.quoteId).filter(Boolean)));

    if (quoteIds.length === 0) {
      return res.json([]);
    }

    // 2. Fetch full quotes with all associations
    const quotes = await sequelize.models.Quote.findAll({
      where: { id: { [Op.in]: quoteIds } },
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            {
              model: sequelize.models.Lead,
              as: "lead"
            },
            {
              model: sequelize.models.User,
              as: "owner"
            }
          ]
        },
        {
          model: sequelize.models.QuoteLineItem,
          as: "QuoteLineItems",
          include: [
            {
              model: sequelize.models.PriceBookEntry,
              as: "product"
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // 3. Filter out same lead or same company quotes
    const filteredQuotes = quotes.filter((q: any) => {
      const deal = q.deal;
      const lead = deal?.lead;
      if (!lead) return true;
      if (leadId && lead.id === String(leadId)) return false;
      if (currentLeadCompany && lead.company && lead.company.toLowerCase() === currentLeadCompany.toLowerCase()) return false;
      return true;
    });

    res.json(filteredQuotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuoteById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quote = await sequelize.models.Quote.findByPk(id, {
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            { model: sequelize.models.Account, as: "account" },
            { model: sequelize.models.Lead, as: "lead" },
            { model: sequelize.models.User, as: "owner" }
          ]
        }
      ]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityQuotes = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quotes = await sequelize.models.Quote.findAll({
      where: { dealId: id },
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
        { model: sequelize.models.QuoteDelivery, as: "deliveries" }
      ],
      order: [["version", "ASC"], ["createdAt", "ASC"]]
    });
    res.json(quotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createOpportunityQuote = async (req: Request, res: Response) => {
  req.body.dealId = String(req.params.id);
  return createQuote(req, res);
};

export const createQuoteRevision = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { items, notes, discountOverride } = req.body;

    const parentQuote = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" }]
    });

    if (!parentQuote) return res.status(404).json({ error: "Parent quote not found" });
    const p = parentQuote as any;

    if (p.status === "Cancelled") {
      return res.status(400).json({ error: "Cannot create a revision from a cancelled quote." });
    }

    // Mark previous quote as Superseded
    await p.update({ status: "Superseded" });

    // Build items: either use payload items or clone from parent
    const revisionItems = (items && Array.isArray(items) && items.length > 0)
      ? items
      : (p.QuoteLineItems || []).map((li: any) => ({
          productId: li.productId,
          catalogItemId: li.catalogItemId || li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discount: discountOverride !== undefined ? discountOverride : li.discount,
          tax: li.tax,
          description: li.description,
          isOptional: li.isOptional
        }));

    req.body = {
      dealId: p.dealId,
      parentQuoteId: p.id,
      items: revisionItems,
      status: "Draft",
      notes: notes || `Revision of ${p.quoteNumber} v${p.version}`
    };

    return createQuote(req, res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { Op } = require("sequelize");
    const quote = await sequelize.models.Quote.findByPk(id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const q = quote as any;

    if (q.status === "Superseded") {
      return res.status(400).json({ error: "Cannot accept a superseded quote revision." });
    }
    if (q.status === "Cancelled") {
      return res.status(400).json({ error: "Cannot accept a cancelled quote." });
    }

    // Enforce only one Final Agreed Quote per Opportunity: Mark all other quotes for this deal as Superseded
    await sequelize.models.Quote.update(
      { status: "Superseded" },
      { where: { dealId: q.dealId, id: { [Op.ne]: id } } }
    );

    // Accept this quote
    await q.update({
      status: "Accepted",
      acceptedAt: new Date(),
      statusChangedAt: new Date()
    });

    // Process Opportunity Won Lifecycle Event through central engine
    let eventResult: any = null;
    if (q.dealId) {
      eventResult = await processOpportunityEvent({
        eventId: `quote_accepted_${q.id}`,
        opportunityId: q.dealId,
        type: "QuoteAccepted",
        actorId: (req as any).user?.id,
        payload: {
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          version: q.version,
          totalAmount: q.totalAmount
        }
      });
    }

    // Send final agreed confirmation email to client
    sendFinalAgreedQuoteEmail(q.id, { userId: (req as any).user?.id }).catch((e) =>
      console.warn("Notice: final agreed quote email dispatch note:", e.message)
    );

    res.json({
      message: "Quote accepted as final agreed quote",
      quote: q,
      opportunityResult: eventResult
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markQuoteFinalAgreed = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { Op } = require("sequelize");
    const quote = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const q = quote as any;

    if (q.status === "Superseded") {
      return res.status(400).json({ error: "Cannot mark a superseded quote as final agreed." });
    }
    if (q.status === "Cancelled") {
      return res.status(400).json({ error: "Cannot mark a cancelled quote as final agreed." });
    }

    if (q.dealId) {
      await sequelize.models.Quote.update(
        { isFinalAgreed: false },
        { where: { dealId: q.dealId, id: { [Op.ne]: id } } }
      );
    }

    await q.update({
      isFinalAgreed: true,
      statusChangedAt: new Date()
    });

    if (q.deal && q.deal.leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId: q.deal.leadId,
        type: "note",
        outcome: `Quote ${q.quoteNumber || id} (v${q.version || 1}) marked as Final Agreed Commercial Terms.`,
        createdById: (req as any).user?.id || q.deal.ownerId || null,
        direction: "internal"
      });
    }

    // Send final agreed confirmation email to client
    sendFinalAgreedQuoteEmail(q.id, { userId: (req as any).user?.id }).catch((e) =>
      console.warn("Notice: final agreed quote email dispatch note:", e.message)
    );

    res.json({ message: "Quote marked as final agreed terms", quote: q });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { reason, notes } = req.body || {};
    const quote = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const q = quote as any;

    // Mark quote status as Rejected and clear isFinalAgreed and acceptedAt
    await q.update({
      status: "Rejected",
      isFinalAgreed: false,
      acceptedAt: null,
      statusChangedAt: new Date()
    });

    // Record activity note on the deal
    const rejectionDetails = [reason, notes].filter(Boolean).join(" — ");
    if (q.dealId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        opportunityId: q.dealId,
        customerId: q.deal?.accountId || q.deal?.customerId || null,
        leadId: q.deal?.leadId || null,
        type: "note",
        outcome: `Quote ${q.quoteNumber || id} (v${q.version || 1}) was Declined / Marked Rejected${rejectionDetails ? `: ${rejectionDetails}` : "."}`,
        createdById: (req as any).user?.id || q.deal?.ownerId || null,
        direction: "internal",
        isCompleted: true
      });

      await processOpportunityEvent({
        opportunityId: q.dealId,
        type: "CustomerRejected",
        actorId: (req as any).user?.id || q.deal?.ownerId,
        payload: {
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          version: q.version,
          reason,
          notes
        }
      }).catch(e => console.warn("Opportunity event error:", e.message));
    }

    res.json({ message: "Quote marked as rejected", quote: q });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



