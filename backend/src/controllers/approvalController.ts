import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";

export const getApprovals = async (req: Request, res: Response) => {
  try {
    const approvals = await sequelize.models.ApprovalRequest.findAll({
      include: [
        { model: sequelize.models.User, as: "requestedBy" },
        { model: sequelize.models.User, as: "approvedBy" },
      ],
      order: [['createdAt', 'DESC']]
    });

    // Manually fetch targets since polymorphic associations in Sequelize can be tricky
    const approvalsWithTargets = await Promise.all(approvals.map(async (approval: any) => {
      const data = approval.toJSON();
      if (data.type === 'Quote') {
        data.target = await sequelize.models.Quote.findByPk(data.targetId, {
          include: [{ model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }]
        });
      }
      return data;
    }));

    res.json(approvalsWithTargets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateApproval = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    const approval = await sequelize.models.ApprovalRequest.findByPk(id as string);
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }
    
    // In a real app we'd get the approver from the token (req.user.id)
    // For now we assume the frontend passes it or we omit it for testing.

    await approval.update({
      status,
      comments: comments || (approval as any).comments
    });
    
    // If it's a quote approval, we should update the Quote status too
    if ((approval as any).type === 'Quote' && status === 'Approved') {
       const quote = await sequelize.models.Quote.findByPk((approval as any).targetId);
       if (quote) {
         await quote.update({ status: 'Approved' });
       }
    } else if ((approval as any).type === 'Quote' && status === 'Rejected') {
       const quote = await sequelize.models.Quote.findByPk((approval as any).targetId);
       if (quote) {
         await quote.update({ status: 'Rejected' });
       }
    }

    res.json(approval);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createApproval = async (req: Request, res: Response) => {
  try {
    const { targetId, type, requestedById, comments } = req.body;

    const approval = await sequelize.models.ApprovalRequest.create({
      id: require('crypto').randomUUID(),
      targetId,
      type,
      requestedById,
      status: "Pending",
      comments
    });

    // Mock notify the designated approver (we'll assume admin user for now)
    const admin = await sequelize.models.User.findOne({ where: { role: 'admin' } });
    if (admin) {
      await createNotification(
        (admin as any).id,
        'alert',
        'New Approval Request',
        `A new ${type} approval request requires your attention.`,
        `/approvals`
      );
    }

    res.status(201).json(approval);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
