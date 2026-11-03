/**
 * Cleans email body text by stripping HTML tags, quoted replies, signatures,
 * mobile device footers, and legal disclaimers.
 */
export function cleanEmailText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let text = rawText;

  // 1. Strip HTML tags if present
  if (/<[a-z][\s\S]*>/i.test(text)) {
    // Replace <br>, <p>, <div> with newlines
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/(p|div|tr|h[1-6])>/gi, '\n');
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    // Normalize spaces within lines
    text = text.replace(/[ \t]+/g, ' ');
    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  // Normalize line breaks
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for quoted reply cutoff markers (everything below is part of prior thread)
    // "On Mon, Jan 1, 2026 at 10:00 AM John <... wrote:"
    if (/^On\s+.+wrote\s*:\s*$/i.test(trimmed)) {
      break;
    }
    // "-----Original Message-----"
    if (/^-----+\s*Original Message\s*-----+$/i.test(trimmed)) {
      break;
    }
    // "From: someone@example.com" or "From: John Doe <...>"
    if (/^From\s*:\s*.+@.+/i.test(trimmed)) {
      break;
    }

    // Standard RFC signature delimiter: "-- " or "--"
    if (trimmed === '--' || trimmed === '-- ') {
      break;
    }

    // Skip lines that start with ">" (quoted text)
    if (trimmed.startsWith('>')) {
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

    cleanedLines.push(line);
  }

  // Join lines and normalize excessive blank lines
  const cleaned = cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}
