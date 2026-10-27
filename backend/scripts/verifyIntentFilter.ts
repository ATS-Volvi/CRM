import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { checkHeaderRules } from '../src/lead-security-layer/intentFilter/headerRules';
import { cleanEmailText } from '../src/lead-security-layer/intentFilter/cleanText';
import { checkNoContent } from '../src/lead-security-layer/intentFilter/noContent';
import { decide } from '../src/lead-security-layer/intentFilter/decision';
import { evaluateInboundEmail } from '../src/lead-security-layer/intentFilter/index';
import { _setIntentHandler } from '../src/lead-security-layer/intentFilter/intentClassifier';
import { EmailMetadata } from '../src/lead-security-layer/intentFilter/types';

function makeMeta(overrides: Partial<EmailMetadata> = {}): EmailMetadata {
  return {
    senderEmail: 'test@example.com',
    senderName: 'Test Sender',
    hasAttachments: false,
    headers: {},
    ...overrides,
  };
}

function makeSenderContext(overrides: Record<string, any> = {}): any {
  return {
    senderEmail: 'test@example.com',
    senderDomain: 'example.com',
    knownContact: false,
    openLeadId: null,
    isAllowlisted: false,
    isBlocklisted: false,
    lastInboundAt: null,
    pendingClarificationId: null,
    ...overrides,
  };
}

function makeNoContent(overrides: Record<string, any> = {}): any {
  return {
    isNoContent: true,
    reason: 'Filler tokens only',
    meaningfulTokenCount: 1,
    meaningfulTokens: ['hi'],
    hasIntentKeyword: false,
    hasPhoneNumber: false,
    isKeyboardMash: false,
    ...overrides,
  };
}

async function runIntentFilterVerification() {
  console.log('=== NEXUS CRM: EMAIL INTENT FILTER GATE VERIFICATION ===\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail}`);
    }
  }

  // ── 1. HEADER RULES ────────────────────────────────────────────────────────
  console.log('--- 1. Deterministic Bulk / Auto / Bounce Detection ---');
  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'promo@marketing.com',
      headers: { 'list-unsubscribe': '<https://marketing.com/unsub>' },
    }));
    assert(res.isBulkOrAuto, 'Detects List-Unsubscribe header');
  }

  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'blast@newsletter.com',
      headers: { precedence: 'bulk' },
    }));
    assert(res.isBulkOrAuto, 'Detects Precedence: bulk');
  }

  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'bot@vacation.com',
      headers: { 'auto-submitted': 'auto-generated' },
    }));
    assert(res.isBulkOrAuto, 'Detects Auto-Submitted header');
  }

  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'mailer-daemon@mx.google.com',
      headers: { 'content-type': 'multipart/report; report-type=delivery-status' },
    }));
    assert(res.isBulkOrAuto, 'Detects delivery-status bounce content type');
  }

  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'noreply@service.com',
    }));
    assert(res.isBulkOrAuto, 'Detects noreply sender local-part');
  }

  {
    const res = checkHeaderRules(makeMeta({
      senderEmail: 'noreply@webforms.mycompany.com',
      replyTo: 'realbuyer@construction.com',
    }));
    assert(!res.isBulkOrAuto && res.isContactFormNotification, 'Preserves web contact-form notification with human Reply-To');
  }

  // ── 2. TEXT CLEANING ───────────────────────────────────────────────────────
  console.log('\n--- 2. Email Body Cleaner ---');
  {
    const dirtyHtml = '<p>Hello <b>Nexus</b> team,</p><p>Need pricing for 10 units.</p>';
    const cleaned = cleanEmailText(dirtyHtml);
    assert(!cleaned.includes('<p>') && cleaned.includes('Hello Nexus team,'), 'Strips HTML tags properly');
  }

  {
    const quoted = 'I agree with the terms.\n\n> On Monday, John wrote:\n> What are your units?';
    const cleaned = cleanEmailText(quoted);
    assert(!cleaned.includes('John wrote') && cleaned.includes('I agree with the terms.'), 'Strips quoted replies (">")');
  }

  {
    const sig = 'Please quote.\n\n-- \nBest Regards,\nAhmed Al-Sayed\nChief Procurement Officer';
    const cleaned = cleanEmailText(sig);
    assert(!cleaned.includes('Chief Procurement Officer') && cleaned.includes('Please quote.'), 'Strips standard signatures ("-- ")');
  }

  {
    const mobile = 'Can we talk tomorrow?\n\nSent from my iPhone';
    const cleaned = cleanEmailText(mobile);
    assert(!cleaned.includes('iPhone') && cleaned.includes('Can we talk tomorrow?'), 'Strips mobile footers');
  }

  // ── 3. NO-CONTENT DETECTION ────────────────────────────────────────────────
  console.log('\n--- 3. Unicode-Aware No-Content & Filler Filter ---');
  {
    assert(checkNoContent('hi').isNoContent, 'Flags "hi" as no content');
    assert(checkNoContent('Hello sir').isNoContent, 'Flags "Hello sir" as no content');
    assert(checkNoContent('test testing ok').isNoContent, 'Flags "test testing ok" as no content');
    assert(checkNoContent('مرحبا السلام عليكم').isNoContent, 'Flags Arabic greetings alone as no content');
    assert(checkNoContent('asdfghjkl qwerty').isNoContent, 'Flags keyboard mash as no content');
  }

  console.log('\n--- 4. No-Content Intent Overrides ---');
  {
    assert(!checkNoContent('Price?').isNoContent, 'OVERRIDE: "Price?" is not flagged as no content');
    assert(!checkNoContent('Need quote').isNoContent, 'OVERRIDE: "Need quote" is not flagged as no content');
    assert(!checkNoContent('كم السعر؟').isNoContent, 'OVERRIDE: Arabic "كم السعر؟" is not flagged as no content');
    assert(!checkNoContent('Call me at +966501234567').isNoContent, 'OVERRIDE: Phone number is not flagged as no content');
    assert(!checkNoContent('', true).isNoContent, 'OVERRIDE: Attachment presence prevents no-content flag');
  }

  // ── 5. SENDER CONTEXT & DECISION MATRIX ─────────────────────────────────────
  console.log('\n--- 5. Pure Decision Matrix ---');
  {
    const config = { createMinScore: 70, reviewMinScore: 35 };

    const allowDecision = decide({
      senderContext: makeSenderContext({ isAllowlisted: true }),
    }, config);
    assert(allowDecision.action === 'CREATE_LEAD', 'Allowlisted sender creates lead');

    const blockDecision = decide({
      senderContext: makeSenderContext({ isBlocklisted: true }),
    }, config);
    assert(blockDecision.action === 'ARCHIVE', 'Blocklisted sender archives');

    const bulkDecision = decide({
      headerResult: {
        isBulkOrAuto: true,
        reason: 'List-Unsubscribe header',
        effectiveSenderEmail: 'promo@marketing.com',
        effectiveSenderName: 'Promo',
        isInternal: false,
        isContactFormNotification: false,
      },
    }, config);
    assert(bulkDecision.action === 'ARCHIVE', 'Bulk headers archive');

    const noContentDecision = decide({
      noContentResult: makeNoContent(),
    }, config);
    assert(noContentDecision.action === 'PENDING_CLARIFY', 'Human no-content holds as pending_clarification');

    const openLeadDecision = decide({
      senderContext: makeSenderContext({ openLeadId: 'lead-123' }),
      classifierResult: {
        label: 'existing_contact_reply',
        leadScore: 80,
        confidence: 'high',
        language: 'en',
        reason: 'Reply to ongoing discussion',
      },
    }, config);
    assert(openLeadDecision.action === 'ATTACH_EXISTING', 'Substantive message from open lead sender attaches');

    const enquiryDecision = decide({
      classifierResult: {
        label: 'new_enquiry',
        leadScore: 88,
        confidence: 'high',
        language: 'en',
        reason: 'Legitimate procurement enquiry',
      },
    }, config);
    assert(enquiryDecision.action === 'CREATE_LEAD', 'High confidence new_enquiry creates lead');

    const pitchDecision = decide({
      classifierResult: {
        label: 'vendor_pitch',
        leadScore: 20,
        confidence: 'high',
        language: 'en',
        reason: 'Vendor SEO sales pitch',
      },
    }, config);
    assert(pitchDecision.action === 'ARCHIVE', 'Vendor pitch archives');

    const errorDecision = decide({ classifierError: 'Network timeout to AI' }, config);
    assert(errorDecision.action === 'REVIEW', 'Fail-safe: classifier error routes to REVIEW');
  }

  // ── 6. FULL ORCHESTRATION PIPELINE ─────────────────────────────────────────
  console.log('\n--- 6. Orchestrated Pipeline Evaluation ---');
  {
    _setIntentHandler(async () => ({
      label: 'new_enquiry',
      leadScore: 95,
      confidence: 'high',
      language: 'en',
      reason: 'Valid prefabricated cabins enquiry',
    }));

    const result = await evaluateInboundEmail(
      'email',
      makeMeta({ senderEmail: 'procurement@contractor.ae', subject: 'Site Cabins RFQ' }),
      'We require 30 site cabins delivered to Dubai South next month. Please send catalog and quote.'
    );

    assert(result.action === 'CREATE_LEAD', 'Full pipeline correctly routes real enquiry to CREATE_LEAD');
    assert(result.score === 95, 'Pipeline preserves score');
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`========================================\n`);

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runIntentFilterVerification()
  .then(() => {
    console.log('Intent Filter verification completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Intent Filter verification error:', err);
    process.exit(1);
  });
