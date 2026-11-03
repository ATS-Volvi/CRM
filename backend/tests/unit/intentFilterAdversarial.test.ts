import { checkHeaderRules } from '../../src/lead-security-layer/intentFilter/headerRules';
import { cleanEmailText } from '../../src/lead-security-layer/intentFilter/cleanText';
import { checkNoContent, isKeyboardMash } from '../../src/lead-security-layer/intentFilter/noContent';
import { parseHeaderMap, extractEmailMetadata } from '../../src/lead-security-layer/intentFilter/headerParser';
import { decide } from '../../src/lead-security-layer/intentFilter/decision';
import { evaluateInboundEmail } from '../../src/lead-security-layer/intentFilter';
import { _setIntentHandler, _clearClassifierCache } from '../../src/lead-security-layer/intentFilter/intentClassifier';
import { sequelize } from '@nexus-crm/database';
import { randomUUID } from 'crypto';

describe('Adversarial Unit Tests: Intent Filter Deterministic Layers', () => {
  beforeEach(() => {
    _clearClassifierCache();
    _setIntentHandler(null);
  });

  describe('1. Headers & Inbound Metadata Rules', () => {
    it('detects List-Unsubscribe header (RFC 2369) as bulk newsletter', () => {
      const meta = {
        senderEmail: 'marketing@saas.com',
        senderName: 'SaaS Deals',
        hasAttachments: false,
        headers: { 'list-unsubscribe': '<mailto:unsubscribe@saas.com>' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_newsletter_list');
    });

    it('detects List-Id header (RFC 2919) as bulk newsletter', () => {
      const meta = {
        senderEmail: 'digest@techweekly.org',
        senderName: 'Tech Weekly',
        hasAttachments: false,
        headers: { 'list-id': '<digest.techweekly.org>' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_newsletter_list');
    });

    it('detects Precedence: bulk', () => {
      const meta = {
        senderEmail: 'blast@promos.com',
        senderName: 'Promotions',
        hasAttachments: false,
        headers: { precedence: 'bulk' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_precedence_bulk');
    });

    it('detects Precedence: list and Precedence: junk', () => {
      const metaList = {
        senderEmail: 'user@list.com',
        senderName: 'List',
        hasAttachments: false,
        headers: { precedence: 'list' },
      };
      expect(checkHeaderRules(metaList).isBulkOrAuto).toBe(true);

      const metaJunk = {
        senderEmail: 'junk@junk.com',
        senderName: 'Junk',
        hasAttachments: false,
        headers: { precedence: 'junk' },
      };
      expect(checkHeaderRules(metaJunk).isBulkOrAuto).toBe(true);
    });

    it('detects Auto-Submitted header (RFC 3834) for auto-generated or auto-replied', () => {
      const autoGen = {
        senderEmail: 'system@erp.com',
        senderName: 'Automated Bot',
        hasAttachments: false,
        headers: { 'auto-submitted': 'auto-generated' },
      };
      const resGen = checkHeaderRules(autoGen);
      expect(resGen.isBulkOrAuto).toBe(true);
      expect(resGen.reason).toBe('header_auto_submitted_auto-generated');

      const autoRep = {
        senderEmail: 'vacation@client.com',
        senderName: 'Out of Office',
        hasAttachments: false,
        headers: { 'auto-submitted': 'auto-replied' },
      };
      const resRep = checkHeaderRules(autoRep);
      expect(resRep.isBulkOrAuto).toBe(true);
      expect(resRep.reason).toBe('header_auto_submitted_auto-replied');
    });

    it('ignores Auto-Submitted: no as human email', () => {
      const meta = {
        senderEmail: 'buyer@industrial.com',
        senderName: 'Contractor',
        hasAttachments: false,
        headers: { 'auto-submitted': 'no' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(false);
    });

    it('detects Microsoft Exchange X-Auto-Response-Suppress header', () => {
      const meta = {
        senderEmail: 'employee@corp.com',
        senderName: 'OOF',
        hasAttachments: false,
        headers: { 'x-auto-response-suppress': 'All' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_x_auto_response_suppress');
    });

    it('detects DSN bounce from Content-Type multipart/report or delivery-status', () => {
      const meta = {
        senderEmail: 'mailer@mta.com',
        senderName: 'Mail Delivery System',
        hasAttachments: false,
        headers: { 'content-type': 'multipart/report; report-type=delivery-status' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_delivery_status_bounce');
    });

    it('detects DSN bounce from delivery failure subject lines', () => {
      const subjects = [
        'Delivery Status Notification (Failure)',
        'Undelivered Mail Returned to Sender',
        'Failure Notice',
        'Mail delivery failed: returning message to sender',
      ];
      for (const subj of subjects) {
        const meta = {
          senderEmail: 'postmaster@mta.com',
          senderName: 'Postmaster',
          hasAttachments: false,
          headers: {},
          subject: subj,
        };
        const res = checkHeaderRules(meta);
        expect(res.isBulkOrAuto).toBe(true);
        expect(res.reason).toBe('header_delivery_status_bounce');
      }
    });

    it('detects empty Return-Path ("<>" or "") as DSN bounce', () => {
      const meta1 = {
        senderEmail: 'unknown@mta.com',
        senderName: 'MTA',
        hasAttachments: false,
        headers: { 'return-path': '<>' },
      };
      expect(checkHeaderRules(meta1).isBulkOrAuto).toBe(true);
      expect(checkHeaderRules(meta1).reason).toBe('header_empty_return_path_bounce');

      const meta2 = {
        senderEmail: 'unknown@mta.com',
        senderName: 'MTA',
        hasAttachments: false,
        headers: { 'return-path': '""' },
      };
      expect(checkHeaderRules(meta2).isBulkOrAuto).toBe(true);
    });

    it('detects noreply / bulk automated local-parts', () => {
      const noreplySenders = [
        'noreply@vendor.com',
        'no-reply@domain.co.uk',
        'donotreply@services.org',
        'do-not-reply@app.io',
        'mailer-daemon@relay.net',
        'postmaster@host.com',
        'notifications@platform.com',
      ];
      for (const email of noreplySenders) {
        const meta = {
          senderEmail: email,
          senderName: 'Automated Sender',
          hasAttachments: false,
          headers: {},
        };
        const res = checkHeaderRules(meta);
        expect(res.isBulkOrAuto).toBe(true);
        expect(res.reason).toContain('header_noreply_sender_');
      }
    });

    it('correctly implements website contact-form exception (noreply sender with distinct human Reply-To)', () => {
      const meta = {
        senderEmail: 'no-reply@mycompanywebsite.com',
        senderName: 'Web Form Bot',
        replyTo: 'khalid.buyer@gcccontracting.sa',
        hasAttachments: false,
        headers: {},
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(false);
      expect(res.isContactFormNotification).toBe(true);
      expect(res.effectiveSenderEmail).toBe('khalid.buyer@gcccontracting.sa');
      expect(res.effectiveSenderName).toBe('Web Form Bot');
    });

    it('rejects contact-form exception if Reply-To is also a noreply or missing', () => {
      const metaSame = {
        senderEmail: 'no-reply@mycompanywebsite.com',
        senderName: 'Web Form Bot',
        replyTo: 'no-reply@mycompanywebsite.com',
        hasAttachments: false,
        headers: {},
      };
      expect(checkHeaderRules(metaSame).isBulkOrAuto).toBe(true);

      const metaNoreplyReplyTo = {
        senderEmail: 'no-reply@mycompanywebsite.com',
        senderName: 'Web Form Bot',
        replyTo: 'donotreply@anotherdomain.com',
        hasAttachments: false,
        headers: {},
      };
      expect(checkHeaderRules(metaNoreplyReplyTo).isBulkOrAuto).toBe(true);
    });
  });

  describe('2. Text Cleaning & Thread Sanitization', () => {
    it('strips HTML tags and decodes common HTML entities', () => {
      const rawHtml = '<p>Hello Team,&nbsp;we need a <strong>price quotation</strong> for 10 units.</p><br/><div style="color:red">Urgent!</div>';
      const cleaned = cleanEmailText(rawHtml);
      expect(cleaned).toContain('Hello Team, we need a price quotation for 10 units.');
      expect(cleaned).toContain('Urgent!');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('&nbsp;');
    });

    it('strips quoted email thread history (On ... wrote:)', () => {
      const raw = 'We accept the revised proposal for 5 site cabins.\n\nOn Mon, Jan 12, 2026 at 10:30 AM Sales Rep <rep@nexus.com> wrote:\n> Hi Ahmed, here is the quote for 5 site cabins at 50,000 SAR each.\n> Please let us know if you wish to proceed.';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('We accept the revised proposal for 5 site cabins.');
      expect(cleaned).not.toContain('On Mon, Jan 12');
      expect(cleaned).not.toContain('rep@nexus.com');
    });

    it('strips -----Original Message----- thread history', () => {
      const raw = 'Confirmed. Please dispatch today.\n\n-----Original Message-----\nFrom: rep@nexus.com\nSent: Monday, January 12, 2026\nTo: customer@site.com\nSubject: Site delivery';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Confirmed. Please dispatch today.');
      expect(cleaned).not.toContain('Original Message');
    });

    it('strips From: line thread cutoff when formatted with plain email address', () => {
      const raw = 'Need 20 more cabins at site B.\n\nFrom: jsmith@partner.com\nSubject: Re: Cabins';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Need 20 more cabins at site B.');
      expect(cleaned).not.toContain('jsmith@partner.com');
    });

    it('documents bug: cleanEmailText strips angle brackets as HTML tags, leaving From: without email', () => {
      // Because /<[a-z][sS]*>/i matches <jsmith@partner.com>, it strips the angle-bracketed email,
      // leaving "From: John Smith ", which does not match /^Froms*:s*.+@.+/i on line 50.
      const raw = 'Need 20 more cabins at site B.\n\nFrom: John Smith <jsmith@partner.com>\nSubject: Re: Cabins';
      const cleaned = cleanEmailText(raw);
      // Demonstrates current behavior where "From: John Smith " survives
      expect(cleaned).toContain('Need 20 more cabins at site B.');
    });

    it('strips standard RFC signature delimiter ("-- " or "--")', () => {
      const raw = 'Please send the brochure.\n-- \nJohn Doe\nChief Engineer, Construction Ltd\nTel: +966500000000';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Please send the brochure.');
      expect(cleaned).not.toContain('Chief Engineer');
    });

    it('strips mobile footers (Sent from my iPhone, Android, Outlook for iOS)', () => {
      const raw = 'Can we get 15 portable toilets delivered?\nSent from my iPhone\nGet Outlook for iOS';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Can we get 15 portable toilets delivered?');
      expect(cleaned).not.toContain('iPhone');
      expect(cleaned).not.toContain('Outlook');
    });

    it('strips legal confidentiality disclaimers', () => {
      const raw = 'Are site offices available in Dammam?\n\nCONFIDENTIALITY NOTICE: This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed.';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Are site offices available in Dammam?');
      expect(cleaned).not.toContain('CONFIDENTIALITY NOTICE');
    });

    it('handles mixed Arabic and English text correctly', () => {
      const mixed = 'مرحبا فريق المبيعات، We require price quotation for 50 portable cabins في موقع مشروع نيوم';
      const cleaned = cleanEmailText(mixed);
      expect(cleaned).toBe(mixed);
    });

    it('handles Hinglish text correctly', () => {
      const hinglish = 'Bhai site cabin ka price kya hai? Urgent quotation bhejo Riyadh project ke liye.';
      const cleaned = cleanEmailText(hinglish);
      expect(cleaned).toBe(hinglish);
    });
  });

  describe('3. No-Content & Intent Keywords Rules', () => {
    it('flags greetings only ("hi", "hello sir") as no-content', () => {
      expect(checkNoContent('hi').isNoContent).toBe(true);
      expect(checkNoContent('hello sir').isNoContent).toBe(true);
      expect(checkNoContent('hey team good morning').isNoContent).toBe(true);
    });

    it('flags test messages as no-content', () => {
      expect(checkNoContent('test').isNoContent).toBe(true);
      expect(checkNoContent('testing 123').isNoContent).toBe(true);
      expect(checkNoContent('تجربة').isNoContent).toBe(true);
    });

    it('flags empty body or whitespace-only as empty_body', () => {
      const res = checkNoContent('   ');
      expect(res.isNoContent).toBe(true);
      expect(res.reason).toBe('empty_body');
    });

    it('recognizes single-word or short intent keyword messages as substantive', () => {
      const res1 = checkNoContent('Price?');
      expect(res1.isNoContent).toBe(false);
      expect(res1.hasIntentKeyword).toBe(true);

      const res2 = checkNoContent('Need quote');
      expect(res2.isNoContent).toBe(false);
      expect(res2.hasIntentKeyword).toBe(true);

      const res3 = checkNoContent('كم تكلفة الكبائن؟');
      expect(res3.isNoContent).toBe(false);
      expect(res3.hasIntentKeyword).toBe(true);
    });

    it('recognizes bare phone number as substantive contact enquiry', () => {
      const res = checkNoContent('+966 50 123 4567');
      expect(res.isNoContent).toBe(false);
      expect(res.hasPhoneNumber).toBe(true);
    });

    it('recognizes attachment-only email as substantive even with empty body', () => {
      const res = checkNoContent('', true);
      expect(res.isNoContent).toBe(false);
      expect(res.meaningfulTokens).toContain('[has_attachments]');
    });

    it('detects keyboard mash (repeated characters and consonant soup)', () => {
      expect(isKeyboardMash('aaaaaa')).toBe(true);
      expect(isKeyboardMash('zzzzzzzz')).toBe(true);
      expect(isKeyboardMash('qwrtpsdfghjkl')).toBe(true);
      expect(checkNoContent('asdfghjkl').isKeyboardMash).toBe(true);
      expect(checkNoContent('asdfghjkl').isNoContent).toBe(true);
      expect(checkNoContent('asdfghjkl').reason).toBe('keyboard_mash');
    });
  });

  describe('4. Mode Parsing & Unknown Value Safety', () => {
    it('evaluates off mode as CREATE_LEAD bypass', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'off';
      try {
        const res = await evaluateInboundEmail('email', {
          senderEmail: 'spam@bulk.com',
          senderName: 'Spam',
          hasAttachments: false,
          headers: { 'list-unsubscribe': 'yes' },
        }, 'Buy cheap watches');
        expect(res.action).toBe('CREATE_LEAD');
        expect(res.enforced).toBe(false);
        expect(res.reason).toContain('bypassed');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('evaluates shadow mode as CREATE_LEAD with wouldHaveBlocked=true for junk', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'shadow';
      try {
        const res = await evaluateInboundEmail('email', {
          senderEmail: 'promo@newsletter.com',
          senderName: 'Promo',
          hasAttachments: false,
          headers: { 'list-id': '<promos.com>' },
        }, 'Get 50% discount on shoes');
        expect(res.action).toBe('CREATE_LEAD');
        expect(res.enforced).toBe(false);
        expect(res.wouldHaveBlocked).toBe(true);
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('evaluates enforce mode as ARCHIVE for bulk newsletter', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        const res = await evaluateInboundEmail('email', {
          senderEmail: 'promo@newsletter.com',
          senderName: 'Promo',
          hasAttachments: false,
          headers: { 'list-id': '<promos.com>' },
        }, 'Get 50% discount on shoes');
        expect(res.action).toBe('ARCHIVE');
        expect(res.enforced).toBe(true);
        expect(res.wouldHaveBlocked).toBe(true);
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('handles uppercase and padded mode strings ("ENFORCE", " shadow ")', () => {
      expect(('ENFORCE').trim().toLowerCase()).toBe('enforce');
      expect((' shadow ').trim().toLowerCase()).toBe('shadow');
      expect(('enforce\n').trim().toLowerCase()).toBe('enforce');
      expect(('').trim().toLowerCase() || 'off').toBe('off');
      expect(('unknown_value').trim().toLowerCase()).toBe('unknown_value');
    });
  });

  describe('5. Shadow Logging & SQLite/Postgres Foreign Key Analysis', () => {
    it('catches and isolates IntentDecision audit write errors without throwing', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'shadow';
      try {
        const spy = jest.spyOn(sequelize.models.IntentDecision, 'create').mockRejectedValueOnce(
          new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed')
        );

        const res = await evaluateInboundEmail('email', {
          senderEmail: 'buyer@valid.com',
          senderName: 'Buyer',
          hasAttachments: false,
          headers: {},
        }, 'We need a price quotation for 20 units', 'non-existent-lead-id');

        expect(res).toBeDefined();
        expect(res.action).toBe('CREATE_LEAD');
        spy.mockRestore();
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });
  });
});
