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

// Fields that may legitimately carry non-string values (objects, arrays,
// numbers, booleans) when the pipeline is called with a full LeadPayload
// rather than a raw HTML form submission. These are passed through untouched
// so the sanitizer never throws on internal metadata fields.
const PASSTHROUGH_FIELDS = new Set([
  'rawPayload',
  'categoriesData',
  'assignedToId',
  'leadScore',
  'attachments',
]);

export function sanitizeFields(rawLead: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};

  for (const [key, rawValue] of Object.entries(rawLead || {})) {
    // Pass through null/undefined without adding to clean object.
    if (rawValue == null) continue;

    // Pass through known non-string metadata fields unchanged.
    if (PASSTHROUGH_FIELDS.has(key)) {
      clean[key] = rawValue;
      continue;
    }

    if (typeof rawValue !== 'string') {
      // Non-string, non-null values in unexpected fields are suspicious
      // (e.g. an object in a "phone" field). Pass numeric/boolean primitives
      // through since some form libs send those legitimately; throw on
      // objects/arrays that could mask injection or type-confusion attacks.
      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        clean[key] = rawValue;
        continue;
      }
      // Object or array in a field that should be a string: reject.
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
