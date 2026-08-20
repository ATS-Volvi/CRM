import { Request, Response } from "express";
import { Op } from "sequelize";
import { Deal, PipelineStage, LeadStageHistory, Activity, User, sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { triggerStageChangeAutomations } from "../services/automationService";
import { validateStageTransition } from "../services/stageValidationService";
import { isWonStage, isLostStage } from "../utils/pipelineStageHelpers";

export const validateTransition = async (req: Request, res: Response) => {
  try {
    const { recordId, fromStage, toStage, lossReasonCategory } = req.body;
    const userId = (req as any).user?.id || "mock-user";
    const userRole = (req as any).user?.role || "sales_rep";

    const validation = await validateStageTransition(
      recordId,
      fromStage,
      toStage,
      userId,
      userRole,
      lossReasonCategory
    );

    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPipeline = async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.query;
    const stages = await PipelineStage.findAll({ order: [['order', 'ASC']] });
    
    const dealWhere: any = {};
    if (ownerId) {
      dealWhere.ownerId = ownerId;
    }
    const deals = await Deal.findAll({
      where: dealWhere,
      include: [{ model: User, as: "owner", attributes: ["id", "name", "email"] }]
    });

    const stageToGroupMap: { [key: string]: string } = {
      "Discovery": "Prospecting",
      "Requirements": "Active Deal",
      "Solution/Scope": "Active Deal",
      "Quote Preparation": "Active Deal",
      "Quote Sent": "Active Deal",
      "Negotiation": "Active Deal",
      "Agreed": "Active Deal",
      "Won": "Closed",
      "Lost": "Closed"
    };

    const pipeline = stages.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

      return {
        id: stage.id,
        stage: stage.name,
        group: stageToGroupMap[stage.name] || "Prospecting",
        totalValue,
        deals: stageDeals.map((d: any) => {
          const enteredAt = d.enteredStageAt ? new Date(d.enteredStageAt) : new Date(d.createdAt || Date.now());
          const daysInStage = Math.max(0, Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)));

          return {
            id: d.id,
            name: d.name,
            value: Number(d.amount),
            company: d.name,
            lastActivity: d.lastCustomerActivityAt ? new Date(d.lastCustomerActivityAt).toLocaleDateString() : "Recent",
            daysInStage,
            verificationStatus: d.stageVerificationStatus || "VERIFIED",
            stageEvidence: d.stageEvidence ? JSON.parse(d.stageEvidence) : [],
            isUrgent: daysInStage > 14,
            competitors: d.competitors,
            probability: d.probability,
            group: stageToGroupMap[stage.name] || "Prospecting",
            leadId: d.leadId,
            customerId: d.customerId,
            ownerId: d.ownerId,
            owner: d.owner ? { id: d.owner.id, name: d.owner.name, email: d.owner.email } : null
          };
        })
      };
    });

    res.json(pipeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const moveDealStage = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { toStageId, reason, lossReasonCategory, recontactDate, forceBypass } = req.body;
    const userId = (req as any).user?.id || "mock-user";
    const userRole = (req as any).user?.role || "sales_rep";

    const deal: any = await Deal.findByPk(id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const fromStageId = deal.stageId;
    const fromStageObj: any = await PipelineStage.findByPk(fromStageId);
    const toStageObj: any = await PipelineStage.findByPk(toStageId);

    const fromStageName = fromStageObj ? fromStageObj.name : "Unknown";
    const toStageName = toStageObj ? toStageObj.name : "Unknown";

    // Run Stage Validation Engine
    const validation = await validateStageTransition(
      id,
      fromStageName,
      toStageName,
      userId,
      userRole,
      lossReasonCategory || reason
    );

    // If validation fails and forceBypass is not granted by admin, reject transition
    if (!validation.allowed && !forceBypass) {
      return res.status(400).json({
        error: `Cannot transition to ${toStageName}. Stage entry criteria not satisfied.`,
        validation
      });
    }

    // Write LeadStageHistory audit log
    if (deal.leadId) {
      await LeadStageHistory.create({
        leadId: deal.leadId,
        fromStage: fromStageName,
        toStage: toStageName,
        changedById: userId,
        reason: reason || lossReasonCategory || null,
        transitionType: validation.transitionType,
        evidenceData: JSON.stringify(validation.evidence),
        isVerified: validation.allowed
      });
    }

    // Write Activity
    await Activity.create({
      leadId: deal.leadId || null,
      type: "stage_change",
      outcome: `Stage updated to ${toStageName} [${validation.verificationStatus}]${lossReasonCategory ? ' [Category: ' + lossReasonCategory + ']' : ''}${reason ? ' - Detail: ' + reason : ''}`,
      notes: JSON.stringify(validation.evidence),
      createdById: userId,
      direction: "internal"
    });

    // Update Deal fields
    if (toStageId) deal.stageId = toStageId;
    deal.enteredStageAt = new Date();
    deal.stageVerificationStatus = validation.verificationStatus;
    deal.stageEvidence = JSON.stringify(validation.evidence);

    const isLost = toStageObj && isLostStage(toStageObj.name);
    if (isLost) {
      deal.lossReasonCategory = lossReasonCategory;
      if (reason !== undefined) deal.lossReason = reason;
    }
    if (toStageObj && toStageObj.name === "On Hold") deal.recontactDate = recontactDate;
    if (req.body.competitors !== undefined) deal.competitors = req.body.competitors;
    if (req.body.probability !== undefined) deal.probability = req.body.probability;

    await deal.save();
    if (toStageObj && toStageObj.name === "On Hold") deal.recontactDate = recontactDate;
    if (req.body.competitors !== undefined) deal.competitors = req.body.competitors;
    if (req.body.probability !== undefined) deal.probability = req.body.probability;

    await deal.save();

    // Trigger Configured Stage Change Automation Rules
    await triggerStageChangeAutomations(deal, toStageObj ? toStageObj.name : 'Unknown', userId);

    if (toStageObj && isWonStage(toStageObj.name)) {
      await createNotification(
        deal.ownerId,
        'success',
        'Deal Won! 🎉',
        `Congratulations! The deal ${deal.name} was marked as Won.`,
        `/pipeline`
      );

      // ── Won → Order Automation ──
      try {
        const { createOrderFromFinalQuote } = require("../services/supplyFulfillmentService");
        const { Quote, PurchaseOrder } = sequelize.models;

        // 1. Fetch all quotes belonging to this deal
        const dealQuotes: any[] = await Quote.findAll({
          where: { dealId: deal.id }
        });

        // 2. Identify candidate winning/accepted quotes
        const acceptedQuotes = dealQuotes.filter(
          (q: any) => q.status === "Accepted" || q.status === "Approved" || q.isFinalAgreed === true
        );

        if (acceptedQuotes.length === 0) {
          console.log(`[Won -> Order Automation] Deal ${deal.id} marked Won, but no accepted quote found.`);
          await createNotification(
            deal.ownerId,
            'info',
            'Manual Order Required',
            `Deal '${deal.name}' was marked as Won, but no accepted quote was found to auto-create an Order. Please create the Purchase Order manually.`,
            `/opportunities/${deal.id}`
          );
        } else {
          // Select single winning quote: highest version, then latest acceptedAt / updatedAt
          acceptedQuotes.sort((a: any, b: any) => {
            const vA = Number(a.version || 1);
            const vB = Number(b.version || 1);
            if (vA !== vB) return vB - vA;
            const tA = new Date(a.acceptedAt || a.updatedAt || 0).getTime();
            const tB = new Date(b.acceptedAt || b.updatedAt || 0).getTime();
            return tB - tA;
          });
          const winningQuote = acceptedQuotes[0];

          // 3. Check for stray POs on non-final/superseded quote revisions (for warning/audit)
          const otherQuoteIds = dealQuotes.filter((q: any) => q.id !== winningQuote.id).map((q: any) => q.id);
          if (otherQuoteIds.length > 0) {
            const strayOrder: any = await PurchaseOrder.findOne({
              where: { quoteId: { [Op.in]: otherQuoteIds } }
            });
            if (strayOrder) {
              console.warn(
                `[Won -> Order Automation] Notice: Deal ${deal.id} has an existing order (PO: ${strayOrder.poNumber}) ` +
                `on non-final quote revision ${strayOrder.quoteId}. Proceeding with order creation for final accepted quote ${winningQuote.id}.`
              );
            }
          }

          // 4. Idempotency check scoped specifically to the final accepted quote
          const existingOrderForWinningQuote = await PurchaseOrder.findOne({
            where: { quoteId: winningQuote.id }
          });

          if (existingOrderForWinningQuote) {
            console.log(
              `[Won -> Order Automation] Order already exists for final accepted quote ${winningQuote.id} of Deal ${deal.id} ` +
              `(PO: ${(existingOrderForWinningQuote as any).poNumber})`
            );
          } else {
            const orderResult = await createOrderFromFinalQuote(winningQuote.id, userId);
            console.log(`[Won -> Order Automation] Order ${orderResult.orderNumber} created for Deal ${deal.id} (Quote: ${winningQuote.id}, v${winningQuote.version || 1})`);
            await createNotification(
              deal.ownerId,
              'info',
              'Purchase Order Auto-Created 📦',
              `Order #${orderResult.orderNumber} was automatically created from accepted quote (v${winningQuote.version || 1}) for deal ${deal.name}.`,
              `/purchase-orders`
            );
          }
        }
      } catch (orderErr: any) {
        console.error(`[Won -> Order Automation] Order creation error for Deal ${deal.id}:`, orderErr?.message || orderErr);
        await createNotification(
          deal.ownerId,
          'warning',
          'Order Auto-Creation Notice',
          `Deal '${deal.name}' was marked as Won, but automatic Order creation encountered an issue: ${orderErr?.message || "Manual order required"}. Please create the Order manually if needed.`,
          `/opportunities/${deal.id}`
        );
      }
    } else if (toStageObj && isLostStage(toStageObj.name) && deal.leadId) {
      const existing = await sequelize.models.ScheduledEmail.findOne({
        where: { leadId: deal.leadId, templateName: "deal_lost_feedback", sentAt: null }
      });
      
      if (!existing) {
        const sendAfterDate = new Date();
        sendAfterDate.setDate(sendAfterDate.getDate() + 2); // 2 days from now
        
        await sequelize.models.ScheduledEmail.create({
          id: require('crypto').randomUUID(),
          leadId: deal.leadId,
          templateName: "deal_lost_feedback",
          sendAfter: sendAfterDate
        });
      }
    }

    res.json({ message: "Stage updated successfully", deal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDeal = async (req: Request, res: Response) => {
  try {
    const { name, amount, stageId, leadId, competitors, probability } = req.body;
    const adminUser = await sequelize.models.User.findOne({ where: { role: 'admin' } });
    const userId = (req as any).user?.id || (adminUser ? (adminUser as any).id : null);

    // Default to the first stage if no stageId provided
    let targetStageId = stageId;
    if (!targetStageId) {
       const firstStage = await PipelineStage.findOne({ order: [['order', 'ASC']] });
       if (firstStage) {
          targetStageId = firstStage.id;
       }
    }

    let customerId: string | null = null;
    if (leadId) {
      const lead = await sequelize.models.Lead.findByPk(leadId);
      if (lead) {
        customerId = (lead as any).customerId;
      }
    }

    const deal = await Deal.create({
      id: require('crypto').randomUUID(),
      name,
      amount,
      stageId: targetStageId,
      leadId: leadId || null,
      competitors: competitors || null,
      probability: probability !== undefined ? probability : null,
      ownerId: userId,
      customerId
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeals = async (req: Request, res: Response) => {
  try {
    const { stage, search } = req.query;
    const dealWhere: any = {};
    const stageInclude: any = { model: PipelineStage, as: "stage" };

    if (stage && String(stage).trim() && String(stage).trim() !== "ALL") {
      const stageStr = String(stage).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageStr);
      if (isUuid) {
        stageInclude.where = {
          [Op.or]: [
            { id: stageStr },
            { name: { [Op.iLike]: stageStr } }
          ]
        };
      } else {
        stageInclude.where = {
          name: { [Op.iLike]: stageStr }
        };
      }
      stageInclude.required = true;
    }

    if (search && String(search).trim()) {
      const searchStr = `%${String(search).trim()}%`;
      dealWhere[Op.or] = [
        { name: { [Op.iLike]: searchStr } },
        { competitors: { [Op.iLike]: searchStr } }
      ];
    }

    const deals = await Deal.findAll({
      where: dealWhere,
      include: [
        stageInclude,
        { model: sequelize.models.Account, as: "account" },
        { model: sequelize.models.User, as: "owner" }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deal = await Deal.findByPk(id, {
      include: [
        { model: PipelineStage, as: "stage" },
        { model: sequelize.models.Account, as: "account" },
        { model: sequelize.models.User, as: "owner" },
        { model: sequelize.models.Quote, as: "Quotes" }
      ]
    });
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOpportunity = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, amount, stageId, ownerId, competitors, probability } = req.body;
    const deal = await Deal.findByPk(id);
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    await deal.update({
      name: name !== undefined ? name : (deal as any).name,
      amount: amount !== undefined ? amount : (deal as any).amount,
      stageId: stageId !== undefined ? stageId : (deal as any).stageId,
      ownerId: ownerId !== undefined ? ownerId : (deal as any).ownerId,
      competitors: competitors !== undefined ? competitors : (deal as any).competitors,
      probability: probability !== undefined ? probability : (deal as any).probability
    });

    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunities = getDeals;
export const createOpportunity = createDeal;
export const moveOpportunityStage = moveDealStage;

