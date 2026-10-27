import { EmailMetadata } from './types';

/**
 * Parses raw headers from SendGrid (string), Mailgun (JSON/array of [name, value]),
 * Gmail (array of { name, value }), or raw objects into a lowercase header map.
 */
export function parseHeaderMap(rawHeaders: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawHeaders) return result;

  // 1. If it's a JSON string (Mailgun often sends message-headers as JSON string)
  if (typeof rawHeaders === 'string') {
    const trimmed = rawHeaders.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseHeaderMap(parsed);
      } catch (e) {
        // Fall back to line-by-line parsing if not JSON
      }
    }

    // Parse RFC 822 / MIME multiline header string (SendGrid format)
    const lines = rawHeaders.split(/\r?\n/);
    let currentKey = '';
    let currentValue = '';

    for (const line of lines) {
      if (/^[ \t]/.test(line)) {
        // Continuation of previous header line
        if (currentKey) {
          currentValue += ' ' + line.trim();
        }
      } else {
        if (currentKey) {
          result[currentKey.toLowerCase()] = currentValue.trim();
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          currentKey = line.substring(0, colonIdx).trim();
          currentValue = line.substring(colonIdx + 1).trim();
        } else {
          currentKey = '';
          currentValue = '';
        }
      }
    }
    if (currentKey) {
      result[currentKey.toLowerCase()] = currentValue.trim();
    }
    return result;
  }

  // 2. If it's an Array (Mailgun [name, value] pairs or Gmail { name, value } objects)
  if (Array.isArray(rawHeaders)) {
    for (const item of rawHeaders) {
      if (!item) continue;
      if (Array.isArray(item) && item.length >= 2) {
        // Mailgun style: ["List-Unsubscribe", "<mailto:...>"]
        const key = String(item[0]).trim().toLowerCase();
        const val = String(item[1]).trim();
        result[key] = val;
      } else if (typeof item === 'object' && ('name' in item || 'Name' in item)) {
        // Gmail style: { name: "List-Unsubscribe", value: "..." }
        const key = String((item as any).name || (item as any).Name).trim().toLowerCase();
        const val = String((item as any).value || (item as any).Value || '').trim();
        result[key] = val;
      }
    }
    return result;
  }

  // 3. If it's a key-value object map
  if (typeof rawHeaders === 'object') {
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        result[k.trim().toLowerCase()] = String(v).trim();
      }
    }
    return result;
  }

  return result;
}

/**
 * Parses sender "Display Name <email@domain.com>" or "email@domain.com"
 */
export function parseEmailAndName(fromStr: string): { senderEmail: string; senderName: string } {
  if (!fromStr) return { senderEmail: '', senderName: '' };

  const emailRegex = /<([^>]+)>/;
  const match = fromStr.match(emailRegex);

  if (match) {
    const senderEmail = match[1].trim().toLowerCase();
    const namePart = fromStr.replace(emailRegex, '').trim().replace(/^["']|["']$/g, '');
    const senderName = namePart || senderEmail.split('@')[0] || '';
    return { senderEmail, senderName };
  }

  const clean = fromStr.trim();
  const atIdx = clean.indexOf('@');
  const senderEmail = clean.toLowerCase();
  const senderName = atIdx > 0 ? clean.substring(0, atIdx) : clean;
  return { senderEmail, senderName };
}

/**
 * Normalizes email metadata from any inbound email provider payload (SendGrid, Mailgun, Gmail API).
 */
export function extractEmailMetadata(rawPayload: any, files?: any[]): EmailMetadata {
  const b = rawPayload || {};

  // Extract raw headers from SendGrid `headers`, Mailgun `message-headers`, or Gmail `payload.headers`
  const rawHeadersField =
    b.headers ||
    b['message-headers'] ||
    b.messageHeaders ||
    b.payload?.headers ||
    b['raw-headers'];

  const headerMap = parseHeaderMap(rawHeadersField);

  // Fallback: check individual header fields if passed at top level
  if (!headerMap['list-unsubscribe'] && (b['list-unsubscribe'] || b['List-Unsubscribe'])) {
    headerMap['list-unsubscribe'] = b['list-unsubscribe'] || b['List-Unsubscribe'];
  }
  if (!headerMap['list-id'] && (b['list-id'] || b['List-Id'])) {
    headerMap['list-id'] = b['list-id'] || b['List-Id'];
  }
  if (!headerMap['auto-submitted'] && (b['auto-submitted'] || b['Auto-Submitted'])) {
    headerMap['auto-submitted'] = b['auto-submitted'] || b['Auto-Submitted'];
  }
  if (!headerMap['x-auto-response-suppress'] && (b['x-auto-response-suppress'] || b['X-Auto-Response-Suppress'])) {
    headerMap['x-auto-response-suppress'] = b['x-auto-response-suppress'] || b['X-Auto-Response-Suppress'];
  }
  if (!headerMap['precedence'] && (b.precedence || b.Precedence)) {
    headerMap['precedence'] = b.precedence || b.Precedence;
  }

  // Sender info
  const rawFrom = b.from || b.sender || b.From || b.Sender || headerMap.from || '';
  const { senderEmail, senderName } = parseEmailAndName(rawFrom);

  // Reply-To header
  const rawReplyTo =
    b['reply-to'] ||
    b.replyTo ||
    b['Reply-To'] ||
    b.reply_to ||
    headerMap['reply-to'] ||
    null;
  const replyTo = rawReplyTo ? parseEmailAndName(rawReplyTo).senderEmail : null;

  // Recipient info
  const rawTo = b.to || b.recipient || b.To || b.Recipient || headerMap.to || null;
  const recipientEmail = rawTo ? parseEmailAndName(rawTo).senderEmail : null;

  // Subject
  const subject = b.subject || b.Subject || headerMap.subject || 'No Subject';

  // Thread identifiers
  const messageId =
    b['message-id'] ||
    b.messageId ||
    b['Message-Id'] ||
    b['Message-ID'] ||
    headerMap['message-id'] ||
    null;

  const inReplyTo =
    b['in-reply-to'] ||
    b.inReplyTo ||
    b['In-Reply-To'] ||
    headerMap['in-reply-to'] ||
    null;

  const references =
    b.references ||
    b.References ||
    headerMap.references ||
    null;

  // Attachments detection
  const attachmentCount = Number(b.attachments || b['attachment-count'] || 0);
  const hasAttachments =
    (Array.isArray(files) && files.length > 0) ||
    attachmentCount > 0 ||
    Boolean(b['attachment-info']) ||
    (Array.isArray(b.payload?.parts) &&
      b.payload.parts.some((p: any) => p.filename && p.filename.length > 0));

  return {
    senderEmail,
    senderName,
    replyTo,
    messageId,
    inReplyTo,
    references,
    hasAttachments,
    headers: headerMap,
    recipientEmail,
    subject,
  };
}
