import crypto from 'crypto';
import { parseAiVerdict } from '../aiModeration';
import { EmailMetadata, IntentClassifierResult, IntentLabel, IntentConfidence } from './types';
import fewShotExamples from './intentExamples.json';

// In-memory cache: hash of cleaned text -> IntentClassifierResult
const classifierCache = new Map<string, { result: IntentClassifierResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiter: sender email -> { count, day }
const senderCallCounts = new Map<string, { count: number; dateStr: string }>();
const MAX_CALLS_PER_SENDER_PER_DAY = 25;

let customIntentHandler: ((emailMeta: EmailMetadata, text: string) => Promise<IntentClassifierResult>) | null = null;

const VALID_LABELS = new Set<IntentLabel>([
  'new_enquiry',
  'existing_contact_reply',
  'support_request',
  'vendor_pitch',
  'newsletter',
  'auto_reply',
  'spam',
  'irrelevant',
  'too_vague',
]);

const VALID_CONFIDENCES = new Set<IntentConfidence>(['low', 'medium', 'high']);

function getSystemPrompt(): string {
  const companyName = process.env.COMPANY_NAME || 'Nexus Enterprise Solutions';
  const businessDesc =
    process.env.BUSINESS_DESCRIPTION ||
    'Provider of modular prefabricated buildings, site cabins, commercial industrial structures, asset procurement, and field engineering services.';

  const examplesSnippet = (fewShotExamples as any[])
    .slice(0, 10)
    .map(
      (ex) =>
        `Input:\n<email>\n${ex.input}\n</email>\nOutput:\n${JSON.stringify(ex.output)}`
    )
    .join('\n\n');

  return `You are an expert sales intent classifier for ${companyName}.
${businessDesc}

Your job is to analyze incoming inbound emails and judge whether the sender is expressing genuine commercial prospective interest (a Sales Lead) or non-lead traffic.

CRITICAL RULES:
1. A LEAD ("new_enquiry") is a person or business showing interest in buying, pricing, renting, a quote, a service, a product, a catalog, or asking about solutions offered. For any genuine commercial inquiry (including short inquiries), assign leadScore between 80 and 95 with high confidence.
2. Short messages like "Price for 50 units?", "Need quote", "Rate for 20ft container office?", "Cost of portable toilet unit?", "كم سعر المتر؟", "استفسار عن مكاتب جاهزة" ARE VALID LEADS. Legitimate commercial buyers are often direct and terse.
3. Greetings ("hi", "hello"), test messages, wrong numbers, personal banter, and unrelated inquiries are "too_vague" or "irrelevant" (leadScore 10-30).
4. Solicitations selling offshore dev, SEO, email lists, catering, HR/payroll outsourcing, staff recruitment, web design, or asking for a call to sell THEIR services to us are "vendor_pitch" (leadScore 10-25).
5. Newsletters, receipts, OTPs, promotional blasts, and social media notifications are "newsletter" or "spam" (leadScore 0-15).
6. Out of office and vacation replies are "auto_reply" (leadScore 5-15).
7. Existing customer discussing active orders or issue resolution is "existing_contact_reply" or "support_request".
8. Language can be English, Arabic, or Hinglish.

OUTPUT FORMAT:
Respond with ONLY a strict JSON object (no Markdown code block, no preamble):
{
  "label": "new_enquiry" | "existing_contact_reply" | "support_request" | "vendor_pitch" | "newsletter" | "auto_reply" | "spam" | "irrelevant" | "too_vague",
  "leadScore": <number from 0 to 100>,
  "confidence": "low" | "medium" | "high",
  "language": "en" | "ar" | "hinglish" | "other",
  "reason": "<maximum 200 characters in English explaining the classification>"
}

FEW-SHOT EXAMPLES:
${examplesSnippet}`;
}

/**
 * Normalizes and validates the verdict returned by LLM.
 */
function normalizeVerdict(raw: any): IntentClassifierResult {
  const label: IntentLabel = VALID_LABELS.has(raw?.label) ? raw.label : 'too_vague';
  const confidence: IntentConfidence = VALID_CONFIDENCES.has(raw?.confidence)
    ? raw.confidence
    : 'medium';
  let leadScore = typeof raw?.leadScore === 'number' ? Math.round(raw.leadScore) : 50;
  if (leadScore < 0) leadScore = 0;
  if (leadScore > 100) leadScore = 100;

  const language = typeof raw?.language === 'string' ? raw.language : 'en';
  const reason = (raw?.reason || 'Classified by intent filter').toString().slice(0, 200);

  return {
    label,
    leadScore,
    confidence,
    language,
    reason,
  };
}

/**
 * Classifies an inbound email using OpenRouter or Anthropic.
 */
export async function classifyIntent(
  emailMeta: EmailMetadata,
  cleanedText: string
): Promise<IntentClassifierResult> {
  // Test hook for mock handlers
  if (customIntentHandler) {
    return await customIntentHandler(emailMeta, cleanedText);
  }

  const textToAnalyze = `Subject: ${emailMeta.subject || 'No Subject'}\n\n${cleanedText}`.trim();
  const cacheKey = crypto.createHash('sha256').update(textToAnalyze).digest('hex');

  // Check cache
  const cached = classifierCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // Check sender rate limit cap
  const senderEmail = (emailMeta.senderEmail || '').toLowerCase();
  const todayStr = new Date().toISOString().slice(0, 10);
  const senderRecord = senderCallCounts.get(senderEmail);
  if (senderRecord && senderRecord.dateStr === todayStr) {
    if (senderRecord.count >= MAX_CALLS_PER_SENDER_PER_DAY) {
      console.warn(`[intentClassifier] Sender ${senderEmail} exceeded daily AI limit`);
      return {
        label: 'too_vague',
        leadScore: 20,
        confidence: 'medium',
        language: 'en',
        reason: 'Daily AI classification limit exceeded for sender',
      };
    }
    senderRecord.count++;
  } else {
    senderCallCounts.set(senderEmail, { count: 1, dateStr: todayStr });
  }

  const timeoutMs = parseInt(process.env.INTENT_AI_TIMEOUT_MS || '6000', 10);
  const provider = (process.env.AI_MODERATION_PROVIDER || 'openrouter').toLowerCase();

  // Try up to 2 attempts (1 initial + 1 retry)
  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let rawVerdict: any;
      if (provider === 'anthropic') {
        rawVerdict = await callAnthropicWithTimeout(textToAnalyze, timeoutMs);
      } else {
        rawVerdict = await callOpenRouterWithTimeout(textToAnalyze, timeoutMs);
      }

      const normalized = normalizeVerdict(rawVerdict);
      classifierCache.set(cacheKey, { result: normalized, timestamp: Date.now() });
      return normalized;
    } catch (err: any) {
      lastError = err;
      console.warn(`[intentClassifier] Attempt ${attempt} failed: ${err.message}`);
    }
  }

  throw lastError || new Error('Intent classification failed after retries');
}

async function callOpenRouterWithTimeout(text: string, timeoutMs: number): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('OPENROUTER_API_KEY is not configured or is a placeholder');
  }

  const model = process.env.INTENT_MODEL || 'meta-llama/llama-3.1-8b-instruct';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:5506',
        'X-Title': process.env.COMPANY_NAME || 'Nexus Enterprise CRM',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getSystemPrompt() },
          { role: 'user', content: `<email>\n${text}\n</email>` },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenRouter HTTP ${response.status}: ${errBody}`);
    }

    const data: any = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response content from OpenRouter');
    }

    return parseAiVerdict(rawContent);
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropicWithTimeout(text: string, timeoutMs: number): Promise<any> {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const model = process.env.INTENT_MODEL || 'claude-haiku-4-5-20251001';

  // Promise with race timeout
  const apiCall = client.messages.create({
    model,
    max_tokens: 250,
    system: getSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: `<email>\n${text}\n</email>`,
      },
    ],
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Anthropic call timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  const response: any = await Promise.race([apiCall, timeoutPromise]);
  const raw = response.content?.find((b: any) => b.type === 'text')?.text || '{}';
  return parseAiVerdict(raw);
}

export function _setIntentHandler(
  handler: ((emailMeta: EmailMetadata, text: string) => Promise<IntentClassifierResult>) | null
): void {
  customIntentHandler = handler;
}

export function _clearClassifierCache(): void {
  classifierCache.clear();
  senderCallCounts.clear();
}
