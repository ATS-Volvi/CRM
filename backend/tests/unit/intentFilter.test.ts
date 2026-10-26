import { checkHeaderRules } from '../../src/lead-security-layer/intentFilter/headerRules';
import { cleanEmailText } from '../../src/lead-security-layer/intentFilter/cleanText';
import { checkNoContent } from '../../src/lead-security-layer/intentFilter/noContent';
import { decide } from '../../src/lead-security-layer/intentFilter/decision';
import { EmailMetadata } from '../../src/lead-security-layer/intentFilter/types';

describe('Intent Filter - Unit Tests', () => {
  describe('Header Rules (checkHeaderRules)', () => {
    it('should detect List-Unsubscribe as bulk marketing', () => {
      const meta: EmailMetadata = {
        senderEmail: 'marketing@brand.com',
        senderName: 'Brand',
        hasAttachments: false,
        headers: {
          'list-unsubscribe': '<https://brand.com/unsub>',
        },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_newsletter_list');
    });

    it('should detect List-Id header as bulk', () => {
      const meta: EmailMetadata = {
        senderEmail: 'updates@news.com',
        senderName: 'News',
        hasAttachments: false,
        headers: {
          'list-id': 'weekly-digest.news.com',
        },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_newsletter_list');
    });

    it('should detect Precedence: bulk', () => {
      const meta: EmailMetadata = {
        senderEmail: 'promo@store.com',
        senderName: 'Store',
        hasAttachments: false,
        headers: { precedence: 'bulk' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_precedence_bulk');
    });

    it('should detect Auto-Submitted: auto-generated/auto-replied', () => {
      const meta: EmailMetadata = {
        senderEmail: 'vacation@client.com',
        senderName: 'Client',
        hasAttachments: false,
        headers: { 'auto-submitted': 'auto-replied' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_auto_submitted_auto-replied');
    });

    it('should detect X-Auto-Response-Suppress header', () => {
      const meta: EmailMetadata = {
        senderEmail: 'system@exchange.corp',
        senderName: 'Exchange',
        hasAttachments: false,
        headers: { 'x-auto-response-suppress': 'All' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_x_auto_response_suppress');
    });

    it('should detect DSN bounces with empty Return-Path <>', () => {
      const meta: EmailMetadata = {
        senderEmail: 'mailer-daemon@mx.google.com',
        senderName: 'Mail Delivery Subsystem',
        hasAttachments: false,
        headers: { 'return-path': '<>' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
    });

    it('should detect delivery-status bounce content types', () => {
      const meta: EmailMetadata = {
        senderEmail: 'postmaster@domain.com',
        senderName: 'Postmaster',
        hasAttachments: false,
        headers: { 'content-type': 'multipart/report; report-type=delivery-status' },
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toBe('header_delivery_status_bounce');
    });

    it('should detect noreply sender local-parts', () => {
      const meta: EmailMetadata = {
        senderEmail: 'no-reply@updates.linkedin.com',
        senderName: 'LinkedIn',
        hasAttachments: false,
        headers: {},
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(true);
      expect(res.reason).toContain('noreply');
    });

    it('should allow contact-form notification exception when Reply-To is a distinct human address', () => {
      const meta: EmailMetadata = {
        senderEmail: 'noreply@ourcompanywebsite.com',
        senderName: 'Web Inquiry Form',
        replyTo: 'khalid.buyer@saudicorp.com',
        hasAttachments: false,
        headers: {},
      };
      const res = checkHeaderRules(meta);
      expect(res.isBulkOrAuto).toBe(false);
      expect(res.isContactFormNotification).toBe(true);
      expect(res.effectiveSenderEmail).toBe('khalid.buyer@saudicorp.com');
    });
  });

  describe('Clean Text (cleanEmailText)', () => {
    it('should strip HTML tags and decode HTML entities', () => {
      const raw = '<p>Hello <b>Nexus</b> &amp; team,</p><br/><p>Please send quote.</p>';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toContain('Hello Nexus & team,');
      expect(cleaned).toContain('Please send quote.');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('&amp;');
    });

    it('should strip lines starting with >', () => {
      const raw = 'Yes, that price is acceptable.\n> On Oct 10, rep wrote:\n> Price is $500\n> Thank you';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Yes, that price is acceptable.');
    });

    it('should strip everything after "On ... wrote:"', () => {
      const raw = 'Please confirm dispatch date.\n\nOn Mon, Oct 24, 2026 at 2:15 PM Saud <saud@corp.com> wrote:\n> Hello\n> Previous message';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Please confirm dispatch date.');
    });

    it('should strip standard email signatures starting with "-- "', () => {
      const raw = 'Can we get 10 units?\n\n-- \nJohn Doe\nProcurement Director\nAcme Corp';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Can we get 10 units?');
    });

    it('should strip mobile footers like "Sent from my iPhone"', () => {
      const raw = 'Interested in demo.\n\nSent from my iPhone';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Interested in demo.');
    });

    it('should strip legal confidentiality disclaimers', () => {
      const raw = 'Please quote 20 cabins.\n\nCONFIDENTIALITY NOTICE: This message contains confidential information and is intended only for the individual named.';
      const cleaned = cleanEmailText(raw);
      expect(cleaned).toBe('Please quote 20 cabins.');
    });

    it('XSS: should sanitize and neutralize <script> and <img onerror> payloads', () => {
      const xssPayloads = [
        'Quote request <script>alert("XSS")</script> for 10 units',
        'Hello <img src="x" onerror="alert(1)" /> please send catalog',
        '<svg/onload=alert`1`> Need 5 modular offices',
        'Inquiry <iframe src="javascript:alert(1)"></iframe> for site cabins',
      ];

      for (const payload of xssPayloads) {
        const cleaned = cleanEmailText(payload);
        expect(cleaned).not.toContain('<script>');
        expect(cleaned).not.toContain('</script>');
        expect(cleaned).not.toContain('<img');
        expect(cleaned).not.toContain('onerror');
        expect(cleaned).not.toContain('<svg');
        expect(cleaned).not.toContain('<iframe');
      }

      // Check preserved business intent text
      const cleanedEnquiry = cleanEmailText('Quote request <script>alert("XSS")</script> for 10 units');
      expect(cleanedEnquiry).toContain('Quote request');
      expect(cleanedEnquiry).toContain('for 10 units');
    });
  });

  describe('No Content Filter (checkNoContent)', () => {
    it('should flag "Hi" as no content', () => {
      const res = checkNoContent('Hi');
      expect(res.isNoContent).toBe(true);
      expect(res.reason).toBe('insufficient_meaningful_tokens');
    });

    it('should flag "Hello sir" as no content', () => {
      const res = checkNoContent('Hello sir');
      expect(res.isNoContent).toBe(true);
    });

    it('should flag "test" as no content', () => {
      const res = checkNoContent('test');
      expect(res.isNoContent).toBe(true);
    });

    it('should flag "Sent from my iPhone" (empty after cleanText) as no content', () => {
      const cleaned = cleanEmailText('Sent from my iPhone');
      const res = checkNoContent(cleaned);
      expect(res.isNoContent).toBe(true);
    });

    it('should flag signature-only as no content', () => {
      const cleaned = cleanEmailText('-- \nJohn Doe\nVP Sales');
      const res = checkNoContent(cleaned);
      expect(res.isNoContent).toBe(true);
    });

    it('should flag quoted-reply-only as no content', () => {
      const cleaned = cleanEmailText('> Previous email text\n> Another quote line');
      const res = checkNoContent(cleaned);
      expect(res.isNoContent).toBe(true);
    });

    it('should flag Arabic greeting only (مرحبا, السلام عليكم) as no content', () => {
      const res1 = checkNoContent('مرحبا');
      expect(res1.isNoContent).toBe(true);

      const res2 = checkNoContent('السلام عليكم ورحمة الله وبركاته');
      expect(res2.isNoContent).toBe(true);
    });

    it('OVERRIDE: should NOT flag "Price?" as no content (intent word override)', () => {
      const res = checkNoContent('Price?');
      expect(res.isNoContent).toBe(false);
      expect(res.hasIntentKeyword).toBe(true);
    });

    it('OVERRIDE: should NOT flag "Need quote" as no content', () => {
      const res = checkNoContent('Need quote');
      expect(res.isNoContent).toBe(false);
      expect(res.hasIntentKeyword).toBe(true);
    });

    it('OVERRIDE: should NOT flag Arabic "كم السعر؟" as no content', () => {
      const res = checkNoContent('كم السعر؟');
      expect(res.isNoContent).toBe(false);
      expect(res.hasIntentKeyword).toBe(true);
    });

    it('OVERRIDE: should NOT flag message containing phone number only', () => {
      const res = checkNoContent('+966 50 123 4567');
      expect(res.isNoContent).toBe(false);
      expect(res.hasPhoneNumber).toBe(true);
    });

    it('OVERRIDE: should NOT flag attachment-only email', () => {
      const res = checkNoContent('', true);
      expect(res.isNoContent).toBe(false);
    });

    it('should flag keyboard-mash strings like "asdfghjkl"', () => {
      const res = checkNoContent('asdfghjkl');
      expect(res.isNoContent).toBe(true);
      expect(res.reason).toBe('keyboard_mash');
    });

    it('should flag repeated character mash like "zzzzzz"', () => {
      const res = checkNoContent('zzzzzz');
      expect(res.isNoContent).toBe(true);
      expect(res.reason).toBe('keyboard_mash');
    });

    it('should pass substantive business enquiry in English', () => {
      const res = checkNoContent('We need 50 portable cabins delivered to Dammam by next month.');
      expect(res.isNoContent).toBe(false);
    });

    it('should pass substantive business enquiry in Arabic', () => {
      const res = checkNoContent('نحتاج توريد كبائن موقع لمشروع القدية في الرياض');
      expect(res.isNoContent).toBe(false);
    });
  });

  describe('Decision Matrix (decide)', () => {
    it('should ARCHIVE blocklisted senders', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'bad@spam.com',
          senderDomain: 'spam.com',
          knownContact: null,
          openLeadId: null,
          lastInboundAt: null,
          isAllowlisted: false,
          isBlocklisted: true,
          pendingClarificationId: null,
        },
      });
      expect(res.action).toBe('ARCHIVE');
      expect(res.label).toBe('spam');
    });

    it('should CREATE_LEAD for allowlisted senders without open lead', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'vip@client.com',
          senderDomain: 'client.com',
          knownContact: null,
          openLeadId: null,
          lastInboundAt: null,
          isAllowlisted: true,
          isBlocklisted: false,
          pendingClarificationId: null,
        },
      });
      expect(res.action).toBe('CREATE_LEAD');
      expect(res.label).toBe('new_enquiry');
    });

    it('should ATTACH_EXISTING for allowlisted senders with open lead', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'vip@client.com',
          senderDomain: 'client.com',
          knownContact: null,
          openLeadId: 'lead-1234',
          lastInboundAt: new Date(),
          isAllowlisted: true,
          isBlocklisted: false,
          pendingClarificationId: null,
        },
      });
      expect(res.action).toBe('ATTACH_EXISTING');
      expect(res.openLeadId).toBe('lead-1234');
    });

    it('should ARCHIVE bulk / auto headers', () => {
      const res = decide({
        headerResult: {
          isBulkOrAuto: true,
          reason: 'header_newsletter_list',
          effectiveSenderEmail: 'marketing@corp.com',
          effectiveSenderName: 'Marketing',
          isInternal: false,
          isContactFormNotification: false,
        },
      });
      expect(res.action).toBe('ARCHIVE');
      expect(res.label).toBe('newsletter');
    });

    it('should PENDING_CLARIFY for human sender with no content', () => {
      const res = decide({
        noContentResult: {
          isNoContent: true,
          reason: 'insufficient_meaningful_tokens',
          meaningfulTokens: [],
          meaningfulTokenCount: 0,
          hasIntentKeyword: false,
          hasPhoneNumber: false,
          isKeyboardMash: false,
        },
      });
      expect(res.action).toBe('PENDING_CLARIFY');
      expect(res.label).toBe('too_vague');
    });

    it('should ATTACH_EXISTING when open lead exists and message is substantive', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'buyer@acme.com',
          senderDomain: 'acme.com',
          knownContact: null,
          openLeadId: 'lead-5555',
          lastInboundAt: new Date(),
          isAllowlisted: false,
          isBlocklisted: false,
          pendingClarificationId: null,
        },
        classifierResult: {
          label: 'new_enquiry',
          leadScore: 90,
          confidence: 'high',
          language: 'en',
          reason: 'Follow-up regarding cabin specifications',
        },
      });
      expect(res.action).toBe('ATTACH_EXISTING');
      expect(res.openLeadId).toBe('lead-5555');
    });

    it('should CREATE_LEAD for new_enquiry with high score and confidence', () => {
      const res = decide({
        classifierResult: {
          label: 'new_enquiry',
          leadScore: 85,
          confidence: 'high',
          language: 'en',
          reason: 'Valid quote request for 20 units',
        },
      });
      expect(res.action).toBe('CREATE_LEAD');
      expect(res.label).toBe('new_enquiry');
      expect(res.score).toBe(85);
    });

    it('should ARCHIVE vendor pitch with high confidence', () => {
      const res = decide({
        classifierResult: {
          label: 'vendor_pitch',
          leadScore: 10,
          confidence: 'high',
          language: 'en',
          reason: 'Unsolicited SEO agency pitch',
        },
      });
      expect(res.action).toBe('ARCHIVE');
      expect(res.label).toBe('vendor_pitch');
    });

    it('should route support_request from known contact to ATTACH_EXISTING', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'customer@client.com',
          senderDomain: 'client.com',
          knownContact: { id: 'contact-1' },
          openLeadId: null,
          lastInboundAt: null,
          isAllowlisted: false,
          isBlocklisted: false,
          pendingClarificationId: null,
        },
        classifierResult: {
          label: 'support_request',
          leadScore: 40,
          confidence: 'high',
          language: 'en',
          reason: 'Invoice correction request',
        },
      });
      expect(res.action).toBe('ATTACH_EXISTING');
      expect(res.label).toBe('support_request');
    });

    it('should route support_request from unknown sender to REVIEW', () => {
      const res = decide({
        senderContext: {
          senderEmail: 'unknown@client.com',
          senderDomain: 'client.com',
          knownContact: null,
          openLeadId: null,
          lastInboundAt: null,
          isAllowlisted: false,
          isBlocklisted: false,
          pendingClarificationId: null,
        },
        classifierResult: {
          label: 'support_request',
          leadScore: 40,
          confidence: 'high',
          language: 'en',
          reason: 'Invoice correction request',
        },
      });
      expect(res.action).toBe('REVIEW');
      expect(res.label).toBe('support_request');
    });

    it('FAIL-SAFE: should route classifier error or timeout to REVIEW (never silent drop)', () => {
      const res = decide({
        classifierError: 'API timeout after 6000ms',
      });
      expect(res.action).toBe('REVIEW');
      expect(res.reason).toContain('Classifier error');
    });
  });

  describe('Dataset Leakage & Prompt Integrity', () => {
    it('should have zero text overlap between held-out eval cases and classifier prompt or few-shot examples', () => {
      const fs = require('fs');
      const path = require('path');

      const evalScriptPath = path.resolve(__dirname, '../../scripts/evalIntentFilter.ts');
      const promptFilePath = path.resolve(__dirname, '../../src/lead-security-layer/intentFilter/intentClassifier.ts');
      const examplesFilePath = path.resolve(__dirname, '../../src/lead-security-layer/intentFilter/intentExamples.json');

      const evalContent = fs.readFileSync(evalScriptPath, 'utf8');
      const promptContent = fs.readFileSync(promptFilePath, 'utf8').toLowerCase();
      const examplesContent = fs.readFileSync(examplesFilePath, 'utf8').toLowerCase();

      // Extract all held-out cases
      const lines = evalContent.split('\n');
      let inHeldOut = false;
      const heldOutPhrases: string[] = [];

      for (const line of lines) {
        if (line.includes('const heldOutCases')) inHeldOut = true;
        if (inHeldOut && line.includes('];')) inHeldOut = false;
        if (inHeldOut) {
          const m = line.match(/(?:subject|body):\s*['"]([^'"]+)['"]/);
          if (m) {
            const raw = m[1].toLowerCase().trim();
            if (raw.length >= 15) {
              heldOutPhrases.push(raw);
            }
          }
        }
      }

      expect(heldOutPhrases.length).toBeGreaterThanOrEqual(40);

      const leaks: { phrase: string; target: string }[] = [];

      for (const phrase of heldOutPhrases) {
        if (promptContent.includes(phrase)) {
          leaks.push({ phrase, target: 'intentClassifier.ts prompt' });
        }
        if (examplesContent.includes(phrase)) {
          leaks.push({ phrase, target: 'intentExamples.json' });
        }

        // Also check 4-word n-grams for near-duplicate leakage
        const words = phrase.split(/\s+/).filter((w: string) => w.length > 2);
        for (let i = 0; i <= words.length - 4; i++) {
          const ngram = words.slice(i, i + 4).join(' ');
          if (ngram.length >= 16) {
            if (promptContent.includes(ngram)) {
              leaks.push({ phrase: ngram, target: 'intentClassifier.ts prompt (ngram)' });
            }
            if (examplesContent.includes(ngram)) {
              leaks.push({ phrase: ngram, target: 'intentExamples.json (ngram)' });
            }
          }
        }
      }

      expect(leaks).toEqual([]);
    });
  });

  describe('Gmail Shadow Safety (extractEmailMetadata try/catch)', () => {
    it('should catch metadata extraction errors on malformed messages and leave emailMeta undefined without failing sync', async () => {
      const { fetchUnreadEmails } = require('../../src/services/gmailService');
      const { google } = require('googleapis');
      const headerParser = require('../../src/lead-security-layer/intentFilter/headerParser');

      const prevMode = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'shadow';

      const origExtract = headerParser.extractEmailMetadata;
      const extractSpy = jest.spyOn(headerParser, 'extractEmailMetadata').mockImplementation((m: any) => {
        if (m && m.id === 'malformed-msg-1') {
          throw new Error('Malformed RFC headers encountered');
        }
        return origExtract(m);
      });

      const originalGmail = google.gmail;
      const modifyMock = jest.fn().mockResolvedValue({});

      google.gmail = jest.fn().mockReturnValue({
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: 'malformed-msg-1' }, { id: 'valid-msg-2' }]
              }
            }),
            get: jest.fn().mockImplementation(({ id }) => {
              if (id === 'malformed-msg-1') {
                return Promise.resolve({
                  data: {
                    id: 'malformed-msg-1',
                    snippet: 'Malformed email body',
                    internalDate: '1600000000000',
                    payload: {
                      headers: [
                        { name: 'From', value: 'Corrupted <corrupted@example.com>' },
                        { name: 'Subject', value: 'Malformed Message' }
                      ]
                    }
                  }
                });
              }
              return Promise.resolve({
                data: {
                  id: 'valid-msg-2',
                  snippet: 'Valid email body',
                  internalDate: '1600000000000',
                  payload: {
                    headers: [
                      { name: 'From', value: 'Valid Sender <valid@example.com>' },
                      { name: 'Subject', value: 'Valid Subject' }
                    ]
                  }
                }
              });
            }),
            modify: modifyMock
          }
        }
      });

      try {
        const messages = await fetchUnreadEmails('mock_refresh_token_test');
        expect(messages.length).toBe(2);
        // The malformed message must still be processed into parsedMessages
        expect(messages[0].id).toBe('malformed-msg-1');
        // emailMeta must safely be undefined
        expect(messages[0].emailMeta).toBeUndefined();
        // The valid message must have extracted metadata
        expect(messages[1].id).toBe('valid-msg-2');
        expect(messages[1].emailMeta).toBeDefined();
        expect(messages[1].emailMeta.senderEmail).toBe('valid@example.com');
      } finally {
        extractSpy.mockRestore();
        google.gmail = originalGmail;
        process.env.INTENT_FILTER_MODE = prevMode;
      }
    });
  });
});


