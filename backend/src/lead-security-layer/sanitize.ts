/**
 * Stage 2: Field sanitization.
 * Deterministic, no network calls — this should run on every single lead,
 * regardless of what happens downstream.
 */

// @ts-ignore
const sanitizeHtml: any = require('sanitize-html');

const FIELD_LIMITS: Record<string, number> = {
  name: 120,
  firstName: 60,
  lastName: 60,
  company: 200,
  email: 254, // RFC 5321 max
  phone: 30,
  message: 5000,
  subject: 300,
  body: 5000,
  source_campaign: 200,
};

// Fields that are allowed to contain rich text (e.g. inbound email body).
// Everything else is treated as plain text and fully stripped of markup.
const RICH_TEXT_FIELDS = new Set(['message', 'body']);

export function sanitizeFields(rawLead: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};

  for (const [key, rawValue] of Object.entries(rawLead || {})) {
    if (typeof rawValue !== 'string') {
      // Reject unexpected types outright rather than coercing them —
      // a "phone" field that arrives as an object/array is already suspicious.
      if (rawValue == null) continue;
      throw new Error(`Unexpected type for field "${key}"`);
    }

    let value = rawValue.trim();

    // Strip all HTML/JS. Rich-text fields get a tight allowlist (no <script>,
    // no event handlers, no iframes); everything else gets zero tags.
    value = sanitizeHtml(value, RICH_TEXT_FIELDS.has(key)
      ? {
          allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
          allowedAttributes: {},
        }
      : { allowedTags: [], allowedAttributes: {} }
    );

    const limit = FIELD_LIMITS[key] ?? 500; // sane default for unknown fields
    if (value.length > limit) {
      value = value.slice(0, limit);
    }

    clean[key] = value;
  }

  if (clean.email) validateEmail(clean.email);
  if (clean.phone) clean.phone = normalizePhone(clean.phone);

  return clean;
}

function validateEmail(email: string): void {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) {
    throw new Error('Invalid email format');
  }
}

function normalizePhone(phone: string): string {
  // Keep leading + for country code, strip everything else non-digit.
  return phone.replace(/(?!^\+)[^\d]/g, '');
}
