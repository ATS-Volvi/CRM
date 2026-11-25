import { sequelize } from '@nexus-crm/database';
import { cleanEmailText } from './cleanText';

export interface AttachEmailActivityParams {
  leadId: string;
  subject: string;
  body: string;
  createdById?: string | null;
  channelSource?: 'email' | 'gmail';
}

/**
 * Shared helper for attaching an inbound email to an existing open lead.
 * Used identically by emailController (Mailgun) and gmailController (Gmail sync).
 */
export async function attachEmailToLeadActivity(params: AttachEmailActivityParams) {
  const { Activity, Lead, EmailMessage } = sequelize.models;
  const { handleDealInboundActivity } = require('../../services/leadTemperatureService');

  const cleaned = cleanEmailText(params.body);
  const outcomeText = params.channelSource === 'gmail'
    ? `Gmail sync email attached: ${params.subject || 'No Subject'}`
    : `Email attached to lead: ${params.subject || 'No Subject'}`;

  const activity = await Activity.create({
    id: require('crypto').randomUUID(),
    type: 'email',
    title: params.subject ? `Email: ${params.subject}` : 'Inbound Email',
    outcome: outcomeText,
    notes: cleaned || params.body,
    leadId: params.leadId,
    createdById: params.createdById || null,
    pinned: false,
    priority: 'Medium',
    direction: 'inbound',
  });
  (activity as any).title = params.subject ? `Email: ${params.subject}` : 'Inbound Email';

  const openLead = await Lead.findByPk(params.leadId);
  if (openLead) {
    (openLead as any).lastInboundAt = new Date();
    await openLead.save();

    if (EmailMessage) {
      try {
        await (EmailMessage as any).create({
          id: require('crypto').randomUUID(),
          leadId: params.leadId,
          toEmail: (openLead as any).email || 'customer@inbound',
          subject: params.subject || 'Inbound Email',
          body: cleaned || params.body,
          status: 'Received',
          openedAt: new Date()
        });
      } catch (emErr) {
        console.warn('[attachEmailToLeadActivity] EmailMessage creation notice:', emErr);
      }
    }

    if ((openLead as any).assignedToId) {
      try {
        const { createNotification } = require('../../services/notificationService');
        await createNotification(
          (openLead as any).assignedToId,
          'lead_activity',
          '💬 New Inbound Email Reply',
          `Customer ${(openLead as any).firstName || ''} ${(openLead as any).lastName || ''} replied: "${(cleaned || params.body).substring(0, 100)}"`,
          `/leads/${(openLead as any).id}`
        );
      } catch (notifErr) {
        console.warn('[attachEmailToLeadActivity] Rep notification notice:', notifErr);
      }
    }
  }

  try {
    await handleDealInboundActivity(params.leadId);
  } catch (err: any) {
    console.warn('[attachEmailToLeadActivity] handleDealInboundActivity error:', err.message);
  }

  return activity;
}
