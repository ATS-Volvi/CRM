import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { triggerTemplatedEmail } from "../services/emailService";

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { search, salespersonId, startDate, endDate, valueBand } = req.query;
    const { Op } = require("sequelize");

    const where: any = {};

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
              { model: sequelize.models.User, as: "owner" }
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
        include: [{ model: sequelize.models.Lead, as: "lead" }]
      }]
    });

    if (!quote) return res.status(404).json({ error: "Quote not found." });

    const mismatch = Number((quote as any).totalAmount) !== Number(amount);

    // Create PO
    const purchaseOrder = await sequelize.models.PurchaseOrder.create({
      id: require('crypto').randomUUID(),
      quoteId,
      amount,
      poNumber,
      status: mismatch ? "Flagged/Mismatch" : "Accepted",
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

    // Auto-update linked deal status to "Won"
    const deal = (quote as any).deal;
    if (deal) {
      const wonStage = await sequelize.models.PipelineStage.findOne({
        where: { name: "Won" }
      });
      if (wonStage) {
        await deal.update({ stageId: (wonStage as any).id });
      }
      
      if ((deal as any).leadId) {
        await sequelize.models.Activity.create({
          id: require('crypto').randomUUID(),
          leadId: (deal as any).leadId,
          type: "note",
          outcome: `Purchase Order Received: ${poNumber} (Amount: $${amount}) - Status: ${mismatch ? "Flagged/Mismatch" : "Accepted"}`,
          mentioned_user_ids: "[]",
          pinned: false,
          createdById: "system"
        });
        
        // Feature 13 trigger: Send PO Received thank-you
        const { triggerCommunication } = require("../services/communicationService");
        await triggerCommunication("po_received", {
          leadId: (deal as any).leadId,
          salespersonId: (deal as any).ownerId,
          quoteValue: amount
        });
      }
    }

    res.status(201).json({ purchaseOrder, mismatch });
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
