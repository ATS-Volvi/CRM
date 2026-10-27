import {
  IntentAction,
  IntentLabel,
  IntentConfidence,
  IntentClassifierResult,
} from './types';
import { HeaderRulesResult } from './headerRules';
import { NoContentResult } from './noContent';
import { SenderContextResult } from './senderContext';

export interface DecisionSignals {
  headerResult?: HeaderRulesResult;
  noContentResult?: NoContentResult;
  senderContext?: SenderContextResult;
  classifierResult?: IntentClassifierResult | null;
  classifierError?: string | null;
}

export interface DecisionConfig {
  createMinScore?: number; // default 70
  reviewMinScore?: number; // default 35
}

export interface DecisionOutput {
  action: IntentAction;
  label: IntentLabel;
  score: number;
  confidence: IntentConfidence;
  reason: string;
  language: string;
  openLeadId?: string | null;
}

/**
 * PURE deterministic decision function. Given all signals, decides final action.
 * Fail-safe principle: FAIL TOWARD REVIEW. Never silently create junk, never drop uncertain inquiries.
 */
export function decide(
  signals: DecisionSignals,
  config: DecisionConfig = {}
): DecisionOutput {
  const createMin = config.createMinScore ?? parseInt(process.env.INTENT_CREATE_MIN || '70', 10);
  const reviewMin = config.reviewMinScore ?? parseInt(process.env.INTENT_REVIEW_MIN || '35', 10);

  const {
    headerResult,
    noContentResult,
    senderContext,
    classifierResult,
    classifierError,
  } = signals;

  // 1. Blocklist rule
  if (senderContext?.isBlocklisted) {
    return {
      action: 'ARCHIVE',
      label: 'spam',
      score: 0,
      confidence: 'high',
      language: 'en',
      reason: 'Sender or domain is on blocklist',
    };
  }

  // 2. Allowlist rule
  if (senderContext?.isAllowlisted) {
    if (senderContext.openLeadId) {
      return {
        action: 'ATTACH_EXISTING',
        label: 'existing_contact_reply',
        score: 90,
        confidence: 'high',
        language: 'en',
        reason: 'Allowlisted sender attached to open lead',
        openLeadId: senderContext.openLeadId,
      };
    }
    return {
      action: 'CREATE_LEAD',
      label: 'new_enquiry',
      score: 90,
      confidence: 'high',
      language: 'en',
      reason: 'Allowlisted sender bypasses filter into lead creation',
    };
  }

  // 3. Bulk / Automated / Bounce headers
  if (headerResult?.isBulkOrAuto) {
    let label: IntentLabel = 'newsletter';
    if (headerResult.reason?.includes('bounce') || headerResult.reason?.includes('delivery_status')) {
      label = 'auto_reply';
    } else if (headerResult.reason?.includes('auto_submitted') || headerResult.reason?.includes('auto_response')) {
      label = 'auto_reply';
    }
    return {
      action: 'ARCHIVE',
      label,
      score: 0,
      confidence: 'high',
      language: 'en',
      reason: headerResult.reason || 'Bulk or automated email header detected',
    };
  }

  // 4. No content from a real human (greetings only, filler only, keyboard mash)
  if (noContentResult?.isNoContent) {
    return {
      action: 'PENDING_CLARIFY',
      label: 'too_vague',
      score: 15,
      confidence: 'high',
      language: 'en',
      reason: noContentResult.reason || 'No substantive business content or enquiry detected',
    };
  }

  // 5. Fail-safe on AI classifier error or timeout -> Fail toward REVIEW
  if (classifierError || !classifierResult) {
    return {
      action: 'REVIEW',
      label: 'too_vague',
      score: 50,
      confidence: 'low',
      language: 'en',
      reason: classifierError ? `Classifier error: ${classifierError}` : 'Classifier returned empty verdict',
    };
  }

  const { label, leadScore, confidence, language, reason } = classifierResult;

  // 6. Open lead exists for sender and message is substantive -> ATTACH_EXISTING
  if (senderContext?.openLeadId) {
    if (
      label === 'new_enquiry' ||
      label === 'existing_contact_reply' ||
      label === 'support_request'
    ) {
      return {
        action: 'ATTACH_EXISTING',
        label,
        score: leadScore,
        confidence,
        language,
        reason: `Substantive follow-up message attached to open lead (${senderContext.openLeadId})`,
        openLeadId: senderContext.openLeadId,
      };
    }
  }

  // 7. Support Request rule
  if (label === 'support_request') {
    if (senderContext?.knownContact) {
      return {
        action: 'ATTACH_EXISTING',
        label: 'support_request',
        score: leadScore,
        confidence,
        language,
        reason: 'Support request from known contact attached to record',
      };
    }
    return {
      action: 'REVIEW',
      label: 'support_request',
      score: leadScore,
      confidence,
      language,
      reason: 'Support request from unknown sender held for review',
    };
  }

  // 8. Genuine new lead enquiry with score >= INTENT_CREATE_MIN or high confidence
  if (
    label === 'new_enquiry' &&
    (leadScore >= createMin || (confidence === 'high' && leadScore >= 50)) &&
    confidence !== 'low'
  ) {
    return {
      action: 'CREATE_LEAD',
      label: 'new_enquiry',
      score: leadScore,
      confidence,
      language,
      reason,
    };
  }

  // 9. Junk labels (newsletter, auto_reply, spam, vendor_pitch, irrelevant)
  const junkLabels: IntentLabel[] = [
    'newsletter',
    'auto_reply',
    'spam',
    'vendor_pitch',
    'irrelevant',
  ];
  if (junkLabels.includes(label)) {
    if (confidence === 'high' || leadScore < reviewMin) {
      return {
        action: 'ARCHIVE',
        label,
        score: leadScore,
        confidence,
        language,
        reason,
      };
    }
    // Moderate confidence junk -> REVIEW
    return {
      action: 'REVIEW',
      label,
      score: leadScore,
      confidence,
      language,
      reason: `Moderate confidence ${label} held for human review`,
    };
  }

  // 10. Low score below review threshold
  if (leadScore < reviewMin) {
    return {
      action: 'ARCHIVE',
      label,
      score: leadScore,
      confidence,
      language,
      reason: `Lead score ${leadScore} below review threshold ${reviewMin}`,
    };
  }

  // 11. Fallback for ambiguous or low confidence enquiries -> REVIEW
  return {
    action: 'REVIEW',
    label,
    score: leadScore,
    confidence,
    language,
    reason: reason || 'Borderline inquiry held for human review',
  };
}
