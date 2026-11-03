import { EmailMetadata } from './types';

export interface HeaderRulesResult {
  isBulkOrAuto: boolean;
  reason?: string;
  effectiveSenderEmail: string;
  effectiveSenderName: string;
  isInternal: boolean;
  isContactFormNotification: boolean;
}

const BULK_LOCAL_PARTS = new Set([
  'mailer-daemon',
  'postmaster',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'notification',
  'mailers',
  'newsletter',
  'newsletters',
  'updates-noreply',
  'newsletters-noreply',
  'invitations',
  'marketing',
  'billing',
  'alert',
  'alerts',
]);

/**
 * Deterministic bulk / auto-generated / bounce detection from email headers.
 */
export function checkHeaderRules(emailMeta: EmailMetadata): HeaderRulesResult {
  const headers = emailMeta.headers || {};
  const senderEmail = (emailMeta.senderEmail || '').toLowerCase().trim();
  const replyTo = (emailMeta.replyTo || '').toLowerCase().trim();
  const senderLocalPart = senderEmail.split('@')[0] || '';
  const senderDomain = senderEmail.split('@')[1] || '';

  // 1. Check Internal Domains
  const internalDomainsStr = process.env.INTERNAL_DOMAINS || '';
  const internalDomains = new Set(
    internalDomainsStr
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
  );
  const isInternal = Boolean(senderDomain && internalDomains.has(senderDomain));

  // 2. Check Contact Form Notification Exception:
  // e.g. sender is "no-reply@mywebsite.com" or "webform@...", but Reply-To is a distinct human address
  const isNoreplySender = BULK_LOCAL_PARTS.has(senderLocalPart);
  const hasDistinctReplyTo =
    Boolean(replyTo) &&
    replyTo !== senderEmail &&
    !BULK_LOCAL_PARTS.has((replyTo.split('@')[0] || '').toLowerCase()) &&
    !internalDomains.has((replyTo.split('@')[1] || '').toLowerCase());

  if (isNoreplySender && hasDistinctReplyTo) {
    return {
      isBulkOrAuto: false,
      effectiveSenderEmail: replyTo,
      effectiveSenderName: emailMeta.senderName || replyTo.split('@')[0],
      isInternal,
      isContactFormNotification: true,
    };
  }

  // 3. List-Unsubscribe or List-Id (RFC 2369 / RFC 2919) -> Marketing / Newsletters
  if (headers['list-unsubscribe'] || headers['list-id']) {
    return {
      isBulkOrAuto: true,
      reason: 'header_newsletter_list',
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 4. Precedence: bulk, list, or junk (RFC 2076 / RFC 3834)
  const precedence = (headers['precedence'] || '').toLowerCase();
  if (['bulk', 'list', 'junk'].includes(precedence)) {
    return {
      isBulkOrAuto: true,
      reason: `header_precedence_${precedence}`,
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 5. Auto-Submitted header (RFC 3834): auto-generated, auto-replied, etc. (unless "no")
  const autoSubmitted = (headers['auto-submitted'] || '').toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== 'no') {
    return {
      isBulkOrAuto: true,
      reason: `header_auto_submitted_${autoSubmitted}`,
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 6. Microsoft Exchange X-Auto-Response-Suppress header
  if (headers['x-auto-response-suppress']) {
    return {
      isBulkOrAuto: true,
      reason: 'header_x_auto_response_suppress',
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 7. Bounces / Delivery status reports
  const contentType = (headers['content-type'] || '').toLowerCase();
  if (
    contentType.includes('multipart/report') ||
    contentType.includes('delivery-status') ||
    (emailMeta.subject && /delivery status notification|undelivered mail|failure notice|mail delivery failed/i.test(emailMeta.subject))
  ) {
    return {
      isBulkOrAuto: true,
      reason: 'header_delivery_status_bounce',
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 8. Empty Return-Path ("<>" or "") indicates DSN bounce
  const returnPath = (headers['return-path'] || '').trim();
  if (returnPath === '<>' || returnPath === '""') {
    return {
      isBulkOrAuto: true,
      reason: 'header_empty_return_path_bounce',
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 9. Bulk / Noreply / Automated local-parts
  if (isNoreplySender) {
    return {
      isBulkOrAuto: true,
      reason: `header_noreply_sender_${senderLocalPart}`,
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal,
      isContactFormNotification: false,
    };
  }

  // 10. Sender on internal domain (unless contact-form override)
  if (isInternal) {
    return {
      isBulkOrAuto: true,
      reason: 'header_internal_domain',
      effectiveSenderEmail: senderEmail,
      effectiveSenderName: emailMeta.senderName,
      isInternal: true,
      isContactFormNotification: false,
    };
  }

  return {
    isBulkOrAuto: false,
    effectiveSenderEmail: senderEmail,
    effectiveSenderName: emailMeta.senderName,
    isInternal: false,
    isContactFormNotification: false,
  };
}
