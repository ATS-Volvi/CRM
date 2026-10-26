import { sequelize } from '@nexus-crm/database';
import {
  EmailMetadata,
  IntentDecisionResult,
  IntentClassifierResult,
} from './types';
import { checkHeaderRules, HeaderRulesResult } from './headerRules';
import { cleanEmailText } from './cleanText';
import { checkNoContent, NoContentResult } from './noContent';
import { getSenderContext, SenderContextResult } from './senderContext';
import {
  classifyIntent,
  _setIntentHandler,
  _clearClassifierCache,
} from './intentClassifier';
import { decide, DecisionSignals } from './decision';
import { extractEmailMetadata, parseHeaderMap } from './headerParser';

export * from './types';
export * from './headerRules';
export * from './cleanText';
export * from './noContent';
export * from './senderContext';
export * from './intentClassifier';
export * from './decision';
export * from './headerParser';

/**
 * Main evaluation pipeline for inbound emails.
 * Evaluates inbound email against deterministic headers, text cleaning,
 * tokenization, sender database context, and AI intent classifier.
 */
export async function evaluateInboundEmail(
  channel: string = 'email',
  emailMeta: EmailMetadata,
  rawText: string,
  createdLeadId?: string | null
): Promise<IntentDecisionResult> {
  const mode = (process.env.INTENT_FILTER_MODE || 'shadow').toLowerCase();
  const configuredChannels = (process.env.INTENT_FILTER_CHANNELS || 'email')
    .split(',')
    .map((c) => c.trim().toLowerCase());

  // If gate is completely off or channel is not configured
  if (mode === 'off' || !configuredChannels.includes(channel.toLowerCase())) {
    return {
      action: 'CREATE_LEAD',
      label: 'new_enquiry',
      score: 50,
      confidence: 'medium',
      reason: 'Intent filter disabled or channel bypassed',
      wouldHaveBlocked: false,
      enforced: false,
    };
  }

  // 1. Sender Database Context (Allow/Block lists, Contacts, Open Leads)
  const senderContext = await getSenderContext(emailMeta.senderEmail);

  // 2. Deterministic Header Rules
  const headerResult = checkHeaderRules(emailMeta);

  // If effective sender email was modified (contact form notification exception), update emailMeta
  if (headerResult.effectiveSenderEmail && headerResult.effectiveSenderEmail !== emailMeta.senderEmail) {
    emailMeta.senderEmail = headerResult.effectiveSenderEmail;
    emailMeta.senderName = headerResult.effectiveSenderName || emailMeta.senderName;
  }

  // 3. Clean Text (include subject + body so subjects with intent words like "Quote" or "Price" are recognized)
  const fullText = `${emailMeta.subject || ''} ${rawText}`.trim();
  const cleanedText = cleanEmailText(fullText);

  // 4. No Content / Low Token Filter
  const noContentResult = checkNoContent(cleanedText, emailMeta.hasAttachments);

  // 5. Evaluate if AI Classification is needed
  // If sender is allowlisted or blocklisted, or headers indicate bulk/bounce, or no content, we can decide without AI!
  let classifierResult: IntentClassifierResult | null = null;
  let classifierError: string | null = null;

  const needsAiClassification =
    !senderContext.isBlocklisted &&
    !senderContext.isAllowlisted &&
    !headerResult.isBulkOrAuto &&
    !noContentResult.isNoContent;

  if (needsAiClassification) {
    try {
      classifierResult = await classifyIntent(emailMeta, cleanedText);
    } catch (err: any) {
      console.error('[intentFilter] Classifier error:', err.message);
      classifierError = err.message || 'Classification failed';
    }
  }

  // 6. Make final decision
  const signals: DecisionSignals = {
    headerResult,
    noContentResult,
    senderContext,
    classifierResult,
    classifierError,
  };

  const decision = decide(signals);

  const wouldHaveBlocked = decision.action !== 'CREATE_LEAD';
  const isEnforced = mode === 'enforce';

  // 7. Persist IntentDecisions audit record (isolated try/catch, must never propagate or break evaluation)
  try {
    await logIntentDecision({
      channel,
      senderEmail: emailMeta.senderEmail,
      subject: emailMeta.subject || 'No Subject',
      label: decision.label,
      leadScore: decision.score,
      confidence: decision.confidence,
      action: decision.action,
      reason: decision.reason,
      language: decision.language,
      wouldHaveBlocked,
      enforced: isEnforced,
      leadId: createdLeadId || null,
    });
  } catch (logErr: any) {
    console.warn('[intentFilter] Error writing intent decision audit log:', logErr.message);
  }

  // In SHADOW mode: log what would happen, but allow CREATE_LEAD downstream
  if (!isEnforced) {
    return {
      action: 'CREATE_LEAD',
      label: decision.label,
      score: decision.score,
      confidence: decision.confidence,
      reason: decision.reason,
      language: decision.language,
      wouldHaveBlocked,
      enforced: false,
      openLeadId: decision.openLeadId,
    };
  }

  return {
    action: decision.action,
    label: decision.label,
    score: decision.score,
    confidence: decision.confidence,
    reason: decision.reason,
    language: decision.language,
    wouldHaveBlocked,
    enforced: true,
    openLeadId: decision.openLeadId,
  };
}

async function logIntentDecision(data: {
  channel: string;
  senderEmail: string;
  subject: string;
  label: string;
  leadScore: number;
  confidence: string;
  action: string;
  reason: string;
  language?: string;
  wouldHaveBlocked: boolean;
  enforced: boolean;
  leadId?: string | null;
}): Promise<void> {
  const { IntentDecision } = sequelize.models;
  if (!IntentDecision) return;

  try {
    await (IntentDecision as any).create({
      id: require('crypto').randomUUID(),
      channel: data.channel,
      senderEmail: data.senderEmail,
      subject: data.subject.slice(0, 255),
      label: data.label,
      leadScore: data.leadScore,
      confidence: data.confidence,
      action: data.action,
      reason: data.reason.slice(0, 500),
      language: data.language || 'en',
      wouldHaveBlocked: data.wouldHaveBlocked,
      enforced: data.enforced,
      leadId: data.leadId || null,
    });
  } catch (err: any) {
    // Audit logging failure must never crash ingestion
    console.warn('[intentFilter] Could not write IntentDecision log:', err.message);
  }
}
