/**
 * Cleans email body text by stripping HTML tags, quoted replies, signatures,
 * mobile device footers, and legal disclaimers.
 */
export function cleanEmailText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  let text = rawText;

  // 1. Convert HTML block tags to newlines before line inspection so thread headers are on their own lines
  text = text
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|table|blockquote)>/gi, "\n")
    .replace(/<hr\s*[\/]?>/gi, "\n");

  // 2. Cut quoted threads, headers, and footers before stripping tags or email addresses
  const lines = text.split(/\r?\n/);
  const keptLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // "On Mon, Jan 1, 2026 at 10:00 AM John <... wrote:"
    if (/^On\s+.+wrote\s*:?\s*$/i.test(trimmed)) {
      break;
    }
    // "-----Original Message-----" or "--- Original Message ---"
    if (/^[-=]+\s*Original Message\s*[-=]+$/i.test(trimmed)) {
      break;
    }
    // Outlook horizontal line separator: "________________________________"
    if (/^_{5,}\s*$/i.test(trimmed)) {
      break;
    }

    // Thread header lines: "From: someone@example.com" or "From: John Doe <...>"
    if (/^From\s*:\s*.+/i.test(trimmed)) {
      if (
        /@|<.+>|\[mailto:.+\]/i.test(trimmed) ||
        (i + 1 < lines.length && /^(?:Sent|To|Subject|Date)\s*:/i.test(lines[i + 1].trim()))
      ) {
        break;
      }
      if (/^From\s*:\s*["']?[A-Z]/i.test(trimmed)) {
        break;
      }
    }

    // "Sent: Monday, January 12, 2026 10:00 AM"
    if (/^Sent\s*:\s*.+/i.test(trimmed)) {
      break;
    }

    // Standard RFC signature delimiter: "-- " or "--"
    if (trimmed === "--" || trimmed === "-- ") {
      break;
    }

    // Skip lines that start with ">" (quoted text)
    if (trimmed.startsWith(">")) {
      continue;
    }

    // Mobile footers
    if (
      /^sent from my (?:iphone|ipad|android|galaxy|pixel|blackberry)/i.test(trimmed) ||
      /^sent from outlook for (?:ios|android)/i.test(trimmed) ||
      /^get outlook for (?:ios|android)/i.test(trimmed)
    ) {
      continue;
    }

    // Common disclaimer headers
    if (
      /^(?:disclaimer|confidentiality notice)\s*:/i.test(trimmed) ||
      /^this (?:email|message) (?:and any (?:files|attachments)|is confidential)/i.test(trimmed) ||
      /^the information contained in this (?:email|message|communication) is confidential/i.test(trimmed)
    ) {
      break;
    }

    keptLines.push(line);
  }

  text = keptLines.join("\n");

  // 3. Strip styles, scripts, comments, and real HTML tags (preserve bracketed email addresses like <user@domain.com>)
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Only strip tags that are not email addresses
  text = text.replace(/<(?!s*[^@\s>]+@[^@\s>]+>)[^>]+>/gi, " ");

  // 4. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");

  // 5. Normalize line breaks and whitespace
  const cleaned = text
    .split(/\r?\n/)
    .map(l => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}
