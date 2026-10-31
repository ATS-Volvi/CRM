import { receiveInboundEmail } from '../../src/controllers/emailController';
import { syncGmail } from '../../src/controllers/gmailController';
import { getHeldEmails, getFilterStats } from '../../src/controllers/leadFilterController';
import { sequelize, Activity, FlaggedLead, GmailConfig, Lead } from '@nexus-crm/database';
import { randomUUID } from 'crypto';
import * as leadIngestion from '../../src/services/leadIngestion';
import * as gmailService from '../../src/services/gmailService';
import * as intentFilter from '../../src/lead-security-layer/intentFilter';
import * as senderContext from '../../src/lead-security-layer/intentFilter/senderContext';
import * as attachActivity from '../../src/lead-security-layer/intentFilter/attachActivity';

describe('No-Silent-Loss & Controller Equivalence Tests', () => {
  const originalEnvSecret = process.env.INBOUND_EMAIL_SECRET;
  const originalMode = process.env.INTENT_FILTER_MODE;

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = 'test_secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalEnvSecret !== undefined) {
      process.env.INBOUND_EMAIL_SECRET = originalEnvSecret;
    } else {
      delete process.env.INBOUND_EMAIL_SECRET;
    }
    if (originalMode !== undefined) {
      process.env.INTENT_FILTER_MODE = originalMode;
    } else {
      delete process.env.INTENT_FILTER_MODE;
    }
  });

  describe('emailController: malformed payload in off and shadow mode', () => {
    it('in mode=off: malformed payload creates lead and returns status 201 identical to main', async () => {
      process.env.INTENT_FILTER_MODE = 'off';
      const mockLeadId = 'lead-off-' + Date.now();
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      // Malformed body: invalid non-standard fields, no subject, nested objects
      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          sender: 'Malformed Off <malformed_off@example.com>',
          corrupted: { nested: [1, 2, 3] },
          'stripped-text': 'Message with unusual fields'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Inbound email ingested successfully');
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('in mode=shadow: malformed payload creates lead and returns status 201 identical to main', async () => {
      process.env.INTENT_FILTER_MODE = 'shadow';
      const mockLeadId = 'lead-shadow-' + Date.now();
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          From: 'Malformed Shadow <malformed_shadow@example.com>',
          headers: 'Invalid\r\nRFC: 822\r\nMalformed',
          Body: 'Message with malformed raw RFC structure'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Inbound email ingested successfully');
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });
  });

  describe('emailController: enforce-mode no-silent-loss failure fallbacks', () => {
    beforeEach(() => {
      process.env.INTENT_FILTER_MODE = 'enforce';
    });

    it('ATTACH_EXISTING failure (missing leadId): falls through to normal lead creation (returns 201)', async () => {
      const mockLeadId = 'lead-fallback-attach-1';
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      // Gate decides ATTACH_EXISTING but has no openLeadId
      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'ATTACH_EXISTING',
        openLeadId: null,
        label: 'support_request',
        score: 60,
        confidence: 'high',
        reason: 'Sender wants to attach'
      } as any);

      // Fallback lookup also returns null
      jest.spyOn(senderContext, 'getSenderContext').mockResolvedValue({
        openLeadId: null,
        isAllowlisted: false,
        isBlocklisted: false
      } as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Client <client_no_lead@example.com>',
          subject: 'Help with order',
          text: 'Where is my order?'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      // Must NOT return 202 attached; must fall through to normal lead creation
      expect(res.statusCode).toBe(201);
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('ATTACH_EXISTING failure (attachActivity throws): falls through to normal lead creation (returns 201)', async () => {
      const mockLeadId = 'lead-fallback-attach-2';
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'ATTACH_EXISTING',
        openLeadId: 'open-target-lead-uuid',
        label: 'support_request',
        score: 60,
        confidence: 'high',
        reason: 'Sender wants to attach'
      } as any);

      // attachEmailToLeadActivity throws
      jest.spyOn(attachActivity, 'attachEmailToLeadActivity').mockRejectedValue(
        new Error('Activity database write failed')
      );

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Client <client_attach_throw@example.com>',
          subject: 'Order update',
          text: 'Order update note.'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      // Never return 202 "attached" unless activity was really written!
      expect(res.statusCode).toBe(201);
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('HOLD failure (FlaggedLead.create throws): falls through to normal lead creation (returns 201)', async () => {
      const mockLeadId = 'lead-fallback-hold-1';
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'REVIEW',
        label: 'too_vague',
        score: 45,
        confidence: 'low',
        reason: 'Hold in review'
      } as any);

      // FlaggedLead.create throws error (simulate table/DB issue)
      jest.spyOn(FlaggedLead, 'create').mockRejectedValue(
        new Error('Database disk full: could not insert FlaggedLead')
      );

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Vague Sender <vague@example.com>',
          subject: 'Vague query',
          text: 'Hi'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      // Never drop silently on DB hold error; must create lead
      expect(res.statusCode).toBe(201);
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });
  });

  describe('gmailController: enforce-mode no-silent-loss failure fallbacks', () => {
    beforeEach(() => {
      process.env.INTENT_FILTER_MODE = 'enforce';
      jest.spyOn(GmailConfig, 'findOne').mockResolvedValue({
        encryptedRefreshToken: 'real_encrypted_token_123',
        lastSyncedAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      } as any);
      jest.spyOn(gmailService, 'decryptToken').mockReturnValue('decrypted_token');
    });

    it('ATTACH_EXISTING failure (missing leadId): does NOT continue; creates lead instead', async () => {
      const email = {
        id: 'gmail-msg-1',
        senderName: 'Gmail User',
        senderEmail: 'gmailuser@example.com',
        phone: '',
        subject: 'Query',
        body: 'Inquiry body',
        date: new Date(),
        rawPayload: {}
      };
      jest.spyOn(gmailService, 'fetchUnreadEmails').mockResolvedValue([email]);

      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'ATTACH_EXISTING',
        openLeadId: null,
        label: 'support_request',
        score: 60,
        confidence: 'high',
        reason: 'Wants to attach'
      } as any);

      // Fallback lookup via getSenderContext also returns null
      jest.spyOn(senderContext, 'getSenderContext').mockResolvedValue({
        openLeadId: null,
        isAllowlisted: false,
        isBlocklisted: false
      } as any);

      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue('new-lead-id' as any);

      const req: any = {};
      const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await syncGmail(req, res);

      // On attach failure, sync must NOT drop message; must ingest lead
      expect(ingestSpy).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, ingestedCount: 1 });
    });

    it('ATTACH_EXISTING failure (attachActivity throws): does NOT continue; creates lead instead', async () => {
      const email = {
        id: 'gmail-msg-2',
        senderName: 'Gmail User 2',
        senderEmail: 'gmailuser2@example.com',
        phone: '',
        subject: 'Query 2',
        body: 'Inquiry body 2',
        date: new Date(),
        rawPayload: {}
      };
      jest.spyOn(gmailService, 'fetchUnreadEmails').mockResolvedValue([email]);

      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'ATTACH_EXISTING',
        openLeadId: 'target-lead-uuid',
        label: 'support_request',
        score: 60,
        confidence: 'high',
        reason: 'Wants to attach'
      } as any);

      jest.spyOn(attachActivity, 'attachEmailToLeadActivity').mockRejectedValue(
        new Error('Activity table locked')
      );

      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue('new-lead-id' as any);

      const req: any = {};
      const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await syncGmail(req, res);

      expect(ingestSpy).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, ingestedCount: 1 });
    });

    it('HOLD failure (FlaggedLead.create throws): does NOT continue; creates lead instead', async () => {
      const email = {
        id: 'gmail-msg-3',
        senderName: 'Gmail User 3',
        senderEmail: 'gmailuser3@example.com',
        phone: '',
        subject: 'Spam pitch',
        body: 'SEO vendor pitch',
        date: new Date(),
        rawPayload: {}
      };
      jest.spyOn(gmailService, 'fetchUnreadEmails').mockResolvedValue([email]);

      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'ARCHIVE',
        label: 'vendor_pitch',
        score: 20,
        confidence: 'high',
        reason: 'Spam pitch'
      } as any);

      // FlaggedLead.create throws error
      jest.spyOn(FlaggedLead, 'create').mockRejectedValue(
        new Error('FlaggedLead database error')
      );

      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue('new-lead-id' as any);

      const req: any = {};
      const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await syncGmail(req, res);

      expect(ingestSpy).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, ingestedCount: 1 });
    });
  });

  describe('INTENT_FILTER_MODE parsing & normalization', () => {
    it('parses "Shadow" (mixed case) as shadow mode: creates lead immediately and returns 201', async () => {
      process.env.INTENT_FILTER_MODE = 'Shadow';
      const mockLeadId = 'lead-shadow-mixed-' + Date.now();
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Mixed Case <mixed@example.com>',
          subject: 'Enquiry',
          text: 'Hello, need information'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('parses " shadow " (whitespace padded) as shadow mode: creates lead immediately and returns 201', async () => {
      process.env.INTENT_FILTER_MODE = ' shadow ';
      const mockLeadId = 'lead-shadow-padded-' + Date.now();
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Padded Shadow <padded@example.com>',
          subject: 'Padded',
          text: 'Hello from padded shadow'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('parses "ENFORCE" (uppercase) as enforce mode: gates inbound email and holds for review', async () => {
      process.env.INTENT_FILTER_MODE = 'ENFORCE';
      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'REVIEW',
        label: 'too_vague',
        score: 40,
        confidence: 'medium',
        reason: 'Too vague'
      } as any);

      const createSpy = jest.spyOn(FlaggedLead, 'create').mockResolvedValue({ id: 'flag-enforce-1' } as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Enforce Uppercase <enforce@example.com>',
          subject: 'Hi',
          text: 'Hi'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(202);
      expect(res.body.status).toBe('held');
      expect(createSpy).toHaveBeenCalled();
    });
  });

  describe('emailController: enforce mode evaluateInboundEmail error handling & fallbacks', () => {
    beforeEach(() => {
      process.env.INTENT_FILTER_MODE = 'enforce';
    });

    it('when evaluateInboundEmail throws, treats verdict as REVIEW and creates FlaggedLead (returns 202)', async () => {
      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockRejectedValue(
        new Error('Intent classifier network timeout')
      );

      let createdPayload: any = null;
      jest.spyOn(FlaggedLead, 'create').mockImplementation((data: any) => {
        createdPayload = data;
        return Promise.resolve({ id: 'flag-eval-fallback' } as any);
      });

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Timeout Sender <timeout@example.com>',
          subject: 'Important RFQ',
          text: 'Please review RFQ document'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(202);
      expect(res.body.status).toBe('held');
      expect(res.body.action).toBe('REVIEW');
      expect(createdPayload).toBeDefined();
      expect(createdPayload.disposition).toBe('review');
      expect(createdPayload.intentLabel).toBe('too_vague');
      expect(createdPayload.reason).toContain('Intent evaluation error: Intent classifier network timeout');
    });

    it('when evaluateInboundEmail throws AND FlaggedLead.create throws, falls through to normal lead creation (returns 201, no 5xx, no silent loss)', async () => {
      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockRejectedValue(
        new Error('LLM service unavailable')
      );

      jest.spyOn(FlaggedLead, 'create').mockRejectedValue(
        new Error('Database disk full: could not insert FlaggedLead')
      );

      const mockLeadId = 'lead-double-fault-' + Date.now();
      const ingestSpy = jest.spyOn(leadIngestion, 'ingestLead').mockResolvedValue(mockLeadId as any);

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        body: {
          from: 'Resilient Sender <resilient@example.com>',
          subject: 'Urgent Purchase',
          text: 'Need 50 units immediately'
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      // Must NOT return 5xx or fail silently; must fall through to normal lead creation (201)
      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Inbound email ingested successfully');
      expect(res.body.leadId).toBe(mockLeadId);
      expect(ingestSpy).toHaveBeenCalled();
    });
  });

  describe('emailController: FlaggedLead attachment sanitization in enforce mode', () => {
    beforeEach(() => {
      process.env.INTENT_FILTER_MODE = 'enforce';
    });

    it('stores attachment filenames and sizes only, never file contents or buffers', async () => {
      jest.spyOn(intentFilter, 'evaluateInboundEmail').mockResolvedValue({
        action: 'REVIEW',
        label: 'too_vague',
        score: 45,
        confidence: 'low',
        reason: 'Held for review'
      } as any);

      let createdData: any = null;
      jest.spyOn(FlaggedLead, 'create').mockImplementation((data: any) => {
        createdData = data;
        return Promise.resolve({ id: 'flag-sanitized-attach' } as any);
      });

      const req: any = {
        query: { auth_token: 'test_secret' },
        headers: {},
        files: [
          {
            originalname: 'confidential_pitch.pdf',
            size: 4096,
            mimetype: 'application/pdf',
            buffer: Buffer.from('RAW_FILE_BINARY_CONTENT_SHOULD_NEVER_BE_STORED')
          }
        ],
        body: {
          from: 'Pitcher <pitch@spammer.com>',
          subject: 'Check our deck',
          text: 'Deck attached',
          attachments: [
            {
              filename: 'leaked_raw.txt',
              content: 'SECRET_TEXT_CONTENT',
              size: 1024
            }
          ]
        }
      };
      const res: any = {
        statusCode: 200,
        status: jest.fn().mockImplementation((code: number) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn().mockImplementation((body: any) => {
          res.body = body;
          return res;
        })
      };

      await receiveInboundEmail(req, res);

      expect(res.statusCode).toBe(202);
      expect(createdData).toBeDefined();
      const attachments = createdData.payload.attachments;
      expect(attachments).toBeDefined();
      expect(attachments.length).toBeGreaterThan(0);

      // Verify each attachment entry contains ONLY filename and size (and optional mimetype), never contents or buffer
      for (const att of attachments) {
        expect(att.filename).toBeDefined();
        expect(typeof att.size).toBe('number');
        expect(att.buffer).toBeUndefined();
        expect(att.content).toBeUndefined();
        expect(att.data).toBeUndefined();
      }

      // Verify the outer payload does NOT contain any file buffer strings
      const payloadStr = JSON.stringify(createdData.payload);
      expect(payloadStr).not.toContain('RAW_FILE_BINARY_CONTENT_SHOULD_NEVER_BE_STORED');
      expect(payloadStr).not.toContain('SECRET_TEXT_CONTENT');
    });
  });

  describe('leadFilterController: legacy row filtering (intentLabel is not null)', () => {
    it('Held Emails list and stats only include rows where intentLabel is not null', async () => {
      // 1. Create a legacy row with intentLabel: null (e.g. from older security-layer scans)
      const legacyRow = await FlaggedLead.create({
        id: randomUUID(),
        payload: { from: 'legacy@example.com', subject: 'Legacy Security Flag' },
        source: 'email',
        channel: 'email',
        reason: 'Legacy security scanner detection',
        disposition: 'review',
        intentLabel: null,
        senderEmail: 'legacy@example.com',
        subject: 'Legacy Security Flag',
        reviewed: false
      });

      // 2. Create a modern intent-filtered row with intentLabel: 'too_vague'
      const modernRow = await FlaggedLead.create({
        id: randomUUID(),
        payload: { from: 'modern@example.com', subject: 'Modern Intent Review' },
        source: 'email',
        channel: 'email',
        reason: 'Needs review due to vague greeting',
        disposition: 'review',
        intentLabel: 'too_vague',
        intentScore: 40,
        senderEmail: 'modern@example.com',
        subject: 'Modern Intent Review',
        reviewed: false
      });

      // 3. Test getHeldEmails
      const listReq: any = { query: { disposition: 'review', search: 'legacy@example.com' } };
      const listRes: any = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((b: any) => { listRes.body = b; return listRes; })
      };

      // Searching for the legacy row email must return 0 results because intentLabel is null
      await getHeldEmails(listReq, listRes);
      expect(listRes.body.total).toBe(0);
      expect(listRes.body.items).toHaveLength(0);

      // Querying without search filters out the legacy row and only returns rows with intentLabel != null
      const modernReq: any = { query: { disposition: 'review', search: 'modern@example.com' } };
      const modernRes: any = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((b: any) => { modernRes.body = b; return modernRes; })
      };
      await getHeldEmails(modernReq, modernRes);
      expect(modernRes.body.total).toBe(1);
      expect(modernRes.body.items[0].id).toBe(modernRow.id);
      expect(modernRes.body.items[0].intentLabel).toBe('too_vague');

      // 4. Test getFilterStats
      const statsReq: any = { query: {} };
      const statsRes: any = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((b: any) => { statsRes.body = b; return statsRes; })
      };

      await getFilterStats(statsReq, statsRes);

      // Verify that the legacy row (intentLabel: null) is NOT included in needsReviewCount
      const allHeldWithIntent = await FlaggedLead.count({
        where: { disposition: 'review', intentLabel: { [require('sequelize').Op.ne]: null } }
      });
      expect(statsRes.body.needsReviewCount).toBe(allHeldWithIntent);
    });
  });
});
