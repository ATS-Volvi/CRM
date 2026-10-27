import { receiveInboundEmail } from '../../src/controllers/emailController';
import { syncGmail } from '../../src/controllers/gmailController';
import { sequelize, Activity, FlaggedLead, GmailConfig, Lead } from '@nexus-crm/database';
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
});
