import { Request, Response } from "express";
import { Op } from "sequelize";
import { Deal, PipelineStage, LeadStageHistory, Activity, User, sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";
import { triggerStageChangeAutomations } from "../services/automationService";
import { validateStageTransition } from "../services/stageValidationService";
import { isWonStage, isLostStage } from "../utils/pipelineStageHelpers";
import { getDealAccessLevel } from "../services/handoffAccessService";

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

    const access = await getDealAccessLevel(userId, userRole, deal);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This deal has been reassigned to another representative.",
        isViewOnly: true
      });
    }

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

import { processOpportunityEvent, calculateOpportunityHealth } from "../services/opportunityAutomationEngine";

export const getDeals = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { stage, status, search } = req.query;
    const dealWhere: any = {};
    const stageInclude: any = { model: PipelineStage, as: "stage" };
    const likeOp = (Op as any).iLike || Op.like;

    const userRole = (user?.role || "sales_rep").toLowerCase();
    const isAdminOrManager = userRole === "admin" || userRole === "director" || userRole === "manager";

    // For non-admin sales reps, include deals they currently own OR previously owned / handed off
    if (!isAdminOrManager && user?.id) {
      const priorDealHandoffs = await sequelize.models.DealReassignmentHistory.findAll({
        where: {
          [Op.or]: [{ oldOwnerId: user.id }, { newOwnerId: user.id }]
        },
        attributes: ["dealId"]
      });
      const priorDealIds = priorDealHandoffs.map((h: any) => h.dealId).filter(Boolean);

      const priorLeadHandoffs = await sequelize.models.LeadReassignmentHistory.findAll({
        where: {
          [Op.or]: [{ oldAssignedToId: user.id }, { newAssignedToId: user.id }]
        },
        attributes: ["leadId"]
      });
      const priorLeadIds = priorLeadHandoffs.map((h: any) => h.leadId).filter(Boolean);

      const userDealCondition: any = {
        [Op.or]: [
          { ownerId: user.id },
          ...(priorDealIds.length > 0 ? [{ id: { [Op.in]: priorDealIds } }] : []),
          ...(priorLeadIds.length > 0 ? [{ leadId: { [Op.in]: priorLeadIds } }] : [])
        ]
      };

      Object.assign(dealWhere, userDealCondition);
    }

    if (status && String(status).trim() && String(status).trim() !== "ALL") {
      dealWhere.status = String(status).toUpperCase();
    }

    if (stage && String(stage).trim() && String(stage).trim() !== "ALL") {
      const stageStr = String(stage).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageStr);
      if (isUuid) {
        stageInclude.where = {
          [Op.or]: [
            { id: stageStr },
            { name: { [likeOp]: stageStr } }
          ]
        };
      } else {
        stageInclude.where = {
          name: { [likeOp]: stageStr }
        };
      }
      stageInclude.required = true;
    }

    if (search && String(search).trim()) {
      const searchStr = `%${String(search).trim()}%`;
      const searchCondition = {
        [Op.or]: [
          { name: { [likeOp]: searchStr } },
          { competitors: { [likeOp]: searchStr } }
        ]
      };
      
      if (dealWhere[Op.or]) {
        dealWhere[Op.and] = [
          { [Op.or]: dealWhere[Op.or] },
          searchCondition
        ];
        delete dealWhere[Op.or];
      } else {
        Object.assign(dealWhere, searchCondition);
      }
    }

    const deals = await Deal.findAll({
      where: dealWhere,
      include: [
        stageInclude,
        { model: sequelize.models.Account, as: "account" },
        { model: sequelize.models.User, as: "owner" },
        { model: sequelize.models.Quote, as: "quotes" }
      ],
      order: [["createdAt", "DESC"]]
    });

    // ── High-Performance Batch Eager Loading of Handoff Chain (Zero N+1 Queries) ──
    const dealIds = deals.map((d: any) => d.id).filter(Boolean);
    const leadIds = deals.map((d: any) => d.leadId).filter(Boolean);

    const dealHandoffs = dealIds.length > 0 ? await sequelize.models.DealReassignmentHistory.findAll({
      where: { dealId: { [Op.in]: dealIds } },
      include: [
        { model: sequelize.models.User, as: "oldOwner", attributes: ["id", "name", "email", "role"] },
        { model: sequelize.models.User, as: "newOwner", attributes: ["id", "name", "email", "role"] }
      ],
      order: [["createdAt", "ASC"]]
    }) : [];

    const leadHandoffs = leadIds.length > 0 ? await sequelize.models.LeadReassignmentHistory.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      include: [
        { model: sequelize.models.User, as: "oldAssignee", attributes: ["id", "name", "email", "role"] },
        { model: sequelize.models.User, as: "newAssignee", attributes: ["id", "name", "email", "role"] }
      ],
      order: [["createdAt", "ASC"]]
    }) : [];

    const parentLeads = leadIds.length > 0 ? await sequelize.models.Lead.findAll({
      where: { id: { [Op.in]: leadIds } },
      include: [
        { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email", "role"] }
      ],
      paranoid: false
    }) : [];

    const dealHandoffMap = new Map<string, any[]>();
    dealHandoffs.forEach((dh: any) => {
      const arr = dealHandoffMap.get(dh.dealId) || [];
      arr.push(dh);
      dealHandoffMap.set(dh.dealId, arr);
    });

    const leadHandoffMap = new Map<string, any[]>();
    leadHandoffs.forEach((lh: any) => {
      const arr = leadHandoffMap.get(lh.leadId) || [];
      arr.push(lh);
      leadHandoffMap.set(lh.leadId, arr);
    });

    const parentLeadMap = new Map<string, any>();
    parentLeads.forEach((pl: any) => {
      parentLeadMap.set(pl.id, pl);
    });

    // Annotate deals with isViewOnly flag and handoffChain
    const annotatedDeals = await Promise.all(
      deals.map(async (d: any) => {
        const dJson = d.toJSON();
        const access = await getDealAccessLevel(user?.id, user?.role, d);

        const chain: any[] = [];
        const leadObj = d.leadId ? parentLeadMap.get(d.leadId) : null;
        const dHandoffs = dealHandoffMap.get(d.id) || [];
        const lHandoffs = d.leadId ? leadHandoffMap.get(d.leadId) || [] : [];

        let origRep = null;
        let convertedAt = leadObj?.convertedAt || leadObj?.createdAt || d.createdAt;
        if (lHandoffs.length > 0 && lHandoffs[0].oldAssignee) {
          origRep = lHandoffs[0].oldAssignee;
        } else if (leadObj?.assignedTo) {
          origRep = leadObj.assignedTo;
        } else if (dHandoffs.length > 0 && dHandoffs[0].oldOwner) {
          origRep = dHandoffs[0].oldOwner;
        } else if (d.owner) {
          origRep = d.owner;
        }

        if (origRep) {
          chain.push({
            ownerId: origRep.id,
            name: origRep.name,
            email: origRep.email,
            role: origRep.role,
            assignedAt: convertedAt,
            isOriginal: true
          });
        }

        lHandoffs.forEach((lh: any) => {
          if (lh.newAssignee && !chain.some((c: any) => c.ownerId === lh.newAssignee.id)) {
            chain.push({
              ownerId: lh.newAssignee.id,
              name: lh.newAssignee.name,
              email: lh.newAssignee.email,
              role: lh.newAssignee.role,
              assignedAt: lh.createdAt,
              isOriginal: false
            });
          }
        });

        dHandoffs.forEach((dh: any) => {
          if (dh.newOwner && !chain.some((c: any) => c.ownerId === dh.newOwner.id)) {
            chain.push({
              ownerId: dh.newOwner.id,
              name: dh.newOwner.name,
              email: dh.newOwner.email,
              role: dh.newOwner.role,
              assignedAt: dh.createdAt,
              isOriginal: false
            });
          }
        });

        if (d.owner && !chain.some((c: any) => c.ownerId === d.owner.id)) {
          chain.push({
            ownerId: d.owner.id,
            name: d.owner.name,
            email: d.owner.email,
            role: d.owner.role,
            assignedAt: d.updatedAt || d.createdAt,
            isOriginal: false
          });
        }

        const originalRep = chain.length > 0 ? chain[0] : (d.owner ? { id: d.owner.id, name: d.owner.name, email: d.owner.email } : null);
        const currentOwner = chain.length > 0 ? chain[chain.length - 1] : (d.owner ? { id: d.owner.id, name: d.owner.name, email: d.owner.email } : null);
        const originalOwnerId = d.originalOwnerId || originalRep?.ownerId || originalRep?.id || null;

        return {
          ...dJson,
          originalOwnerId,
          isViewOnly: access.isViewOnly,
          userPermission: access.accessLevel,
          originalRep,
          currentOwner,
          convertedAt,
          actualClosedAt: d.actualClosedAt || (d.status === "WON" ? d.wonAt : d.status === "LOST" ? d.lostAt : null),
          handoffChain: chain
        };
      })
    );

    res.json(annotatedDeals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user;
    const deal: any = await Deal.findByPk(id, {
      include: [
        { model: PipelineStage, as: "stage" },
        { model: sequelize.models.Account, as: "account" },
        { model: sequelize.models.User, as: "owner" },
        { model: sequelize.models.Quote, as: "quotes" }
      ]
    });
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    const access = await getDealAccessLevel(user?.id, user?.role, deal);
    if (!access.canRead) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const dealJson = deal.toJSON();

    // Fetch activity timeline for the deal's leadId or customerId, oldest first
    let timeline: any[] = [];
    if (deal.leadId || deal.customerId) {
      const whereClause: any = {};
      if (deal.leadId && deal.customerId) {
        whereClause[Op.or] = [{ leadId: deal.leadId }, { customerId: deal.customerId }];
      } else if (deal.leadId) {
        whereClause.leadId = deal.leadId;
      } else {
        whereClause.customerId = deal.customerId;
      }

      timeline = await sequelize.models.Activity.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: "createdBy",
            attributes: ["id", "name", "email", "role"]
          }
        ],
        order: [["createdAt", "ASC"]]
      });
    }

    // Fetch handoff history from LeadReassignmentHistory
    let handoff: any[] = [];
    if (deal.leadId) {
      handoff = await sequelize.models.LeadReassignmentHistory.findAll({
        where: { leadId: deal.leadId },
        include: [
          { model: sequelize.models.User, as: "oldAssignee", attributes: ["id", "name", "email", "role"] },
          { model: sequelize.models.User, as: "newAssignee", attributes: ["id", "name", "email", "role"] },
          { model: sequelize.models.User, as: "changedByUser", attributes: ["id", "name", "email", "role"] }
        ],
        order: [["createdAt", "ASC"]]
      });
    }

    const { getHandoffParticipants } = require("./handoffMessageController");
    const handoffParticipants = await getHandoffParticipants({ dealId: deal.id, leadId: deal.leadId });

    return res.json({
      ...dealJson,
      timeline,
      handoff,
      handoffParticipants,
      isViewOnly: access.isViewOnly,
      userPermission: access.accessLevel
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOpportunity = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user;
    const { name, amount, stageId, ownerId, competitors, probability, status, lossReason, lossNotes } = req.body;
    const deal = await Deal.findByPk(id);
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    const access = await getDealAccessLevel(user?.id, user?.role, deal);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This deal has been reassigned to another representative.",
        isViewOnly: true
      });
    }

    await deal.update({
      name: name !== undefined ? name : (deal as any).name,
      amount: amount !== undefined ? amount : (deal as any).amount,
      stageId: stageId !== undefined ? stageId : (deal as any).stageId,
      ownerId: ownerId !== undefined ? ownerId : (deal as any).ownerId,
      competitors: competitors !== undefined ? competitors : (deal as any).competitors,
      probability: probability !== undefined ? probability : (deal as any).probability,
      status: status !== undefined ? status : (deal as any).status,
      lossReason: lossReason !== undefined ? lossReason : (deal as any).lossReason,
      lossNotes: lossNotes !== undefined ? lossNotes : (deal as any).lossNotes
    });

    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const postOpportunityEvent = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const { type, eventId, payload } = req.body;
    const userId = (req as any).user?.id || "mock-user";

    const result = await processOpportunityEvent({
      eventId,
      opportunityId,
      type,
      actorId: userId,
      payload
    });

    res.status(result.isIdempotentReplay ? 200 : 201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const markOpportunityWon = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const { quoteId, reason, transitionType } = req.body;
    const userId = (req as any).user?.id || "mock-user";

    const result = await processOpportunityEvent({
      opportunityId,
      type: "MarkWon",
      actorId: userId,
      payload: {
        quoteId,
        wonReason: reason || "MANUAL_CONFIRMATION",
        transitionType: transitionType || "STANDARD"
      }
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const markOpportunityLost = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const { lossReason, lossNotes } = req.body;
    const userId = (req as any).user?.id || "mock-user";

    if (!lossReason) {
      return res.status(400).json({ error: "Loss reason is mandatory when closing an opportunity as Lost." });
    }

    const result = await processOpportunityEvent({
      opportunityId,
      type: "MarkLost",
      actorId: userId,
      payload: {
        lossReason,
        lossNotes
      }
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getOpportunityTimeline = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const deal = await Deal.findByPk(opportunityId);
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    const d = deal as any;
    const whereCondition: any = {
      [Op.or]: [
        { customerId: d.accountId || d.customerId || null },
        { leadId: d.leadId || null }
      ]
    };

    const activities = await Activity.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityNextAction = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const deal = await Deal.findByPk(opportunityId);
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    const d = deal as any;
    res.json({
      opportunityId,
      status: d.status || "OPEN",
      currentActivity: d.currentActivity || "Active Opportunity",
      nextAction: d.nextAction || "Contact customer / confirm requirements",
      nextActionDue: d.nextActionDue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityHealth = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const deal = await Deal.findByPk(opportunityId);
    if (!deal) return res.status(404).json({ error: "Opportunity not found" });

    const d = deal as any;
    const health = calculateOpportunityHealth(d.lastCustomerActivityAt, d.nextActionDue);
    res.json({
      opportunityId,
      status: d.status || "OPEN",
      ...health
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityAiSummary = async (req: Request, res: Response) => {
  try {
    const opportunityId = String(req.params.id);
    const { synthesizeOpportunityRequirements } = require("../services/aiRequirementSynthesis");
    const result = await synthesizeOpportunityRequirements(opportunityId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunities = getDeals;
export const createOpportunity = createDeal;
export const moveOpportunityStage = moveDealStage;

export const getPipelineStages = async (req: Request, res: Response) => {
  try {
    const stages = await PipelineStage.findAll({ order: [["order", "ASC"]] });
    res.json(stages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



