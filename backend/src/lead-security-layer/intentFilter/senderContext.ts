import { sequelize } from '@nexus-crm/database';
import { Op } from 'sequelize';

export interface SenderContextResult {
  senderEmail: string;
  senderDomain: string;
  knownContact: any | null;
  openLeadId: string | null;
  lastInboundAt: Date | null;
  isAllowlisted: boolean;
  isBlocklisted: boolean;
  pendingClarificationId: string | null;
}

const TERMINAL_LEAD_STATUSES = [
  'Won',
  'Lost',
  'Closed',
  'Closed Won',
  'Closed Lost',
  'Not Converted',
  'Archived',
];

/**
 * Looks up sender in Contact, Lead, FlaggedLeads, and SenderRules.
 */
export async function getSenderContext(
  email: string
): Promise<SenderContextResult> {
  const senderEmail = (email || '').trim().toLowerCase();
  const senderDomain = senderEmail.split('@')[1] || '';

  const { Contact, Lead, SenderRule, FlaggedLead } = sequelize.models;

  let knownContact: any = null;
  let openLeadId: string | null = null;
  let lastInboundAt: Date | null = null;
  let isAllowlisted = false;
  let isBlocklisted = false;
  let pendingClarificationId: string | null = null;

  // 1. Check SenderRules (Allowlist / Blocklist) if table exists
  if (SenderRule) {
    try {
      const matchingRules = await (SenderRule as any).findAll({
        where: {
          [Op.or]: [
            { matchType: 'email', value: { [Op.like]: senderEmail } },
            { matchType: 'domain', value: { [Op.like]: senderDomain } },
          ],
        },
      });

      for (const rule of matchingRules) {
        if (rule.type === 'block') {
          isBlocklisted = true;
        } else if (rule.type === 'allow') {
          isAllowlisted = true;
        }
      }
    } catch (e: any) {
      // SenderRule table might be created in next migration phase
    }
  }

  // 2. Check Contact
  if (Contact && senderEmail) {
    try {
      knownContact = await Contact.findOne({
        where: {
          email: { [Op.like]: senderEmail },
        },
      });
    } catch (e: any) {
      console.warn('[senderContext] Contact lookup error:', e.message);
    }
  }

  // 3. Check Open Lead
  const attachWindowDays = parseInt(process.env.INTENT_ATTACH_WINDOW_DAYS || '60', 10);
  const attachWindowDate = new Date(Date.now() - attachWindowDays * 24 * 60 * 60 * 1000);

  if (Lead && senderEmail) {
    try {
      const openLead = await Lead.findOne({
        where: {
          email: { [Op.like]: senderEmail },
          status: {
            [Op.notIn]: TERMINAL_LEAD_STATUSES,
          },
          [Op.or]: [
            { createdAt: { [Op.gte]: attachWindowDate } },
            { lastInboundAt: { [Op.gte]: attachWindowDate } },
          ],
        },
        order: [['createdAt', 'DESC']],
      });

      if (openLead) {
        openLeadId = (openLead as any).id;
        lastInboundAt = (openLead as any).lastInboundAt || (openLead as any).createdAt;
      }
    } catch (e: any) {
      console.warn('[senderContext] Open Lead lookup error:', e.message);
    }
  }

  // 4. Check for existing pending clarification in FlaggedLeads
  if (FlaggedLead && senderEmail) {
    try {
      const cooldownDays = parseInt(process.env.INTENT_AUTOREPLY_COOLDOWN_DAYS || '7', 10);
      const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

      const pendingRow = await FlaggedLead.findOne({
        where: {
          senderEmail: { [Op.like]: senderEmail },
          disposition: 'pending_clarification',
          createdAt: { [Op.gte]: cooldownDate },
        },
        order: [['createdAt', 'DESC']],
      });

      if (pendingRow) {
        pendingClarificationId = (pendingRow as any).id;
      }
    } catch (e: any) {
      // FlaggedLeads columns may be added in Phase 3 migration
    }
  }

  return {
    senderEmail,
    senderDomain,
    knownContact,
    openLeadId,
    lastInboundAt,
    isAllowlisted,
    isBlocklisted,
    pendingClarificationId,
  };
}
