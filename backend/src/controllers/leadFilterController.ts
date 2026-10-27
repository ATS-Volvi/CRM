import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  sequelize,
  FlaggedLead,
  IntentDecision,
  SenderRule,
  Lead,
  User,
} from '@nexus-crm/database';
import { ingestLead } from '../services/leadIngestion';

/**
 * @swagger
 * /lead-filter/held:
 *   get:
 *     summary: Retrieve paginated held/filtered emails
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: disposition
 *         schema:
 *           type: string
 *           enum: [review, pending_clarification, archived, promoted, rejected]
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of filtered emails with pagination
 */
export const getHeldEmails = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const disposition = req.query.disposition as string;
    const channel = req.query.channel as string;
    const search = (req.query.search as string || '').trim().toLowerCase();

    const where: any = {};

    if (disposition) {
      where.disposition = disposition;
    }
    if (channel) {
      where.channel = channel;
    }
    if (search) {
      where[Op.or] = [
        { senderEmail: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } },
        { explanation: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await FlaggedLead.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: User, as: 'reviewedBy', attributes: ['id', 'name', 'email'], required: false },
        { model: Lead, as: 'promotedLead', attributes: ['id', 'firstName', 'lastName', 'email', 'leadNumber'], required: false },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      items: rows,
      total: count,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    console.error('[leadFilterController] getHeldEmails error:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve held emails' });
  }
};

/**
 * @swagger
 * /lead-filter/held/{id}/promote:
 *   post:
 *     summary: Promote a held email into a genuine CRM Lead
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addSenderToAllowlist:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Email promoted successfully
 */
export const promoteHeldEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { addSenderToAllowlist } = req.body || {};
    const userId = (req as any).user?.id || null;

    const heldId = String(id);
    const heldRow = (await FlaggedLead.findByPk(heldId)) as any;
    if (!heldRow) {
      return res.status(404).json({ error: 'Held email record not found' });
    }

    const payload = heldRow.payload || {};
    const email = (heldRow.senderEmail || payload.email || payload.from || '').toLowerCase().trim();
    const subject = heldRow.subject || payload.subject || 'Promoted Inbound Email';
    const message = payload.text || payload.body || payload.message || heldRow.explanation || '';

    let firstName = payload.firstName;
    let lastName = payload.lastName;

    if (!firstName && email) {
      const namePart = email.split('@')[0] || 'Email';
      firstName = namePart.split('.')[0] || namePart;
      lastName = namePart.split('.')[1] || 'Lead';
    }

    // Ingest as genuine Lead with bypass flag so it is not re-filtered
    const newLeadId = await ingestLead({
      firstName: firstName || 'Inbound',
      lastName: lastName || 'Lead',
      email,
      phone: payload.phone || '',
      company: payload.company || '',
      source: 'email',
      sourceDetail: subject,
      message,
      skipIntentGate: true,
      rawPayload: { ...payload, skipIntentGate: true },
    } as any);

    if (!newLeadId) {
      return res.status(500).json({ error: 'Failed to ingest lead during promotion' });
    }

    // Update FlaggedLead
    heldRow.disposition = 'promoted';
    heldRow.promotedLeadId = newLeadId;
    heldRow.reviewedById = userId;
    heldRow.reviewedAt = new Date();
    await heldRow.save();

    // Optionally add sender to allowlist
    if (addSenderToAllowlist && email) {
      try {
        await SenderRule.findOrCreate({
          where: { matchType: 'email', value: email },
          defaults: {
            id: require('crypto').randomUUID(),
            type: 'allow',
            matchType: 'email',
            value: email,
            createdById: userId,
            note: `Auto-allowlisted upon promoting held email ${id}`,
          },
        });
      } catch (allowErr: any) {
        console.warn('[leadFilterController] Failed to auto-allowlist sender:', allowErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Held email successfully promoted to Lead',
      leadId: newLeadId,
      lead: { id: newLeadId, email },
      disposition: 'promoted',
    });
  } catch (err: any) {
    console.error('[leadFilterController] promoteHeldEmail error:', err);
    res.status(500).json({ error: err.message || 'Failed to promote held email' });
  }
};

/**
 * @swagger
 * /lead-filter/held/{id}/reject:
 *   post:
 *     summary: Reject a held email and optionally block sender or domain
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               blockSender:
 *                 type: boolean
 *               blockDomain:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Email rejected successfully
 */
export const rejectHeldEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { blockSender, blockDomain } = req.body || {};
    const userId = (req as any).user?.id || null;

    const heldId = String(id);
    const heldRow = (await FlaggedLead.findByPk(heldId)) as any;
    if (!heldRow) {
      return res.status(404).json({ error: 'Held email record not found' });
    }

    heldRow.disposition = 'rejected';
    heldRow.reviewedById = userId;
    heldRow.reviewedAt = new Date();
    await heldRow.save();

    const email = (heldRow.senderEmail || heldRow.payload?.email || '').toLowerCase().trim();
    const domain = email.split('@')[1];

    if (blockSender && email) {
      try {
        await SenderRule.findOrCreate({
          where: { matchType: 'email', value: email },
          defaults: {
            id: require('crypto').randomUUID(),
            type: 'block',
            matchType: 'email',
            value: email,
            createdById: userId,
            note: `Blocked upon rejecting held email ${id}`,
          },
        });
      } catch (e: any) {
        console.warn('[leadFilterController] Failed to block sender:', e.message);
      }
    }

    if (blockDomain && domain) {
      try {
        await SenderRule.findOrCreate({
          where: { matchType: 'domain', value: domain },
          defaults: {
            id: require('crypto').randomUUID(),
            type: 'block',
            matchType: 'domain',
            value: domain,
            createdById: userId,
            note: `Domain blocked upon rejecting held email ${id}`,
          },
        });
      } catch (e: any) {
        console.warn('[leadFilterController] Failed to block domain:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Held email rejected',
      disposition: 'rejected',
    });
  } catch (err: any) {
    console.error('[leadFilterController] rejectHeldEmail error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject held email' });
  }
};

/**
 * @swagger
 * /lead-filter/stats:
 *   get:
 *     summary: Retrieve aggregate statistics and metrics for the Intent Filter
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Intent filter stats and confusion summary
 */
export const getFilterStats = async (req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Actions counts
    const actionCounts: Record<string, number> = {
      CREATE_LEAD: 0,
      ATTACH_EXISTING: 0,
      PENDING_CLARIFY: 0,
      REVIEW: 0,
      ARCHIVE: 0,
    };

    // 2. Labels counts
    const labelCounts: Record<string, number> = {};

    let totalDecisions = 0;
    let wouldHaveBlockedCount = 0;

    if (IntentDecision) {
      const decisions = (await IntentDecision.findAll()) as any[];
      totalDecisions = decisions.length;

      for (const d of decisions) {
        if (d.action && actionCounts[d.action] !== undefined) {
          actionCounts[d.action]++;
        }
        if (d.label) {
          labelCounts[d.label] = (labelCounts[d.label] || 0) + 1;
        }
        if (d.wouldHaveBlocked) {
          wouldHaveBlockedCount++;
        }
      }
    }

    // 3. FlaggedLeads counts
    let heldToday = 0;
    let archivedToday = 0;
    let promotedAfterHold = 0;
    let needsReviewCount = 0;
    let waitingReplyCount = 0;

    if (FlaggedLead) {
      heldToday = await FlaggedLead.count({
        where: {
          createdAt: { [Op.gte]: todayStart },
          disposition: { [Op.in]: ['review', 'pending_clarification'] },
        },
      });

      archivedToday = await FlaggedLead.count({
        where: {
          createdAt: { [Op.gte]: todayStart },
          disposition: 'archived',
        },
      });

      promotedAfterHold = await FlaggedLead.count({
        where: {
          disposition: 'promoted',
        },
      });

      needsReviewCount = await FlaggedLead.count({
        where: {
          disposition: 'review',
        },
      });

      waitingReplyCount = await FlaggedLead.count({
        where: {
          disposition: 'pending_clarification',
        },
      });
    }

    const mode = process.env.INTENT_FILTER_MODE || 'shadow';

    res.json({
      mode,
      totalDecisions,
      wouldHaveBlockedCount,
      heldToday,
      archivedToday,
      promotedAfterHold,
      needsReviewCount,
      waitingReplyCount,
      actions: actionCounts,
      labels: labelCounts,
    });
  } catch (err: any) {
    console.error('[leadFilterController] getFilterStats error:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve stats' });
  }
};

/**
 * @swagger
 * /lead-filter/shadow-logs:
 *   get:
 *     summary: Retrieve paginated shadow decision logs
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 */
export const getShadowLogs = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await IntentDecision.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      items: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve shadow logs' });
  }
};

/**
 * @swagger
 * /lead-filter/sender-rules:
 *   get:
 *     summary: Retrieve all allowlist and blocklist sender rules
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 */
export const getSenderRules = async (req: Request, res: Response) => {
  try {
    const rules = await SenderRule.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'], required: false },
      ],
    });
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve sender rules' });
  }
};

/**
 * @swagger
 * /lead-filter/sender-rules:
 *   post:
 *     summary: Create an allow or block rule for an email or domain
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 */
export const createSenderRule = async (req: Request, res: Response) => {
  try {
    const { type, matchType, value, note } = req.body;
    const userId = (req as any).user?.id || null;

    if (!['allow', 'block'].includes(type)) {
      return res.status(400).json({ error: "Rule type must be 'allow' or 'block'" });
    }
    if (!['email', 'domain'].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be 'email' or 'domain'" });
    }
    if (!value || typeof value !== 'string') {
      return res.status(400).json({ error: 'value is required' });
    }

    const cleanValue = value.trim().toLowerCase();

    const [rule, created] = await SenderRule.findOrCreate({
      where: { matchType, value: cleanValue },
      defaults: {
        id: require('crypto').randomUUID(),
        type,
        matchType,
        value: cleanValue,
        createdById: userId,
        note: note || null,
      },
    });

    if (!created) {
      rule.type = type;
      if (note) rule.note = note;
      rule.createdById = userId;
      await rule.save();
    }

    res.status(created ? 201 : 200).json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create sender rule' });
  }
};

/**
 * @swagger
 * /lead-filter/sender-rules/{id}:
 *   delete:
 *     summary: Delete a sender rule
 *     tags: [Lead Intent Filter]
 *     security:
 *       - bearerAuth: []
 */
export const deleteSenderRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ruleId = String(id);
    const deletedCount = await SenderRule.destroy({ where: { id: ruleId } });
    if (!deletedCount) {
      return res.status(404).json({ error: 'Sender rule not found' });
    }
    res.json({ success: true, message: 'Sender rule deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete sender rule' });
  }
};
