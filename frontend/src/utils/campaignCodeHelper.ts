/**
 * Campaign Code Utility Helper
 *
 * Implements:
 * 1. Safe campaign code generation avoiding ambiguous characters (O/0, I/1/L)
 * 2. Case-insensitive uniqueness and charset/length validation
 * 3. Ambiguous character mix detection & non-blocking warning
 */

export const AMBIGUOUS_CHARS_REGEX = /[O0I1L]/g;

// Safe characters for random entropy or filler: excludes O, 0, I, 1, L
export const SAFE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function getChannelCodePrefix(channel?: string | null): string {
  const ch = (channel || "").trim().toLowerCase();
  if (ch.includes("whatsapp")) return "WA";
  if (ch.includes("instagram")) return "GRAM";
  if (ch.includes("email")) return "EM";
  if (ch.includes("web")) return "WEB";
  if (ch.includes("google")) return "GG";
  if (ch.includes("face") || ch.includes("fb")) return "FB";
  if (ch.includes("link")) return "NET";

  // Fallback sanitized uppercase prefix (without ambiguous chars)
  const safe = (channel || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(AMBIGUOUS_CHARS_REGEX, "");
  return safe.slice(0, 3) || "CMP";
}

/**
 * Generate a clean suggestion for a campaign code from campaign name and channel.
 * Uses only uppercase letters, digits, and hyphens.
 * Strictly avoids ambiguous characters (O, 0, I, 1, L) in GENERATED suggestions.
 */
export function generateCampaignCodeSuggestion(
  name?: string | null,
  channel?: string | null,
  existingCodes: string[] = []
): string {
  const prefix = getChannelCodePrefix(channel);

  // Clean name: uppercase, replace whitespace/symbols with hyphens, strip ambiguous chars
  let nameSlug = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(AMBIGUOUS_CHARS_REGEX, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // If slug is empty (e.g. before user typed name or name only contained ambiguous chars),
  // generate a month/year or date-based safe slug without ambiguous chars
  if (!nameSlug) {
    const now = new Date();
    // 2-digit year (e.g. 2026 -> 26, 2 and 6 are safe)
    const year = String(now.getFullYear()).slice(-2).replace(AMBIGUOUS_CHARS_REGEX, "2");
    // Safe month codes (JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC)
    // Strip ambiguous chars: OCT -> CT, etc.
    const monthCodes = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "CT", "NOV", "DEC"
    ];
    const month = (monthCodes[now.getMonth()] || "M").replace(AMBIGUOUS_CHARS_REGEX, "");
    nameSlug = `${month}${year}`;
  }

  // Cap slug length to 16 characters
  if (nameSlug.length > 16) {
    nameSlug = nameSlug.slice(0, 16).replace(/-$/, "");
  }

  // Ensure suggestion contains strictly allowed characters [A-Z0-9-]
  nameSlug = nameSlug.replace(/[^A-Z0-9-]/g, "");

  const baseCode = `${prefix}-${nameSlug}`.replace(AMBIGUOUS_CHARS_REGEX, "");
  let candidate = baseCode;

  // Ensure candidate has no ambiguous characters
  if (!candidate || candidate === "-") {
    candidate = `${prefix}-CMP`;
  }

  // Case-insensitive uniqueness check against existing codes
  const lowerExisting = new Set(
    existingCodes.filter(Boolean).map((c) => c.trim().toLowerCase())
  );

  if (!lowerExisting.has(candidate.toLowerCase())) {
    return candidate;
  }

  // If duplicate exists, append safe numeric suffix (digits 2-9, skipping 0 and 1)
  const safeDigits = [2, 3, 4, 5, 6, 7, 8, 9, 22, 23, 24, 25, 26, 27, 28, 29];
  for (const digit of safeDigits) {
    const candidateWithSuffix = `${candidate}-${digit}`;
    if (!lowerExisting.has(candidateWithSuffix.toLowerCase())) {
      return candidateWithSuffix;
    }
  }

  return `${candidate}-99`;
}

export interface CodeValidationResult {
  isValid: boolean;
  error?: string;
  hasWarning: boolean;
  warning?: string;
}

/**
 * Checks for ambiguous characters (O next to digits, 0 next to letters, I/L next to digits, 1 next to letters, or mixes).
 * Returns non-blocking warning text when found.
 */
export function checkAmbiguousCodeCharacters(code?: string | null): {
  hasWarning: boolean;
  warning?: string;
} {
  if (!code) return { hasWarning: false };
  const str = code.trim();

  // 1. Letter O next to digits, or digit 0 next to letters
  const oNextToDigit = /[Oo][0-9]|[0-9][Oo]/.test(str);
  const zeroNextToLetter = /[0][A-Za-z]|[A-Za-z][0]/.test(str);

  // 2. Letter I or L next to digits, or digit 1 next to letters
  const iOrLNextToDigit = /[IiLl][0-9]|[0-9][IiLl]/.test(str);
  const oneNextToLetter = /[1][A-Za-z]|[A-Za-z][1]/.test(str);

  // 3. Code contains both letter O and digit 0, or both letter I/L and digit 1
  const containsBothOAndZero = /[Oo]/.test(str) && /[0]/.test(str);
  const containsBothIAndOne = /[IiLl]/.test(str) && /[1]/.test(str);

  if (
    oNextToDigit ||
    zeroNextToLetter ||
    iOrLNextToDigit ||
    oneNextToLetter ||
    containsBothOAndZero ||
    containsBothIAndOne
  ) {
    return {
      hasWarning: true,
      warning: "This code mixes O/0 or I/1. Double-check it before sharing links."
    };
  }

  return { hasWarning: false };
}

/**
 * Validates a campaign code on create or edit:
 * - Allowed charset: letters, numbers, hyphens
 * - Length limits: 2 to 50 characters
 * - Uniqueness: case-insensitive
 * - Non-blocking ambiguous character warning
 */
export function validateCampaignCode(
  code: string | undefined | null,
  existingCodes: Array<{ id?: string; code: string }> | string[] = [],
  currentCampaignId?: string | null
): CodeValidationResult {
  if (!code || !code.trim()) {
    return {
      isValid: false,
      error: "Campaign unique code is required.",
      hasWarning: false
    };
  }

  const trimmed = code.trim();

  // Length limits
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: "Campaign code must be at least 2 characters long.",
      hasWarning: false
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: "Campaign code cannot exceed 50 characters.",
      hasWarning: false
    };
  }

  // Allowed charset: uppercase letters, digits, and hyphens (allows typing lowercase, validates charset)
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: "Campaign code may only contain uppercase letters, numbers, and hyphens.",
      hasWarning: false
    };
  }

  // Case-insensitive uniqueness validation
  const lowerCode = trimmed.toLowerCase();
  const isDuplicate = existingCodes.some((entry) => {
    if (typeof entry === "string") {
      return entry.trim().toLowerCase() === lowerCode;
    }
    if (entry && typeof entry === "object") {
      if (currentCampaignId && entry.id === currentCampaignId) {
        return false;
      }
      return (entry.code || "").trim().toLowerCase() === lowerCode;
    }
    return false;
  });

  if (isDuplicate) {
    return {
      isValid: false,
      error: `Campaign code '${trimmed}' is already in use (codes are case-insensitive).`,
      hasWarning: false
    };
  }

  // Non-blocking warning check
  const warningCheck = checkAmbiguousCodeCharacters(trimmed);

  return {
    isValid: true,
    hasWarning: warningCheck.hasWarning,
    warning: warningCheck.warning
  };
}
