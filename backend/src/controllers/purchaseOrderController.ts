import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { triggerTemplatedEmail } from "../services/emailService";

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { search, salespersonId, startDate, endDate, valueBand, status } = req.query;
    const { Op } = require("sequelize");

    const where: any = {};

    if (status && status !== "All Statuses" && status !== "All" && status !== "ALL") {
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
        where.amount = { [Op.lte]: 10000 };
      } else if (valueBand === "medium") {
        where.amount = { [Op.gt]: 10000, [Op.lte]: 50000 };
      } else if (valueBand === "high") {
        where.amount = { [Op.gt]: 50000 };
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

    const pos = await sequelize.models.PurchaseOrder.findAll({
      where,
      include: [
        { 
          model: sequelize.models.Quote, 
          as: "quote", 
          include: [{ 
            model: sequelize.models.Deal, 
            as: "deal",
            where: Object.keys(dealWhere).length > 0 ? dealWhere : undefined,
            include: [
              {
                model: sequelize.models.Lead,
                as: "lead",
                where: Object.keys(leadWhere).length > 0 ? leadWhere : undefined
              },
              { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role"] }
            ] 
          }] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // If search matched PO number directly
    let filteredPos = pos;
    if (search) {
      const searchLower = String(search).toLowerCase();
      filteredPos = pos.filter((p: any) => {
        const matchesPO = p.poNumber && p.poNumber.toLowerCase().includes(searchLower);
        const matchesLead = p.quote?.deal?.lead;
        return matchesPO || matchesLead;
      });
    }

    res.json(filteredPos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { quoteId, amount, poNumber } = req.body;

    if (!quoteId || !amount || !poNumber) {
      return res.status(400).json({ error: "quoteId, amount, and poNumber are required." });
    }

    // Reconciliation Check: Compare PO value with the accepted Quote value
    const quote = await sequelize.models.Quote.findByPk(quoteId, {
      include: [{ 
        model: sequelize.models.Deal, 
        as: "deal",
        include: [
          { model: sequelize.models.Lead, as: "lead" },
          { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role"] }
        ]
      }]
    });

    if (!quote) return res.status(404).json({ error: "Quote not found." });

    const quotedTotal = Number((quote as any).totalAmount || 0);
    const receivedAmount = Number(amount);
    const mismatch = quotedTotal !== receivedAmount;

    // Create PO with Pending Approval status
    const purchaseOrder: any = await sequelize.models.PurchaseOrder.create({
      id: require('crypto').randomUUID(),
      quoteId,
      amount: receivedAmount,
      poNumber,
      status: mismatch ? "Flagged/Mismatch" : "Pending Approval",
      generatedDate: new Date()
    });

    const deal = (quote as any).deal;
    const ownerId = deal?.ownerId;
    let ownerUser: any = null;
    if (ownerId) {
      ownerUser = await sequelize.models.User.findByPk(ownerId);
    }

    // Create formal Approval Request for the Purchase Order
    await sequelize.models.ApprovalRequest.create({
      id: require('crypto').randomUUID(),
      targetId: purchaseOrder.id,
      type: "PurchaseOrder",
      status: "Pending",
      requestedById: (req as any).user?.id || ownerId || null,
      assignedApproverId: (ownerUser as any)?.managerId || null,
      comments: mismatch
        ? `PO #${poNumber} received with AMOUNT MISMATCH (Quoted: SAR ${quotedTotal.toLocaleString()} vs PO: SAR ${receivedAmount.toLocaleString()}). Manager approval and reconciliation required.`
        : `Customer PO #${poNumber} received for SAR ${receivedAmount.toLocaleString()} against Quote #${(quote as any).quoteNumber || quoteId}. Manager approval and sign-off required.`
    });

    // Notifications: Mismatch flags vs Standard acceptance
    if (mismatch) {
      // 1. Notify the Deal Owner
      if (ownerId) {
        await createNotification(
          ownerId,
          'alert',
          'PO Reconciliation Mismatch',
          `PO #${poNumber} received for "${deal?.name || 'Deal'}" has an amount mismatch: Quoted SAR ${quotedTotal.toLocaleString()} vs Received SAR ${receivedAmount.toLocaleString()}. Manager review required.`,
          `/purchase-orders`
        );
      }

      // 2. Notify the Owner's Manager or Manager Pool
      let managerNotified = false;
      if (ownerUser && ownerUser.managerId) {
        await createNotification(
          ownerUser.managerId,
          'alert',
          'PO Reconciliation Mismatch Flagged',
          `Rep ${ownerUser.name}'s deal "${deal?.name || 'Deal'}" received PO #${poNumber} with amount mismatch: Quoted SAR ${quotedTotal.toLocaleString()} vs Received SAR ${receivedAmount.toLocaleString()}. Action required.`,
          `/purchase-orders`
        );
        managerNotified = true;
      }

      if (!managerNotified) {
        const managers: any = await sequelize.models.User.findAll({
          where: { role: "MANAGER", isAvailable: true },
          limit: 3
        });
        for (const mgr of managers) {
          await createNotification(
            mgr.id,
            'alert',
            'PO Reconciliation Mismatch Flagged',
            `Deal "${deal?.name || 'Deal'}" received PO #${poNumber} with amount mismatch: Quoted SAR ${quotedTotal.toLocaleString()} vs Received SAR ${receivedAmount.toLocaleString()}. Action required.`,
            `/purchase-orders`
          );
        }
      }
    } else {
      // Standard match notification to owner
      if (ownerId) {
        await createNotification(
          ownerId,
          'info',
          'Purchase Order Accepted',
          `PO #${poNumber} was created for your deal "${deal?.name}". Value matched SAR ${receivedAmount.toLocaleString()} and deal was marked Won.`,
          `/purchase-orders`
        );
      }
    }

    // 3. PO THANK-YOU AUTOMATION (Acknowledging receipt of customer PO documentation)
    const lead = deal?.lead;
    if (lead && lead.email) {
      triggerTemplatedEmail("po_thank_you", lead.email, {
        lead_name: lead.firstName || 'there',
        company_name: lead.company || "your company",
        po_number: poNumber,
        sender_company_name: process.env.COMPANY_NAME || "Our Company"
      }, lead.id).catch(err => console.error("Failed to send PO Thank You email", err));
    }

    // 4. DEAL STAGE AUTOMATION:
    // Deal is NOT marked Won at PO creation. It is marked Won when the manager
    // approves the PO in the Approval Queue (approvalController.ts updateApproval).
    if (deal) {

      if (deal.leadId) {
        const callerId = (req as any).user?.id;
        let activityUserId: string | null = deal.ownerId || null;
        if (callerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callerId)) {
          const exists = await sequelize.models.User.findByPk(callerId);
          if (exists) activityUserId = callerId;
        }

        await sequelize.models.Activity.create({
          id: require('crypto').randomUUID(),
          leadId: deal.leadId,
          type: "note",
          outcome: mismatch
            ? `Purchase Order Received with MISMATCH: ${poNumber} (Quoted: SAR ${quotedTotal.toLocaleString()} vs Received: SAR ${receivedAmount.toLocaleString()}) - Status: Flagged/Mismatch. Pending manager review.`
            : `Purchase Order Received: ${poNumber} (Amount: SAR ${receivedAmount.toLocaleString()}) - Status: Pending Approval. Awaiting manager sign-off to mark deal Won.`,
          mentioned_user_ids: "[]",
          pinned: false,
          createdById: activityUserId,
          direction: "internal"
        });
        
        // Feature 13 trigger: Send PO Received communication
        try {
          const { triggerCommunication } = require("../services/communicationService");
          await triggerCommunication("po_received", {
            leadId: deal.leadId,
            salespersonId: deal.ownerId,
            quoteValue: receivedAmount
          });
        } catch (commErr) {
          console.warn("PO Received communication trigger notice:", commErr);
        }
      }
    }

    res.status(201).json({ purchaseOrder, mismatch });
  } catch (error: any) {
    console.error("createPurchaseOrder error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const resolvePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { action, resolutionNotes, lossReason, lossNotes } = req.body;
    const userId = (req as any).user?.id;

    if (!action || (action !== "CONFIRM_ANYWAY" && action !== "REJECT_LOST")) {
      return res.status(400).json({ error: "Invalid action. Must be 'CONFIRM_ANYWAY' or 'REJECT_LOST'." });
    }

    const purchaseOrder: any = await sequelize.models.PurchaseOrder.findByPk(id, {
      include: [
        {
          model: sequelize.models.Quote,
          as: "quote",
          include: [
            {
              model: sequelize.models.Deal,
              as: "deal",
              include: [
                { model: sequelize.models.Lead, as: "lead" },
                { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role"] }
              ]
            }
          ]
        }
      ]
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase Order not found." });
    }

    const deal = purchaseOrder.quote?.deal;
    const poNumber = purchaseOrder.poNumber || id;
    const quotedAmount = Number(purchaseOrder.quote?.totalAmount || 0);
    const receivedAmount = Number(purchaseOrder.amount || 0);

    if (action === "CONFIRM_ANYWAY") {
      // 1. Update PO Status to Accepted
      await purchaseOrder.update({
        status: "Accepted",
        notes: resolutionNotes || "Confirmed despite amount mismatch."
      });

      // 2. Move Deal to Won
      if (deal) {
        const wonStage: any = await sequelize.models.PipelineStage.findOne({
          where: { name: "Won" }
        }) || await sequelize.models.PipelineStage.findOne({
          order: [["order", "DESC"]]
        });

        if (wonStage) {
          await deal.update({
            stageId: wonStage.id,
            status: "WON"
          });
        }

        // 3. Create Activity Note
        if (deal.leadId) {
          let activityUserId: string | null = deal.ownerId || null;
          if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            const exists = await sequelize.models.User.findByPk(userId);
            if (exists) activityUserId = userId;
          }

          await sequelize.models.Activity.create({
            id: require("crypto").randomUUID(),
            leadId: deal.leadId,
            type: "note",
            outcome: `Purchase Order #${poNumber} mismatch manually resolved & accepted (Quoted: SAR ${quotedAmount.toLocaleString()}, Received: SAR ${receivedAmount.toLocaleString()}). Deal moved to Won. Rationale: ${resolutionNotes || "Acceptable commercial variance."}`,
            mentioned_user_ids: "[]",
            pinned: false,
            createdById: activityUserId,
            direction: "internal"
          });
        }

        // 4. Notify Owner
        if (deal.ownerId) {
          await createNotification(
            deal.ownerId,
            "info",
            "PO Mismatch Resolved — Deal Won",
            `PO #${poNumber} for deal "${deal.name}" was manually confirmed despite amount mismatch. Deal marked Won.`,
            `/purchase-orders`
          );
        }
      }

      return res.json({
        message: "Purchase Order confirmed despite mismatch. Linked deal moved to Won.",
        purchaseOrder
      });
    } else if (action === "REJECT_LOST") {
      if (!lossReason || !String(lossReason).trim()) {
        return res.status(400).json({ error: "Loss reason is required when rejecting a PO and marking deal as Lost." });
      }

      // 1. Update PO Status to Rejected
      await purchaseOrder.update({
        status: "Rejected",
        notes: resolutionNotes || `PO rejected. Reason: ${lossReason}`
      });

      // 2. Move Deal to Lost
      if (deal) {
        const lostStage: any = await sequelize.models.PipelineStage.findOne({
          where: { name: "Lost" }
        });

        await deal.update({
          stageId: lostStage ? lostStage.id : deal.stageId,
          status: "LOST",
          lossReason: String(lossReason).trim(),
          lossNotes: lossNotes || resolutionNotes || `PO #${poNumber} rejected due to commercial mismatch.`
        });

        // 3. Create Activity Note
        if (deal.leadId) {
          let activityUserId: string | null = deal.ownerId || null;
          if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            const exists = await sequelize.models.User.findByPk(userId);
            if (exists) activityUserId = userId;
          }

          await sequelize.models.Activity.create({
            id: require("crypto").randomUUID(),
            leadId: deal.leadId,
            type: "note",
            outcome: `Purchase Order #${poNumber} rejected due to mismatch. Deal marked as Lost. Loss Reason: ${lossReason}. Notes: ${lossNotes || resolutionNotes || "N/A"}`,
            mentioned_user_ids: "[]",
            pinned: false,
            createdById: activityUserId,
            direction: "internal"
          });
        }

        // 4. Notify Owner
        if (deal.ownerId) {
          await createNotification(
            deal.ownerId,
            "alert",
            "PO Rejected — Deal Marked Lost",
            `PO #${poNumber} for deal "${deal.name}" was rejected. Deal has been closed as Lost (${lossReason}).`,
            `/purchase-orders`
          );
        }
      }

      return res.json({
        message: "Purchase Order rejected. Linked deal moved to Lost.",
        purchaseOrder
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, amount, poNumber } = req.body;

    const purchaseOrder = await sequelize.models.PurchaseOrder.findByPk(id as string);
    if (!purchaseOrder) return res.status(404).json({ error: "Purchase Order not found." });

    await purchaseOrder.update({
      status: status !== undefined ? status : (purchaseOrder as any).status,
      amount: amount !== undefined ? amount : (purchaseOrder as any).amount,
      poNumber: poNumber !== undefined ? poNumber : (purchaseOrder as any).poNumber
    });

    res.json(purchaseOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

import { createOrderFromFinalQuote as domainCreateOrderFromFinalQuote } from "../services/supplyFulfillmentService";

export const createOrderFromQuote = async (req: Request, res: Response) => {
  try {
    const quoteId = String(req.params.quoteId);
    const userId = (req as any).user?.id;
    const { deliveryAddress, requestedDeliveryDate, notes } = req.body || {};
    const result = await domainCreateOrderFromFinalQuote(quoteId, userId, {
      deliveryAddress,
      requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : undefined,
      notes
    });
    res.status(result.isExisting ? 200 : 201).json({
      message: result.isExisting
        ? "Order already exists for this agreed quote (Idempotent response)"
        : "Order created successfully from final agreed quote with operational fulfillment",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const createOrderFromFinalQuote = domainCreateOrderFromFinalQuote;

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await sequelize.models.PurchaseOrder.findByPk(id, {
      include: [
        {
          model: sequelize.models.Quote,
          as: "quote",
          include: [
            { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" },
            {
              model: sequelize.models.Deal,
              as: "deal",
              include: [
                { model: sequelize.models.Account, as: "account" },
                { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role"] }
              ]
            }
          ]
        }
      ]
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

