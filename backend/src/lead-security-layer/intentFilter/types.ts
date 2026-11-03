export interface EmailMetadata {
  senderEmail: string;
  senderName: string;
  replyTo?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  hasAttachments: boolean;
  headers: Record<string, string>;
  recipientEmail?: string | null;
  subject?: string;
}

export type IntentAction =
  | 'CREATE_LEAD'
  | 'ATTACH_EXISTING'
  | 'PENDING_CLARIFY'
  | 'REVIEW'
  | 'ARCHIVE';

export type IntentLabel =
  | 'new_enquiry'
  | 'existing_contact_reply'
  | 'support_request'
  | 'vendor_pitch'
  | 'newsletter'
  | 'auto_reply'
  | 'spam'
  | 'irrelevant'
  | 'too_vague';

export type IntentConfidence = 'low' | 'medium' | 'high';

export interface IntentClassifierResult {
  label: IntentLabel;
  leadScore: number;
  confidence: IntentConfidence;
  language: string;
  reason: string;
}

export interface IntentDecisionResult {
  action: IntentAction;
  label: IntentLabel;
  score: number;
  confidence: IntentConfidence;
  reason: string;
  language?: string;
  wouldHaveBlocked: boolean;
  enforced: boolean;
  openLeadId?: string | null;
}
