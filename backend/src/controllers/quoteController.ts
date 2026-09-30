import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { checkRecordAccess } from "../services/handoffAccessService";
import { evaluateQuoteApproval, createApprovalAuditLog } from "../services/approvalEngine";
import { triggerQuoteApprovalNotifications } from "../services/notificationEngine";
import { processOpportunityEvent } from "../services/opportunityAutomationEngine";
import { deliverQuote, resolveDeliveryChannel, getQuoteContact, buildQuotePdfBuffer, recordQuoteDeliveryEvent, markQuoteAsViewed, sendFinalAgreedQuoteEmail } from "../services/quoteDeliveryService";

export function formatQuoteWithTotals(quoteInput: any) {
  if (!quoteInput) return quoteInput;
  const quote = typeof quoteInput.toJSON === "function" ? quoteInput.toJSON() : { ...quoteInput };
  const items = quote.QuoteLineItems || quote.items || quote.lineItems || [];

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    if (item.isOptional) continue;
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPct = Number(item.discount || 0);
    const taxPct = Number(item.tax !== undefined && item.tax !== null ? item.tax : 0);

    const lineGross = qty * unitPrice;
    const lineSubtotal = item.totalPrice !== undefined && item.totalPrice !== null && !item.unitPrice
      ? Number(item.totalPrice)
      : lineGross * (1 - discountPct / 100);
    const lineDiscount = lineGross - lineSubtotal;
    const lineTaxAmount = lineSubtotal * (taxPct / 100);

    subtotal += lineGross;
    totalDiscount += lineDiscount;
    totalTax += lineTaxAmount;
  }

  const roundedSubtotal = parseFloat(subtotal.toFixed(2));
  const roundedTotalDiscount = parseFloat(totalDiscount.toFixed(2));
  const roundedTotalTax = parseFloat(totalTax.toFixed(2));
  const calculatedTotalAmount = parseFloat((roundedSubtotal - roundedTotalDiscount + roundedTotalTax).toFixed(2));

  const storedTotal = Number(quote.totalAmount || 0);

  quote.subtotal = roundedSubtotal;
  quote.totalDiscount = roundedTotalDiscount;
  quote.totalTax = roundedTotalTax;

  if (storedTotal > 0 && Math.abs(calculatedTotalAmount - storedTotal) > 0.01 && items.length > 0) {
    const hasUnmappedColumns = items.some((it: any) => it.discount === undefined || it.tax === undefined);
    if (hasUnmappedColumns) {
      console.warn(`[formatQuoteWithTotals] Warning: Line items for quote ${quote.id || quote.quoteNumber} have unmapped/missing columns. Preserving stored totalAmount (${storedTotal}).`);
      quote.totalAmount = storedTotal;
    } else {
      quote.totalAmount = calculatedTotalAmount;
    }
  } else {
    quote.totalAmount = calculatedTotalAmount > 0 ? calculatedTotalAmount : storedTotal;
  }

  return quote;
}

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

    if (salespersonId) {
      where["$deal.ownerId$"] = salespersonId;
    }

    if (valueBand) {
      if (valueBand === "Under 10k" || valueBand === "low") {
        where.totalAmount = { [Op.lte]: 10000 };
      } else if (valueBand === "10k-50k" || valueBand === "medium") {
        where.totalAmount = { [Op.gt]: 10000, [Op.lte]: 50000 };
      } else if (valueBand === "50k+" || valueBand === "high") {
        where.totalAmount = { [Op.gt]: 50000 };
      }
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
          model: sequelize.models.QuoteDelivery,
          as: "deliveries",
          required: false
        },
        lineItemInclude
      ],
      order: [['createdAt', 'DESC']]
    });

    let filteredQuotes = quotes;
    if (search) {
      const searchLower = String(search).toLowerCase();
      filteredQuotes = quotes.filter((q: any) => {
        const matchesNum = q.quoteNumber && q.quoteNumber.toLowerCase().includes(searchLower);
        const matchesLead = q.deal && q.deal.lead && (
          (q.deal.lead.firstName && q.deal.lead.firstName.toLowerCase().includes(searchLower)) ||
          (q.deal.lead.lastName && q.deal.lead.lastName.toLowerCase().includes(searchLower)) ||
          (q.deal.lead.company && q.deal.lead.company.toLowerCase().includes(searchLower))
        );
        return matchesNum || matchesLead;
      });
    }

    if (category) {
      filteredQuotes = filteredQuotes.filter((q: any) => {
        return q.QuoteLineItems && q.QuoteLineItems.some((li: any) => li.product);
      });
    }

    res.json(filteredQuotes.map((q: any) => formatQuoteWithTotals(q)));
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

    let accSubtotal = 0;
    let accTotalDiscount = 0;
    let accTotalTax = 0;

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
        const taxPct = Number(item.tax !== undefined && item.tax !== null ? item.tax : 0);

        const lineGross = qty * requestedPrice;
        // Pre-tax line price after discount
        const lineSubtotal = item.totalPrice && !item.unitPrice
          ? Number(item.totalPrice)
          : qty * requestedPrice * (1 - discountPct / 100);
        const lineDiscount = lineGross - lineSubtotal;
        const lineTaxAmount = lineSubtotal * (taxPct / 100);
        const lineTotal = lineSubtotal + lineTaxAmount;

        if (!item.isOptional) {
          accSubtotal += lineGross;
          accTotalDiscount += lineDiscount;
          accTotalTax += lineTaxAmount;
        }

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

    const roundedSubtotal = parseFloat(accSubtotal.toFixed(2));
    const roundedTotalDiscount = parseFloat(accTotalDiscount.toFixed(2));
    const roundedTotalTax = parseFloat(accTotalTax.toFixed(2));
    const calculatedGrandTotal = parseFloat((roundedSubtotal - roundedTotalDiscount + roundedTotalTax).toFixed(2));

    const totalAmount = calculatedGrandTotal > 0
      ? calculatedGrandTotal
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


    const responseQuote = {
      ...(quote as any).toJSON(),
      QuoteLineItems: verifiedItems,
      lineItems: verifiedItems,
      subtotal: roundedSubtotal,
      totalDiscount: roundedTotalDiscount,
      totalTax: roundedTotalTax,
      totalAmount
    };

    res.status(201).json(responseQuote);
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
      const newItems = items.map((item: any) => {
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.unitPrice || 0);
        const discountPct = Number(item.discount || 0);
        const taxPct = Number(item.tax !== undefined && item.tax !== null ? item.tax : 0);
        const catalogId = item.catalogItemId || item.productId || null;
        const isCustom = !!item.isCustom;

        const lineGross = qty * unitPrice;
        const lineSubtotal = item.totalPrice && !item.unitPrice
          ? Number(item.totalPrice)
          : lineGross * (1 - discountPct / 100);
        const lineTaxAmount = lineSubtotal * (taxPct / 100);
        const lineTotal = lineSubtotal + lineTaxAmount;

        return {
          id: require("crypto").randomUUID(),
          quoteId: id,
          productId: catalogId,
          catalogItemId: catalogId,
          quantity: qty,
          unitPrice,
          discount: discountPct,
          tax: taxPct,
          totalPrice: parseFloat(lineSubtotal.toFixed(2)),
          totalAmount: parseFloat(lineTotal.toFixed(2)),
          isOptional: item.isOptional || false,
          isCustom: isCustom || !catalogId,
          customDescription: isCustom ? (item.customDescription || item.description || item.nameOverride || "Custom Line Item") : null,
          description: item.description || item.nameOverride || null
        };
      });
      await sequelize.models.QuoteLineItem.bulkCreate(newItems);
      itemsUpdated = true;
    }

    if (totalAmount !== undefined) {
      q.totalAmount = totalAmount;
    } else if (itemsUpdated) {
      const updatedLineItems: any = await sequelize.models.QuoteLineItem.findAll({ where: { quoteId: id } });
      let accSubtotal = 0;
      let accTotalDiscount = 0;
      let accTotalTax = 0;

      for (const item of updatedLineItems) {
        if (item.isOptional) continue;
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.unitPrice || 0);
        const discountPct = Number(item.discount || 0);
        const taxPct = Number(item.tax || 0);

        const lineGross = qty * unitPrice;
        const lineSubtotal = Number(item.totalPrice || (lineGross * (1 - discountPct / 100)));
        const lineDiscount = lineGross - lineSubtotal;
        const lineTaxAmount = lineSubtotal * (taxPct / 100);

        accSubtotal += lineGross;
        accTotalDiscount += lineDiscount;
        accTotalTax += lineTaxAmount;
      }

      q.totalAmount = parseFloat((accSubtotal - accTotalDiscount + accTotalTax).toFixed(2));
    }

    if (expirationDate) q.expirationDate = expirationDate;

    // Re-evaluate approval hierarchy if items or total changed (strictly financial edits)
    if (itemsUpdated || totalAmount !== undefined) {
      const evaluation = await evaluateQuoteApproval(id);
      
      const existingPendingReq: any = await sequelize.models.ApprovalRequest.findOne({
        where: { targetId: id, type: "Quote", status: ["Pending", "Approved"] }
      });

      if (existingPendingReq || prevStatus === "Approved" || prevStatus === "Pending Approval") {
        // Invalidate existing pending/approved approval request
        await sequelize.models.ApprovalRequest.update(
          { status: "Invalidated" },
          { where: { targetId: id, type: "Quote", status: ["Pending", "Approved"] } }
        );

        if (evaluation.approvalRequired) {
          q.status = "Pending Approval";
          
          // Create new pending request for required approver
          await sequelize.models.ApprovalRequest.create({
            id: require("crypto").randomUUID(),
            targetId: id,
            type: "Quote",
            status: "Pending",
            requestedById: (req as any).user?.id || evaluation.salesRepId,
            assignedApproverId: evaluation.requiredApproverId,
            comments: `Re-evaluated after quote pricing modification. ${evaluation.reason}`
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
            comment: "Quote financial terms modified after escalation. Previous approval invalidated and new approval required.",
            previousStatus: prevStatus,
            newStatus: "Pending Approval",
            reason: evaluation.reason
          });
        } else {
          if (q.status === "Pending Approval") {
            q.status = "Draft";
          }
          await createApprovalAuditLog({
            quoteId: id,
            salesRepId: evaluation.salesRepId,
            approvalLevel: "NONE",
            requiredLimit: evaluation.repLimit,
            actualQuoteValue: evaluation.quoteValue,
            discount: evaluation.discount,
            margin: evaluation.margin,
            approverId: null,
            decision: "Invalidated",
            comment: "Quote financial terms modified to within rep limit. Previous approval request invalidated.",
            previousStatus: prevStatus,
            newStatus: q.status,
            reason: "Modified within limit"
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

    res.json(formatQuoteWithTotals(q));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { channel, messageCustomization, cc } = req.body || {};
    const userId = (req as any).user?.id;

    // Validate CC entries if provided
    if (cc !== undefined && cc !== null) {
      if (!Array.isArray(cc)) {
        return res.status(400).json({ error: "cc must be an array of email addresses" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = (cc as any[]).filter((addr) => typeof addr !== "string" || !emailRegex.test(addr.trim()));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `Invalid email address(es) in cc: ${invalid.join(", ")}. Please provide valid email addresses.`
        });
      }
    }

    const validatedCc: string[] | undefined = Array.isArray(cc) && cc.length > 0
      ? (cc as string[]).map((a) => a.trim())
      : undefined;

    const result = await deliverQuote(id, {
      channel,
      userId,
      messageCustomization,
      cc: validatedCc
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

    res.json(formatQuoteWithTotals(quote));
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

    res.json(formatQuoteWithTotals(quote));
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

    if (!quote.isFinalAgreed) {
      return res.status(400).json({
        error: "This quotation is preliminary and not yet valid for formal acceptance. Please wait for the confirmed final quotation."
      });
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
    res.json(formatQuoteWithTotals(quote));
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
    res.json(quotes.map((q: any) => formatQuoteWithTotals(q)));
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
    if (!q.isFinalAgreed) {
      return res.status(400).json({ error: "This quotation is preliminary and not yet valid for formal acceptance. Please wait for the confirmed final quotation." });
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

    // Evaluate approval range requirements
    const authUser = (req as any).user;
    const evaluation = await evaluateQuoteApproval(id, authUser ? { salesRepId: authUser.id } : undefined);

    if (evaluation.approvalRequired) {
      // OUTSIDE RANGE — Do NOT send to customer yet. Hold for manager approval.
      const prevStatus = q.status;
      await q.update({
        status: "Pending Approval",
        isFinalAgreed: false,
        statusChangedAt: new Date()
      });

      // Find or create pending ApprovalRequest
      let approvalReq: any = await sequelize.models.ApprovalRequest.findOne({
        where: { targetId: id, type: "Quote", status: "Pending" }
      });

      if (!approvalReq) {
        approvalReq = await sequelize.models.ApprovalRequest.create({
          id: require("crypto").randomUUID(),
          targetId: id,
          type: "Quote",
          status: "Pending",
          requestedById: authUser?.id || evaluation.salesRepId,
          assignedApproverId: evaluation.requiredApproverId,
          comments: evaluation.reason
        });
      } else {
        await approvalReq.update({
          assignedApproverId: evaluation.requiredApproverId,
          comments: evaluation.reason
        });
      }

      // Create Audit Log
      await createApprovalAuditLog({
        quoteId: id,
        salesRepId: evaluation.salesRepId,
        approvalLevel: evaluation.approvalLevel,
        requiredLimit: evaluation.approvalLevel === "TEAM_LEAD" ? evaluation.repLimit : evaluation.teamLeadLimit,
        actualQuoteValue: evaluation.quoteValue,
        discount: evaluation.discount,
        margin: evaluation.margin,
        approverId: evaluation.requiredApproverId,
        decision: "Submitted",
        comment: evaluation.reason,
        previousStatus: prevStatus,
        newStatus: "Pending Approval",
        reason: evaluation.reason
      });

      // Find manager's name for rep UI feedback
      let managerName = "your manager";
      if (evaluation.requiredApproverId) {
        const mgr: any = await sequelize.models.User.findByPk(evaluation.requiredApproverId);
        if (mgr && mgr.name) managerName = mgr.name;

        await createNotification(
          evaluation.requiredApproverId,
          "alert",
          "Quote Approval Required",
          `Quotation ${q.quoteNumber || id} requires your ${evaluation.approvalLevel.replace("_", " ")} approval: ${evaluation.reason}`,
          "/approvals"
        );
      }

      return res.json({
        approvalRequired: true,
        message: `This exceeds your approval limit (${evaluation.reason}) and has been sent to ${managerName} for approval. You'll be notified once it's approved and sent to the customer.`,
        evaluation,
        requiredApproverName: managerName,
        quote: formatQuoteWithTotals(q)
      });
    }

    // WITHIN RANGE — Mark as Final Agreed & deliver binding quote to customer immediately
    if (q.dealId) {
      await sequelize.models.Quote.update(
        { isFinalAgreed: false },
        { where: { dealId: q.dealId, id: { [Op.ne]: id } } }
      );
    }

    await q.update({
      isFinalAgreed: true,
      status: "Approved",
      statusChangedAt: new Date()
    });

    if (q.deal && q.deal.leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId: q.deal.leadId,
        type: "note",
        outcome: `Quote ${q.quoteNumber || id} (v${q.version || 1}) marked as Final Agreed Commercial Terms.`,
        createdById: authUser?.id || q.deal.ownerId || null,
        direction: "internal"
      }).catch((err: any) => console.warn("Activity log notice:", err.message));
    }

    // Auto-deliver final agreed quote email with binding acceptance button
    let deliveryResult: any = null;
    try {
      deliveryResult = await deliverQuote(id, { channel: "EMAIL", userId: authUser?.id });
    } catch (deliverErr: any) {
      console.warn("Delivery of final agreed quote failed:", deliverErr.message);
    }

    res.json({
      approvalRequired: false,
      message: "Quotation marked as final agreed terms and delivered to customer.",
      quote: formatQuoteWithTotals(q),
      deliveryResult
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { rejectionReason, reason, notes } = req.body || {};
    const finalReason = (rejectionReason || reason || "").trim();

    if (!finalReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const quote = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const q = quote as any;

    // Check handoff view-only permissions
    const user = (req as any).user;
    if (q.dealId) {
      const access = await checkRecordAccess(user?.id, user?.role, { dealId: q.dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This quote's deal has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    const userId = user?.id || null;
    const now = new Date();

    // Mark quote status as Rejected and record rejection fields
    await q.update({
      status: "Rejected",
      rejectionReason: finalReason,
      rejectedByUserId: userId,
      rejectedAt: now,
      isFinalAgreed: false,
      acceptedAt: null,
      statusChangedAt: now
    });

    // Fetch updated quote with rejectedByUser included
    const updatedQuote = await sequelize.models.Quote.findByPk(id, {
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
        { model: sequelize.models.User, as: "rejectedByUser", attributes: ["id", "name", "email"] },
        { model: sequelize.models.Deal, as: "deal" }
      ]
    });

    // Record activity note on the deal
    if (q.dealId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        opportunityId: q.dealId,
        customerId: q.deal?.accountId || q.deal?.customerId || null,
        leadId: q.deal?.leadId || null,
        type: "note",
        outcome: `Quote ${q.quoteNumber || id} (v${q.version || 1}) was Marked Rejected: ${finalReason}`,
        createdById: userId || q.deal?.ownerId || null,
        direction: "internal",
        isCompleted: true
      });

      await processOpportunityEvent({
        opportunityId: q.dealId,
        type: "CustomerRejected",
        actorId: userId || q.deal?.ownerId,
        payload: {
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          version: q.version,
          reason: finalReason,
          notes
        }
      }).catch(e => console.warn("Opportunity event error:", e.message));
    }

    res.json({
      message: "Quote marked as rejected",
      quote: formatQuoteWithTotals(updatedQuote || q)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const expressPublicQuoteInterest = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const quote: any = await sequelize.models.Quote.findOne({
      where: { publicAccessToken: token },
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            { model: sequelize.models.Lead, as: "lead" },
            { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email"] }
          ]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ error: "Invalid quotation link. Quotation not found." });
    }

    if (quote.publicAccessExpiresAt && new Date() > new Date(quote.publicAccessExpiresAt)) {
      return res.status(410).json({
        error: "This quotation link has expired. Please contact your sales representative for a revised proposal.",
        expired: true
      });
    }

    // IDEMPOTENCY CHECK:
    // If interest was already expressed or quote is currently Pending Approval, do not duplicate requests or notifications
    const existingPendingReq = await sequelize.models.ApprovalRequest.findOne({
      where: { targetId: quote.id, type: "Quote", status: "Pending" }
    });

    if (quote.status === "Pending Approval" || existingPendingReq) {
      const repName = quote.deal?.owner?.name || "your sales representative";
      return res.json({
        success: true,
        alreadyExpressed: true,
        message: `Thank you! You've already expressed interest in this quotation. ${repName} will follow up shortly with your confirmed final proposal.`
      });
    }

    // Evaluate approval requirements against rep limits
    const evaluation = await evaluateQuoteApproval(quote.id);
    const repId = evaluation.salesRepId || quote.deal?.ownerId;
    const repName = quote.deal?.owner?.name || "your sales representative";
    const quoteNumber = quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`;

    // CASE A: WITHIN REP LIMIT -> NO ESCALATION NEEDED
    if (!evaluation.approvalRequired) {
      await createApprovalAuditLog({
        quoteId: quote.id,
        salesRepId: repId,
        approvalLevel: "NONE",
        requiredLimit: evaluation.repLimit,
        actualQuoteValue: evaluation.quoteValue,
        discount: evaluation.discount,
        margin: evaluation.margin,
        approverId: null,
        decision: "Customer Interest Expressed",
        comment: `Customer expressed interest on preliminary quote #${quoteNumber}. Within rep limit — ready to finalize.`,
        previousStatus: quote.status,
        newStatus: quote.status,
        reason: "Customer expressed interest"
      });

      if (repId) {
        await createNotification(
          repId,
          "info",
          "Customer Expressed Interest",
          `Customer expressed interest in quotation ${quoteNumber} — ready to finalize.`,
          quote.dealId ? `/opportunities/${quote.dealId}` : "/quotes"
        );
      }

      return res.json({
        success: true,
        escalated: false,
        message: `Thank you! We've notified ${repName}, they'll be in touch with your confirmed proposal.`
      });
    }

    // CASE B: ABOVE REP LIMIT -> AUTO-ESCALATE TO TEAM LEAD
    const prevStatus = quote.status;
    await quote.update({
      status: "Pending Approval",
      statusChangedAt: new Date()
    });

    const approvalReq = await sequelize.models.ApprovalRequest.create({
      id: require("crypto").randomUUID(),
      targetId: quote.id,
      type: "Quote",
      status: "Pending",
      requestedById: repId,
      assignedApproverId: evaluation.requiredApproverId,
      comments: `Customer expressed interest on preliminary quote #${quoteNumber}. Auto-escalated for approval: ${evaluation.reason}`
    });

    await createApprovalAuditLog({
      quoteId: quote.id,
      salesRepId: repId,
      approvalLevel: evaluation.approvalLevel,
      requiredLimit: evaluation.approvalLevel === "TEAM_LEAD" ? evaluation.repLimit : evaluation.teamLeadLimit,
      actualQuoteValue: evaluation.quoteValue,
      discount: evaluation.discount,
      margin: evaluation.margin,
      approverId: evaluation.requiredApproverId,
      decision: "Submitted",
      comment: `Customer expressed interest on preliminary quote #${quoteNumber}. Auto-escalated for approval: ${evaluation.reason}`,
      previousStatus: prevStatus,
      newStatus: "Pending Approval",
      reason: evaluation.reason
    });

    // Notify Approver (Team Lead)
    if (evaluation.requiredApproverId) {
      await createNotification(
        evaluation.requiredApproverId,
        "alert",
        "Quote Approval Required",
        `Quotation ${quoteNumber} requires your ${evaluation.approvalLevel.replace("_", " ")} approval: ${evaluation.reason}`,
        "/approvals"
      );
    }

    // Get Approver Name for Rep Notification
    let approverName = "Team Lead";
    if (evaluation.requiredApproverId) {
      const approverUser: any = await sequelize.models.User.findByPk(evaluation.requiredApproverId);
      if (approverUser?.name) approverName = approverUser.name;
    }

    // Notify Quote Rep
    if (repId) {
      await createNotification(
        repId,
        "alert",
        "Customer Interest - Auto-Escalated",
        `Customer expressed interest in quotation ${quoteNumber} — sent to ${approverName} for approval since it exceeds your limit.`,
        quote.dealId ? `/opportunities/${quote.dealId}` : "/quotes"
      );
    }

    res.json({
      success: true,
      escalated: true,
      approvalRequestId: (approvalReq as any).id,
      message: `Thank you! We've notified ${repName}, they'll be in touch with your confirmed proposal.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
