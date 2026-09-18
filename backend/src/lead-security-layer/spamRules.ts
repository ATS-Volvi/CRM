/**
 * Stage 4: Deterministic spam/junk rules — catches the bulk of low-effort
 * junk cheaply, before spending an LLM call on it.
 */

import { Lead } from '@nexus-crm/database';
import { Op } from 'sequelize';

// Keep this list updated periodically — this is exactly what HubSpot's
// "domain blocklist" feature does under the hood.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
]);

const GIBBERISH_RE = /^(.)\1{4,}$/; // "aaaaaa", "xxxxxxx" style junk

export interface SpamVerdict {
  isSpam: boolean;
  reason?: string;
}

export async function spamRules(lead: Record<string, any>, meta?: Record<string, any>): Promise<SpamVerdict> {
  // Accepts either raw inbound payloads (name/message) or the Lead schema's
  // own fields (firstName/lastName, body) so this works for both public form
  // submissions and internal Lead objects without breaking either.
  const fullName = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  const bodyText = lead.message || lead.body || '';

  const emailDomain = lead.email?.split('@')[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.has(emailDomain)) {
    return { isSpam: true, reason: 'disposable_email' };
  }

  if (fullName && GIBBERISH_RE.test(fullName.replace(/\s/g, ''))) {
    return { isSpam: true, reason: 'gibberish_name' };
  }

  // Link-stuffing is one of the strongest spam signals in an open-text field.
  const linkCount = (bodyText.match(/https?:\/\//g) || []).length;
  if (linkCount >= 3) {
    return { isSpam: true, reason: 'link_stuffing' };
  }

  // Duplicate submission from the same email in a short window —
  // covers accidental double-submits and simple retry-bots alike.
  if (lead.email) {
    const recentDuplicate = await Lead.findOne({
      where: {
        email: lead.email,
        createdAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentDuplicate) {
      return { isSpam: true, reason: 'duplicate_submission' };
    }
  }

  return { isSpam: false };
}
