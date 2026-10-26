import { sequelize } from '@nexus-crm/database';
import { Op } from 'sequelize';
import { EmailMetadata } from './types';
import { SenderContextResult } from './senderContext';
import { checkHeaderRules } from './headerRules';
import { sendEmail } from '../../services/emailService';

// Global in-memory counter for hourly safety cap
let hourlyCounter = { count: 0, hourStart: Date.now() };
const GLOBAL_HOURLY_AUTO_REPLY_CAP = 30;

function checkHourlyRateLimit(): boolean {
  const now = Date.now();
  if (now - hourlyCounter.hourStart > 60 * 60 * 1000) {
    hourlyCounter = { count: 1, hourStart: now };
    return true;
  }
  if (hourlyCounter.count >= GLOBAL_HOURLY_AUTO_REPLY_CAP) {
    return false;
  }
  hourlyCounter.count++;
  return true;
}

export async function shouldSendClarificationAutoReply(
  emailMeta: EmailMetadata,
  senderContext: SenderContextResult
): Promise<boolean> {
  const isEnabled = process.env.INTENT_AUTOREPLY_ENABLED === 'true';
  const mode = (process.env.INTENT_FILTER_MODE || 'shadow').toLowerCase();

  if (!isEnabled || mode !== 'enforce') {
    return false;
  }

  // Loop safety 1: Never reply to bulk / auto / bounce headers
  const headerCheck = checkHeaderRules(emailMeta);
  if (headerCheck.isBulkOrAuto) {
    return false;
  }

  // Loop safety 2: Blocklisted sender
  if (senderContext.isBlocklisted) {
    return false;
  }

  // Loop safety 3: Noreply / mailer-daemon local parts
  const localPart = (emailMeta.senderEmail.split('@')[0] || '').toLowerCase();
  if (['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'donotreply'].includes(localPart)) {
    return false;
  }

  // Loop safety 4: Cooldown period check (default 7 days)
  const cooldownDays = parseInt(process.env.INTENT_AUTOREPLY_COOLDOWN_DAYS || '7', 10);
  const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const { FlaggedLead } = sequelize.models;
  if (FlaggedLead) {
    try {
      const recentReply = await FlaggedLead.findOne({
        where: {
          senderEmail: { [Op.like]: emailMeta.senderEmail.toLowerCase() },
          autoReplySentAt: { [Op.gte]: cooldownDate },
        },
      });
      if (recentReply) {
        return false;
      }
    } catch (e) {}
  }

  // Loop safety 5: Global hourly cap
  if (!checkHourlyRateLimit()) {
    console.warn('[autoReplyService] Global hourly auto-reply cap reached, skipping reply');
    return false;
  }

  return true;
}

export async function sendClarificationAutoReply(
  recipientEmail: string,
  flaggedLeadId?: string
): Promise<boolean> {
  try {
    const subject = 'Thanks for reaching out - Nexus CRM';
    const message = 'Thanks for reaching out! What are you looking for: a quote, a product enquiry, or support?';
    const htmlContent = `
      <div style="font-family: sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
        <p>Hello,</p>
        <p>${message}</p>
        <p>Best regards,<br/>The Sales & Support Team</p>
      </div>
    `;

    // Dispatch email with loop-safety headers
    const headers = {
      'Auto-Submitted': 'auto-replied',
      'X-Auto-Response-Suppress': 'All',
    };
    await sendEmail(recipientEmail, subject, htmlContent, undefined, headers);

    // Update FlaggedLead record with autoReplySentAt timestamp
    if (flaggedLeadId && sequelize.models.FlaggedLead) {
      await sequelize.models.FlaggedLead.update(
        { autoReplySentAt: new Date() },
        { where: { id: flaggedLeadId } }
      );
    }
    return true;
  } catch (err: any) {
    console.error('[autoReplyService] Failed to send clarification auto-reply:', err.message);
    return false;
  }
}

/**
 * Promote-on-reply: If the sender had a held message under pending_clarification within cooldown window
 * and now sent a substantive enquiry that passed the gate, link and promote the held row.
 */
export async function handlePromoteOnReply(
  senderEmail: string,
  newLeadId: string
): Promise<void> {
  const { FlaggedLead, Activity } = sequelize.models;
  if (!FlaggedLead || !senderEmail) return;

  try {
    const cooldownDays = parseInt(process.env.INTENT_AUTOREPLY_COOLDOWN_DAYS || '7', 10);
    const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

    const heldRow = await FlaggedLead.findOne({
      where: {
        senderEmail: { [Op.like]: senderEmail.toLowerCase() },
        disposition: 'pending_clarification',
        createdAt: { [Op.gte]: cooldownDate },
      },
      order: [['createdAt', 'DESC']],
    });

    if (heldRow) {
      (heldRow as any).disposition = 'promoted';
      (heldRow as any).promotedLeadId = newLeadId;
      (heldRow as any).reviewedAt = new Date();
      await (heldRow as any).save();

      // Attach original held message to the new lead as an activity for historical context
      if (Activity && (heldRow as any).payload) {
        const origSubject = (heldRow as any).subject || (heldRow as any).payload?.subject || 'Initial Inquiry';
        const origBody = (heldRow as any).payload?.text || (heldRow as any).payload?.body || 'Initial held message';

        await Activity.create({
          id: require('crypto').randomUUID(),
          type: 'Email Received',
          outcome: `Promoted Initial Message: ${origSubject}`,
          notes: origBody,
          leadId: newLeadId,
          pinned: false,
          priority: 'Low',
          direction: 'inbound',
        });
      }
    }
  } catch (err: any) {
    console.warn('[autoReplyService] Non-blocking promote-on-reply error:', err.message);
  }
}
