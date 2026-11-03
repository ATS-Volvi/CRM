export interface NoContentResult {
  isNoContent: boolean;
  reason?: string;
  meaningfulTokens: string[];
  meaningfulTokenCount: number;
  hasIntentKeyword: boolean;
  hasPhoneNumber: boolean;
  isKeyboardMash: boolean;
}

const FILLER_TOKENS = new Set([
  // English filler & greetings
  'hi',
  'hii',
  'hiii',
  'hello',
  'hey',
  'heyy',
  'hlo',
  'dear',
  'sir',
  'sirs',
  'madam',
  'maam',
  'team',
  'all',
  'good',
  'morning',
  'afternoon',
  'evening',
  'day',
  'thanks',
  'thank',
  'you',
  'thx',
  'ok',
  'okay',
  'k',
  'kk',
  'test',
  'testing',
  'regards',
  'warm',
  'best',
  'cheers',
  'please',
  'pls',
  'plz',
  'kindly',
  'welcome',
  'fine',
  'yes',
  'no',
  'sure',

  // Arabic filler & greetings
  'مرحبا',
  'مرحبًا',
  'أهلا',
  'أهلاً',
  'اهلا',
  'اهلاً',
  'السلام',
  'عليكم',
  'ورحمة',
  'الله',
  'وبركاته',
  'تحياتي',
  'شكرا',
  'شكرًا',
  'صباح',
  'الخير',
  'مساء',
  'تسلم',
  'طيب',
  'تمام',
  'هلا',
  'وغلا',
  'حياك',
  'حياكم',
  'عزيزي',
  'سيدي',
  'فريق',
  'العمل',
  'نعم',
  'لا',
  'اوكي',
  'تجربة',
]);

const INTENT_KEYWORDS = new Set([
  // English intent words
  'price',
  'prices',
  'pricing',
  'quote',
  'quotes',
  'quotation',
  'quotations',
  'cost',
  'costs',
  'rate',
  'rates',
  'demo',
  'buy',
  'buying',
  'buyer',
  'order',
  'orders',
  'ordering',
  'need',
  'needs',
  'needed',
  'require',
  'requires',
  'required',
  'requirement',
  'requirements',
  'supply',
  'supplier',
  'suppliers',
  'supplies',
  'enquiry',
  'enquiries',
  'inquiry',
  'inquiries',
  'interested',
  'interest',
  'catalog',
  'catalogue',
  'proposal',
  'proposals',
  'estimate',
  'estimates',
  'estimation',
  'spec',
  'specs',
  'specification',
  'specifications',
  'units',
  'pieces',
  'pcs',
  'discount',
  'invoice',
  'purchase',

  // Arabic intent words
  'سعر',
  'اسعار',
  'أسعار',
  'تسعير',
  'تسعيرة',
  'عرض',
  'عروض',
  'تكلفة',
  'تكاليف',
  'ديمو',
  'شراء',
  'اشتري',
  'نشتري',
  'اطلب',
  'طلب',
  'طلبية',
  'طلبات',
  'احتاج',
  'نحتاج',
  'حاجة',
  'توريد',
  'مورد',
  'استفسار',
  'استفسارات',
  'استعلام',
  'مهتم',
  'مهتمين',
  'كتالوج',
  'بروفايل',
  'مواصفات',
  'كمية',
  'كميات',
  'حبة',
  'قطعة',
  'خصم',
  'فاتورة',
]);

/**
 * Checks for keyboard mash patterns:
 * 1. 5+ identical characters in a row (e.g. "aaaaaa", "xxxxx")
 * 2. Long English strings (7+ chars) with virtually no vowels (< 10%)
 */
export function isKeyboardMash(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();

  // 5+ repeated characters
  if (/(.)\1{4,}/i.test(clean)) {
    return true;
  }

  // Check individual words for consonant mash
  const words = clean.split(/\s+/);
  for (const word of words) {
    const alphaOnly = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (alphaOnly.length >= 7) {
      const vowels = alphaOnly.match(/[aeiou]/g) || [];
      const vowelRatio = vowels.length / alphaOnly.length;
      if (vowelRatio < 0.12) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates whether cleaned text contains meaningful substantive content.
 */
export function checkNoContent(
  cleanedText: string,
  hasAttachments: boolean = false
): NoContentResult {
  // OVERRIDE 1: Attachments present -> never no-content
  if (hasAttachments) {
    return {
      isNoContent: false,
      meaningfulTokens: ['[has_attachments]'],
      meaningfulTokenCount: 1,
      hasIntentKeyword: false,
      hasPhoneNumber: false,
      isKeyboardMash: false,
    };
  }

  const text = (cleanedText || '').trim();
  if (!text) {
    return {
      isNoContent: true,
      reason: 'empty_body',
      meaningfulTokens: [],
      meaningfulTokenCount: 0,
      hasIntentKeyword: false,
      hasPhoneNumber: false,
      isKeyboardMash: false,
    };
  }

  // Keyboard mash check
  const mash = isKeyboardMash(text);
  if (mash) {
    return {
      isNoContent: true,
      reason: 'keyboard_mash',
      meaningfulTokens: [],
      meaningfulTokenCount: 0,
      hasIntentKeyword: false,
      hasPhoneNumber: false,
      isKeyboardMash: true,
    };
  }

  // OVERRIDE 2: Phone number check (6+ digits with optional +, spaces, dashes, dots)
  const phoneRegex = /(?:\+?\d[\s.-]?){6,}\d/;
  const hasPhoneNumber = phoneRegex.test(text);
  if (hasPhoneNumber) {
    return {
      isNoContent: false,
      meaningfulTokens: ['[phone_number]'],
      meaningfulTokenCount: 1,
      hasIntentKeyword: false,
      hasPhoneNumber: true,
      isKeyboardMash: false,
    };
  }

  // Unicode-aware tokenization: match words using \p{L} and \p{N}
  const rawTokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  const lowercaseTokens = rawTokens.map((t) => t.toLowerCase());

  // OVERRIDE 3: Intent keyword check
  let hasIntentKeyword = false;
  for (const token of lowercaseTokens) {
    if (
      INTENT_KEYWORDS.has(token) ||
      (token.startsWith('ال') && INTENT_KEYWORDS.has(token.slice(2)))
    ) {
      hasIntentKeyword = true;
      break;
    }
  }

  // If intent keyword is present, it's never no-content even if very short (e.g. "Price for 50 units?")
  if (hasIntentKeyword) {
    return {
      isNoContent: false,
      meaningfulTokens: lowercaseTokens,
      meaningfulTokenCount: lowercaseTokens.length,
      hasIntentKeyword: true,
      hasPhoneNumber: false,
      isKeyboardMash: false,
    };
  }

  // Filter out filler words
  const meaningfulTokens = lowercaseTokens.filter((token) => !FILLER_TOKENS.has(token));

  // If fewer than 3 meaningful tokens remain, it's no content
  const isNoContent = meaningfulTokens.length < 3;

  return {
    isNoContent,
    reason: isNoContent ? 'insufficient_meaningful_tokens' : undefined,
    meaningfulTokens,
    meaningfulTokenCount: meaningfulTokens.length,
    hasIntentKeyword: false,
    hasPhoneNumber: false,
    isKeyboardMash: false,
  };
}
