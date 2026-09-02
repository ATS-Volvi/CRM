import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { createNotification } from "../services/notificationService";
import { evaluateQuoteApproval, createApprovalAuditLog } from "../services/approvalEngine";
import { checkRecordAccess } from "../services/handoffAccessService";
import { deliverQuote, getQuoteContact } from "../services/quoteDeliveryService";

// ── ADMIN GLOBAL APPROVAL POLICY ─────────────────────────────

export const getAdminApprovalPolicy = async (req: Request, res: Response) => {
  try {
    let policy: any = await sequelize.models.AdminApprovalPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });
    if (!policy) {
      policy = await sequelize.models.AdminApprovalPolicy.create({
        id: require("crypto").randomUUID(),
        maximumSalesRepApproval: 2500000,
        maximumTeamLeadApproval: 10000000,
        maximumRepDiscount: 0.10,
        maximumTeamLeadDiscount: 0.20,
        minimumAllowedMargin: 0.15
      });
    }
    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAdminApprovalPolicy = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only Admin can update global approval policies." });
    }

    const {
      maximumSalesRepApproval,
      maximumTeamLeadApproval,
      maximumRepDiscount,
      maximumTeamLeadDiscount,
      minimumAllowedMargin
    } = req.body;

    let policy: any = await sequelize.models.AdminApprovalPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });

    const updateData = {
      maximumSalesRepApproval: maximumSalesRepApproval !== undefined ? Number(maximumSalesRepApproval) : 2500000,
      maximumTeamLeadApproval: maximumTeamLeadApproval !== undefined ? Number(maximumTeamLeadApproval) : 10000000,
      maximumRepDiscount: maximumRepDiscount !== undefined ? Number(maximumRepDiscount) : 0.10,
      maximumTeamLeadDiscount: maximumTeamLeadDiscount !== undefined ? Number(maximumTeamLeadDiscount) : 0.20,
      minimumAllowedMargin: minimumAllowedMargin !== undefined ? Number(minimumAllowedMargin) : 0.15,
      updatedById: (req as any).user?.id || null
    };

    if (policy) {
      await policy.update(updateData);
    } else {
      policy = await sequelize.models.AdminApprovalPolicy.create({
        id: require("crypto").randomUUID(),
        ...updateData
      });
    }

    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── SALES REP APPROVAL PROFILES ─────────────────────────────

export const getSalesApprovalProfiles = async (req: Request, res: Response) => {
  try {
    // 1. Fetch team leads / managers
    const managers = await sequelize.models.User.findAll({
      where: { role: { [Op.in]: ["manager", "admin"] } }
    });
    const marcus: any = managers.find((m: any) => m.name === "Marcus Vance" || m.email === "marcus@nexus.com") || managers[0];
    const helena: any = managers.find((m: any) => m.name === "Helena Rostova" || m.email === "helena@nexus.com") || managers[1] || marcus;

    // 2. Fetch all sales reps
    const reps = await sequelize.models.User.findAll({
      where: { role: { [Op.ne]: "admin" } }
    });

    // 3. Ensure Team Leads also have their own Approval Authority Profiles
    for (const mgr of managers) {
      if ((mgr as any).role === "admin") continue;
      let mgrProf: any = await sequelize.models.SalesApprovalProfile.findOne({
        where: { salesRepId: (mgr as any).id }
      });
      if (!mgrProf) {
        await sequelize.models.SalesApprovalProfile.create({
          id: require("crypto").randomUUID(),
          salesRepId: (mgr as any).id,
          selfApprovalLimit: 5000000, // ₹50L Default Team Lead Limit
          discountApprovalLimit: 0.20, // 20% Default Team Lead Discount
          minimumMargin: 0.15,
          teamLeadId: null,
          approvalEnabled: true
        });
      }
    }

    // 4. Ensure every rep has a SalesApprovalProfile & assigned team lead
    for (let i = 0; i < reps.length; i++) {
      const r = reps[i] as any;
      if (r.role === "manager" || r.role === "admin") continue;

      let assignedLeadId = r.managerId;
      if (!assignedLeadId && marcus) {
        // Balance reps between Marcus Vance (NA) & Helena Rostova (EMEA/APAC)
        const isEmeaApac = (r.territory || r.department || "").toLowerCase().includes("emea") || 
                           (r.territory || r.department || "").toLowerCase().includes("apac");
        assignedLeadId = isEmeaApac ? (helena?.id || marcus?.id) : (marcus?.id || helena?.id);
        if (i % 2 === 1 && helena) assignedLeadId = helena.id;
        
        await r.update({ managerId: assignedLeadId });
      }

      let profile: any = await sequelize.models.SalesApprovalProfile.findOne({
        where: { salesRepId: r.id }
      });

      if (!profile) {
        await sequelize.models.SalesApprovalProfile.create({
          id: require("crypto").randomUUID(),
          salesRepId: r.id,
          selfApprovalLimit: 1000000,
          discountApprovalLimit: 0.10,
          minimumMargin: 0.20,
          teamLeadId: assignedLeadId || (marcus as any)?.id || null,
          approvalEnabled: true
        });
      } else if (!profile.teamLeadId && assignedLeadId) {
        await profile.update({ teamLeadId: assignedLeadId });
      }
    }

    const profiles = await sequelize.models.SalesApprovalProfile.findAll({
      include: [
        { model: sequelize.models.User, as: "salesRep", attributes: ["id", "name", "email", "role", "team"] },
        { model: sequelize.models.User, as: "teamLead", attributes: ["id", "name", "email"] }
      ]
    });
    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const upsertSalesApprovalProfile = async (req: Request, res: Response) => {
  try {
    const {
      salesRepId,
      selfApprovalLimit,
      discountApprovalLimit,
      minimumMargin,
      teamLeadId,
      approvalEnabled,
      effectiveFrom,
      effectiveUntil
    } = req.body;

    const targetIds = Array.isArray(req.body.salesRepIds) 
      ? req.body.salesRepIds 
      : (salesRepId ? [salesRepId] : []);

    if (targetIds.length === 0) {
      return res.status(400).json({ error: "salesRepId or salesRepIds is required." });
    }

    // Load Admin Global Policy to enforce authority ceilings
    let adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });
    const maxSalesRepApproval = Number(adminPolicy?.maximumSalesRepApproval ?? 2500000);
    const maxRepDiscount = Number(adminPolicy?.maximumRepDiscount ?? 0.10);
    const maxTLApproval = Number(adminPolicy?.maximumTeamLeadApproval ?? 10000000);
    const maxTLDiscount = Number(adminPolicy?.maximumTeamLeadDiscount ?? 0.20);

    const requestedLimit = Number(selfApprovalLimit ?? 1000000);
    const requestedDiscount = Number(discountApprovalLimit ?? 0.10);

    // Validate per user role
    for (const id of targetIds) {
      const targetUser: any = await sequelize.models.User.findByPk(id);
      const isTeamLead = targetUser && (targetUser.role === "manager");

      if (isTeamLead) {
        if (requestedLimit > maxTLApproval || requestedDiscount > maxTLDiscount) {
          return res.status(400).json({
            error: `Team Lead limit cannot exceed the Admin Team Lead Ceiling (SAR ${maxTLApproval.toLocaleString()}, Max Discount ${(maxTLDiscount * 100).toFixed(1)}%).`
          });
        }
      } else {
        if (requestedLimit > maxSalesRepApproval || requestedDiscount > maxRepDiscount) {
          return res.status(400).json({
            error: `Sales Rep limit cannot exceed the Admin Sales Rep Ceiling (SAR ${maxSalesRepApproval.toLocaleString()}, Max Discount ${(maxRepDiscount * 100).toFixed(1)}%).`
          });
        }
      }
    }

    const updatedProfiles = [];
    for (const id of targetIds) {
      let profile: any = await sequelize.models.SalesApprovalProfile.findOne({
        where: { salesRepId: id }
      });

      const dataPayload = {
        salesRepId: id,
        selfApprovalLimit: requestedLimit,
        discountApprovalLimit: requestedDiscount,
        minimumMargin: Number(minimumMargin ?? 0.20),
        teamLeadId: teamLeadId || null,
        approvalEnabled: approvalEnabled !== undefined ? Boolean(approvalEnabled) : true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null
      };

      if (profile) {
        await profile.update(dataPayload);
      } else {
        profile = await sequelize.models.SalesApprovalProfile.create({
          id: require("crypto").randomUUID(),
          ...dataPayload
        });
      }
      updatedProfiles.push(profile);
    }

    res.json(updatedProfiles.length === 1 ? updatedProfiles[0] : updatedProfiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── QUOTE EVALUATION & SUBMISSION ─────────────────────────────

export const evaluateQuote = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const overrideData = req.method === "POST" ? req.body : undefined;
    if (overrideData && !overrideData.salesRepId && (req as any).user?.id) {
      overrideData.salesRepId = (req as any).user.id;
    }
    const evaluation = await evaluateQuoteApproval(id, overrideData);
    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const submitQuoteForApproval = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const quote: any = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const authUser = (req as any).user;
    if (quote.dealId) {
      const access = await checkRecordAccess(authUser?.id, authUser?.role, { dealId: quote.dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This quote's deal has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    const evaluation = await evaluateQuoteApproval(id);
    const userId = (req as any).user?.id || evaluation.salesRepId;

    // Update Quote status to Pending Approval
    const prevStatus = quote.status;
    await quote.update({ status: "Pending Approval", statusChangedAt: new Date() });

    // Find existing pending request or create new
    let approvalReq: any = await sequelize.models.ApprovalRequest.findOne({
      where: { targetId: id, type: "Quote", status: "Pending" }
    });

    if (!approvalReq) {
      approvalReq = await sequelize.models.ApprovalRequest.create({
        id: require("crypto").randomUUID(),
        targetId: id,
        type: "Quote",
        status: "Pending",
        requestedById: userId,
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

    // Send Real-time Notification to Approver
    if (evaluation.requiredApproverId) {
      await createNotification(
        evaluation.requiredApproverId,
        "alert",
        "Quote Approval Required",
        `Quotation ${quote.quoteNumber || id} requires your ${evaluation.approvalLevel.replace("_", " ")} approval: ${evaluation.reason}`,
        "/approvals"
      );
    }

    res.json({
      message: "Quote submitted for approval",
      quote,
      evaluation,
      approvalRequest: approvalReq
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── APPROVAL QUEUE & ACTION HANDLERS WITH SECURITY ─────────────

export const getApprovals = async (req: Request, res: Response) => {
  try {
    const userAttrs = ["id", "name", "email", "role"];
    const approvals = await sequelize.models.ApprovalRequest.findAll({
      include: [
        { model: sequelize.models.User, as: "requestedBy", attributes: userAttrs },
        { model: sequelize.models.User, as: "approvedBy", attributes: userAttrs },
        { model: sequelize.models.User, as: "assignedApprover", attributes: userAttrs },
      ],
      order: [["createdAt", "DESC"]]
    });

    const approvalsWithDetails = await Promise.all(
      approvals.map(async (approval: any) => {
        const data = approval.toJSON();
        if (data.type === "Quote") {
          data.target = await sequelize.models.Quote.findByPk(data.targetId, {
            include: [
              { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems", include: [{ model: sequelize.models.PriceBookEntry, as: "product" }] },
              { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }, { model: sequelize.models.User, as: "owner", attributes: userAttrs }] }
            ]
          });
          if (data.target) {
            data.evaluation = await evaluateQuoteApproval(data.targetId);
          }
        } else if (data.type === "PurchaseOrder" || data.type === "PO") {
          data.target = await sequelize.models.PurchaseOrder.findByPk(data.targetId, {
            include: [{
              model: sequelize.models.Quote,
              as: "quote",
              include: [
                { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }, { model: sequelize.models.User, as: "owner", attributes: userAttrs }] }
              ]
            }]
          });
          if (data.target) {
            const quoted = Number((data.target as any).quote?.totalAmount || 0);
            const poAmt = Number((data.target as any).amount || 0);
            data.evaluation = {
              approvalLevel: "MANAGER",
              quoteValue: quoted,
              poAmount: poAmt,
              mismatch: quoted !== poAmt,
              discount: 0,
              margin: 0.20,
              reason: data.comments || (quoted !== poAmt ? `PO Amount Mismatch: Quoted SAR ${quoted.toLocaleString()} vs PO SAR ${poAmt.toLocaleString()}` : `PO Verification for #${(data.target as any).poNumber}`)
            };
          }
        }
        return data;
      })
    );

    res.json(approvalsWithDetails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateApproval = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, comments } = req.body;
    const authUser = (req as any).user;

    const approval = await sequelize.models.ApprovalRequest.findByPk(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const targetId = (approval as any).targetId;
    let evaluation: any = null;

    if ((approval as any).type === "Quote" && targetId) {
      const targetQuote: any = await sequelize.models.Quote.findByPk(targetId);
      if (targetQuote && targetQuote.dealId) {
        const access = await checkRecordAccess(authUser?.id, authUser?.role, { dealId: targetQuote.dealId });
        if (!access.canWrite) {
          return res.status(403).json({
            error: access.reason || "Handed off — view only. This quote's deal has been reassigned to another representative.",
            isViewOnly: true
          });
        }
      }
    }

    if ((approval as any).type === "Quote") {
      evaluation = await evaluateQuoteApproval(targetId);

      // SECURITY ENFORCEMENT for Quote approvals
      if (authUser && authUser.role !== "admin") {
        if (evaluation.approvalLevel === "ADMIN") {
          return res.status(403).json({
            error: "Security Violation: Only Admin can approve or modify quotations requiring Admin approval."
          });
        }
        if (evaluation.approvalLevel === "TEAM_LEAD") {
          const isAssigned = (approval as any).assignedApproverId === authUser.id;
          const isTeamLead = evaluation.teamLeadId === authUser.id;
          const isManagerRole = authUser.role === "manager" || authUser.role === "director";
          if (!isAssigned && !isTeamLead && !isManagerRole) {
            return res.status(403).json({
              error: "Security Violation: You do not have authority to approve this quotation. Team Lead approval is required."
            });
          }
        }
      }
    }

    const prevApprovalStatus = (approval as any).status;

    let notificationToDeliver: { repOwnerId?: string | null; customerName?: string; customerEmail?: string } = {};

    // ── STEP 1: DB WRITES IN A SINGLE SEQUELIZE TRANSACTION ──────────────────
    await sequelize.transaction(async (t) => {
      await approval.update({
        status,
        approvedById: authUser?.id || (approval as any).assignedApproverId,
        comments: comments || (approval as any).comments
      }, { transaction: t });

      if ((approval as any).type === "PurchaseOrder" || (approval as any).type === "PO") {
        const po: any = await sequelize.models.PurchaseOrder.findByPk(targetId, {
          include: [{
            model: sequelize.models.Quote,
            as: "quote",
            include: [{ model: sequelize.models.Deal, as: "deal" }]
          }],
          transaction: t
        });

        if (po) {
          if (status === "Approved") {
            await po.update({ status: "Accepted", approvedAt: new Date() }, { transaction: t });
            if (po.quote?.deal) {
              const wonStage = await sequelize.models.PipelineStage.findOne({ where: { name: "Won" }, transaction: t }) ||
                await sequelize.models.PipelineStage.findOne({ order: [["order", "DESC"]], transaction: t });
              await po.quote.deal.update({ stageId: (wonStage as any)?.id, status: "WON" }, { transaction: t });
            }
          } else if (status === "Rejected") {
            await po.update({ status: "Rejected" }, { transaction: t });
          }
        }
      }

      if ((approval as any).type === "Quote") {
        const quote = await sequelize.models.Quote.findByPk(targetId, {
          include: [{ model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" }],
          transaction: t
        });

        if (quote) {
          const prevQuoteStatus = (quote as any).status;
          const newQuoteStatus = status === "Approved" ? "Approved" : (status === "Rejected" ? "Rejected" : "Draft");
          await quote.update({
            status: newQuoteStatus,
            isFinalAgreed: status === "Approved",
            statusChangedAt: new Date()
          }, { transaction: t });

          // Log Audit Trail
          await createApprovalAuditLog({
            quoteId: targetId,
            salesRepId: evaluation?.salesRepId || (approval as any).requestedById || "system",
            approvalLevel: evaluation?.approvalLevel || "NONE",
            requiredLimit: evaluation?.repLimit || null,
            actualQuoteValue: evaluation?.quoteValue || Number((quote as any).totalAmount || 0),
            discount: evaluation?.discount || 0,
            margin: evaluation?.margin ?? null,
            approverId: authUser?.id || null,
            decision: status,
            comment: comments || null,
            previousStatus: prevQuoteStatus,
            newStatus: newQuoteStatus,
            reason: `Quote status updated to ${status} by ${authUser?.name || authUser?.role || "Authorized Approver"}. Reason: ${evaluation?.reason || 'Direct Approval Action'}`
          }, { transaction: t });

          // Auto-generate invoice if approved
          if (status === "Approved") {
            const existingInvoice = await sequelize.models.Invoice.findOne({ where: { quoteId: (quote as any).id }, transaction: t });
            if (!existingInvoice) {
              let targetLeadId: string | null = null;
              if ((quote as any).dealId) {
                const dealObj: any = await sequelize.models.Deal.findByPk((quote as any).dealId, { transaction: t });
                if (dealObj && dealObj.leadId) {
                  targetLeadId = dealObj.leadId;
                }
              }

              const invoiceId = require("crypto").randomUUID();
              const invoice = await sequelize.models.Invoice.create({
                id: invoiceId,
                quoteId: (quote as any).id,
                leadId: targetLeadId,
                status: "Draft",
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                subtotal: (quote as any).totalAmount || 0,
                totalAmount: (quote as any).totalAmount || 0,
                notes: "Auto-generated invoice upon Quote approval."
              }, { transaction: t }) as any;

              if ((quote as any).QuoteLineItems && (quote as any).QuoteLineItems.length > 0) {
                for (const item of (quote as any).QuoteLineItems) {
                  const qty = Number(item.quantity || 1);
                  const price = Number(item.unitPrice || 0);
                  await sequelize.models.InvoiceLineItem.create({
                    id: require("crypto").randomUUID(),
                    invoiceId: invoice.id,
                    productId: item.productId || null,
                    quantity: qty,
                    unitPrice: price,
                    totalPrice: qty * price
                  }, { transaction: t });
                }
              }
            }
          }
        }
      }
    });

    // ── STEP 2: NOTIFICATIONS & SIDE EFFECTS OUTSIDE TRANSACTION ─────────────
    if ((approval as any).type === "PurchaseOrder" || (approval as any).type === "PO") {
      const po: any = await sequelize.models.PurchaseOrder.findByPk(targetId, {
        include: [{
          model: sequelize.models.Quote,
          as: "quote",
          include: [{ model: sequelize.models.Deal, as: "deal" }]
        }]
      });
      if (po?.quote?.deal?.ownerId) {
        if (status === "Approved") {
          await createNotification(
            po.quote.deal.ownerId,
            'info',
            'Purchase Order Approved & Deal Won',
            `PO #${po.poNumber} for "${po.quote.deal.name}" was approved by management. Deal has been marked Won!`,
            `/opportunities/${po.quote.deal.id}`
          );
        } else if (status === "Rejected") {
          await createNotification(
            po.quote.deal.ownerId,
            'alert',
            'Purchase Order Rejected',
            `PO #${po.poNumber} was rejected by management: ${comments || 'Action required'}.`,
            `/opportunities/${po.quote.deal.id}`
          );
        }
      }
    }

    if ((approval as any).type === "Quote") {
      const quote = await sequelize.models.Quote.findByPk(targetId);
      if (quote) {
        if (status === "Rejected") {
          const approverName = authUser?.name || authUser?.role || "Manager";
          const repOwnerId = evaluation?.salesRepId || (approval as any).requestedById;
          if (repOwnerId) {
            await createNotification(
              repOwnerId,
              "alert",
              "Quote Approval Rejected ❌",
              `Your quote request was rejected by ${approverName}: ${comments || "No reason provided"}. The quote remains editable for revision.`,
              `/quotes/${targetId}`
            );
          }
        } else if (status === "Approved") {
          const approverName = authUser?.name || authUser?.role || "Manager";
          let customerEmail: string | null = null;
          let customerName: string = "Customer";
          let repOwnerId: string | null = null;

          try {
            const quoteWithDeal: any = await sequelize.models.Quote.findByPk((quote as any).id, {
              include: [{
                model: sequelize.models.Deal,
                as: "deal",
                include: [{ model: sequelize.models.Lead, as: "lead" }]
              }, { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" }]
            });

            const { contact } = await getQuoteContact(quoteWithDeal);
            customerEmail = contact?.email || null;
            customerName = contact?.name || "Customer";
            repOwnerId = quoteWithDeal?.deal?.ownerId || evaluation?.salesRepId || null;

            if (!customerEmail || customerEmail.includes("@nexus-temp.com") || !customerEmail.includes("@")) {
              throw new Error(`No valid customer email on record (found: "${customerEmail || 'none'}")`);
            }

            await deliverQuote((quote as any).id, { channel: "EMAIL", userId: authUser?.id });

            console.log(`[Approval] Quote ${(quote as any).id} approved by ${approverName}, auto-sent to ${customerEmail}`);

            if (repOwnerId) {
              await createNotification(
                repOwnerId,
                "info",
                "Your Quote Was Approved & Sent ✅",
                `Your quote for ${customerName} was approved by ${approverName} and automatically sent to ${customerEmail}.`,
                `/quotes/${(quote as any).id}`
              );
            }
          } catch (sendErr: any) {
            await quote.update({ status: "Approved (Send Failed)", statusChangedAt: new Date() });
            console.error(`[Approval] Quote ${(quote as any).id} approved by ${approverName} but auto-send FAILED: ${sendErr.message}`);

            const failureMsg = `Quote approved, but delivery to customer failed: ${sendErr.message}. Please send manually from the Quotes page.`;

            if (authUser?.id) {
              await createNotification(
                authUser.id,
                "alert",
                "Quote Approved — Send Failed ⚠️",
                failureMsg,
                `/quotes/${(quote as any).id}`
              );
            }

            if (repOwnerId && repOwnerId !== authUser?.id) {
              await createNotification(
                repOwnerId,
                "alert",
                "Quote Approved — Send Failed ⚠️",
                failureMsg,
                `/quotes/${(quote as any).id}`
              );
            }
          }
        }
      }
    }

    res.json(approval);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── DIRECT QUOTE APPROVAL / REJECTION BY SALES REP OR MANAGER ──

export const approveQuoteDirectly = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { comments } = req.body;
    const authUser = (req as any).user;

    const quote: any = await sequelize.models.Quote.findByPk(id, {
      include: [{ model: sequelize.models.Deal, as: "deal" }]
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    if (quote.dealId) {
      const access = await checkRecordAccess(authUser?.id, authUser?.role, { dealId: quote.dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This quote's deal has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    const evaluation = await evaluateQuoteApproval(id);

    // SECURITY ENFORCEMENT
    if (evaluation.approvalLevel === "ADMIN") {
      if (authUser?.role !== "admin") {
        return res.status(403).json({
          error: "Security Violation: Quotation exceeds Team Lead limits. Admin approval is required."
        });
      }
    } else if (evaluation.approvalLevel === "TEAM_LEAD") {
      const isTeamLead = evaluation.teamLeadId === authUser?.id;
      const isManagerRole = authUser?.role === "admin" || authUser?.role === "manager" || authUser?.role === "director";
      if (!isTeamLead && !isManagerRole) {
        return res.status(403).json({
          error: "Security Violation: Quotation exceeds sales representative limit. Team Lead approval is required."
        });
      }
    }

    const prevStatus = quote.status;
    await quote.update({ status: "Approved", statusChangedAt: new Date() });

    // Update or mark pending approval requests as Approved
    const pendingReq: any = await sequelize.models.ApprovalRequest.findOne({
      where: { targetId: id, type: "Quote", status: "Pending" }
    });
    if (pendingReq) {
      await pendingReq.update({
        status: "Approved",
        approvedById: authUser?.id || null,
        comments: comments || "Approved"
      });
    }

    // Log Audit Trail
    await createApprovalAuditLog({
      quoteId: id,
      salesRepId: evaluation.salesRepId,
      approvalLevel: evaluation.approvalLevel,
      requiredLimit: evaluation.repLimit,
      actualQuoteValue: evaluation.quoteValue,
      discount: evaluation.discount,
      margin: evaluation.margin,
      approverId: authUser?.id || null,
      decision: "Approved",
      comment: comments || "Self-approved or manager approved",
      previousStatus: prevStatus,
      newStatus: "Approved",
      reason: `Quotation approved. Level: ${evaluation.approvalLevel}`
    });

    res.json({ message: "Quote approved successfully", quote });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── AUDIT LOGS QUERY ──────────────────────────────────────────

export const getApprovalAuditLogs = async (req: Request, res: Response) => {
  try {
    const { quoteId, salesRepId } = req.query;
    const where: any = {};

    if (quoteId) where.quoteId = quoteId;
    if (salesRepId) where.salesRepId = salesRepId;

    const logs = await sequelize.models.ApprovalAuditLog.findAll({
      where,
      include: [
        { model: sequelize.models.User, as: "salesRep", attributes: ["id", "name", "email"] },
        { model: sequelize.models.User, as: "approver", attributes: ["id", "name", "email", "role"] },
        { model: sequelize.models.Quote, as: "quote", attributes: ["id", "quoteNumber", "totalAmount", "status"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Standard fallback exports for tier management
export const createApproval = async (req: Request, res: Response) => {
  return submitQuoteForApproval(req, res);
};

export const getApprovalTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await sequelize.models.ApprovalTier.findAll({ order: [["thresholdValue", "ASC"]] });
    res.json(tiers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createApprovalTier = async (req: Request, res: Response) => {
  try {
    const { name, thresholdValue, requiredRole } = req.body;
    const tier = await sequelize.models.ApprovalTier.create({
      id: require("crypto").randomUUID(),
      name,
      thresholdValue,
      requiredRole: requiredRole || "manager"
    });
    res.status(201).json(tier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteApprovalTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tier = await sequelize.models.ApprovalTier.findByPk(id as string);
    if (!tier) return res.status(404).json({ error: "Approval tier not found." });
    await tier.destroy();
    res.json({ message: "Approval tier deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
