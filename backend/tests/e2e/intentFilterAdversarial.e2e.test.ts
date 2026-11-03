import request from 'supertest';
import { createServer } from '../../server';
import { sequelize, User, FlaggedLead, SenderRule, Lead, Activity } from '@nexus-crm/database';
import { _setIntentHandler, _clearClassifierCache } from '../../src/lead-security-layer/intentFilter/intentClassifier';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const app = createServer();
const JWT_SECRET = process.env.JWT_SECRET || 'throwaway-secret-for-testing-only-12345';
const INBOUND_SECRET = 'adversarial_test_secret';

function createAuthToken(user: any): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Adversarial E2E Tests: Failures, Webhook Formats, Roles, & Filter Endpoints', () => {
  let adminUser: any;
  let directorUser: any;
  let managerUser: any;
  let salesManagerUser: any;
  let salesRepUser: any;
  let seniorAeUser: any;
  let teamLeadUser: any;
  let siteManagerUser: any;
  let opsManagerUser: any;

  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = INBOUND_SECRET;

    // Create test users for each role
    const roles = [
      'admin',
      'director',
      'manager',
      'sales_manager',
      'sales_rep',
      'senior_ae',
      'team_lead',
      'site_manager',
      'ops_manager',
    ];

    for (const role of roles) {
      const email = `adv_${role}_${randomUUID().slice(0, 8)}@nexus.test`;
      const user = await User.create({
        id: randomUUID(),
        name: `Test ${role}`,
        email,
        password: 'password123',
        role,
        isAvailable: true,
      });
      tokens[role] = createAuthToken(user);
      if (role === 'admin') adminUser = user;
      if (role === 'director') directorUser = user;
      if (role === 'manager') managerUser = user;
      if (role === 'sales_manager') salesManagerUser = user;
      if (role === 'sales_rep') salesRepUser = user;
      if (role === 'senior_ae') seniorAeUser = user;
      if (role === 'team_lead') teamLeadUser = user;
      if (role === 'site_manager') siteManagerUser = user;
      if (role === 'ops_manager') opsManagerUser = user;
    }
  });

  beforeEach(() => {
    _clearClassifierCache();
    _setIntentHandler(null);
  });

  describe('1. Webhook Formats & Header Ingestion Variations', () => {
    it('accepts Mailgun urlencoded payload with body-plain', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => ({
          label: 'new_enquiry',
          leadScore: 90,
          confidence: 'high',
          language: 'en',
          reason: 'Valid quote enquiry',
        }));

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .type('form')
          .send({
            from: 'Buyer One <buyer1@construction.sa>',
            to: 'sales@nexus.test',
            subject: 'Quote for 10 modular units',
            'body-plain': 'Hello, we require a formal quote for 10 units in Riyadh.',
          });

        expect(res.status).toBe(201);
        expect(res.body.leadId).toBeDefined();
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('accepts SendGrid-style payload with RFC 822 string headers', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        const rawHeadersString = 'From: Newsletter <news@marketing.com>\r\nList-Unsubscribe: <http://unsub.com>\r\nSubject: Weekly Promo';
        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'news@marketing.com',
            to: 'info@nexus.test',
            subject: 'Weekly Promo',
            text: 'Special promo discounts this week only.',
            headers: rawHeadersString,
          });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('archived');
        expect(res.body.action).toBe('ARCHIVE');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('accepts Mailgun JSON array headers [name, value]', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        const mailgunHeaders = JSON.stringify([
          ['List-Id', '<marketing.blast.com>'],
          ['Precedence', 'bulk'],
        ]);
        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'deals@blast.com',
            to: 'info@nexus.test',
            subject: 'Exclusive deal',
            text: 'Check out these savings.',
            'message-headers': mailgunHeaders,
          });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('archived');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('accepts Gmail-style array of objects [{ name, value }]', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        const gmailHeaders = [
          { name: 'Auto-Submitted', value: 'auto-replied' },
        ];
        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'out@vacation.com',
            to: 'info@nexus.test',
            subject: 'Out of office',
            text: 'I am on annual leave until next week.',
            headers: gmailHeaders,
          });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('archived');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });
  });

  describe('2. Fail-Safe Guarantee: Never Lose an Email on Failure', () => {
    it('when classifier throws, falls back to REVIEW and holds in FlaggedLead (status 202, not 500)', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => {
          throw new Error('AI Provider connection timeout (504 Gateway Timeout)');
        });

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'buyer.timeout@partner.com',
            to: 'sales@nexus.test',
            subject: 'Urgent enquiry for 30 cabins',
            text: 'Please send specs and pricing immediately.',
          });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('held');
        expect(res.body.action).toBe('REVIEW');
        expect(res.body.disposition).toBe('review');

        const held = await FlaggedLead.findOne({
          where: { senderEmail: 'buyer.timeout@partner.com' },
        });
        expect(held).not.toBeNull();
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('when classifier returns garbage JSON or unknown label, falls safe to too_vague / REVIEW', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => ({
          label: 'some_unknown_label_from_llm' as any,
          leadScore: 50,
          confidence: 'medium',
          language: 'en',
          reason: 'LLM generated hallucinatory category',
        }));

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'buyer.hallucination@partner.com',
            to: 'sales@nexus.test',
            subject: 'Civil engineering structure quote',
            text: 'Need quotation for steel structure.',
          });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('held');
        expect(res.body.action).toBe('REVIEW');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('when FlaggedLead.create throws, falls through to lead creation instead of losing email', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => ({
          label: 'vendor_pitch',
          leadScore: 10,
          confidence: 'high',
          language: 'en',
          reason: 'SEO sales pitch',
        }));

        const flagSpy = jest.spyOn(FlaggedLead, 'create').mockRejectedValueOnce(
          new Error('Simulated database deadlock on FlaggedLeads')
        );

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .send({
            from: 'seo.seller@agency.com',
            to: 'info@nexus.test',
            subject: 'Rank #1 on Google',
            text: 'We can optimize your SEO rankings today.',
          });

        expect(res.status).toBe(201);
        expect(res.body.leadId).toBeDefined();

        flagSpy.mockRestore();
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });
  });

  describe('3. Role-Based Access Control on /api/v1/lead-filter Routes', () => {
    const endpoints = [
      { method: 'get', path: '/api/v1/lead-filter/held' },
      { method: 'get', path: '/api/v1/lead-filter/stats' },
      { method: 'get', path: '/api/v1/lead-filter/shadow-logs' },
      { method: 'get', path: '/api/v1/lead-filter/sender-rules' },
      { method: 'post', path: '/api/v1/lead-filter/sender-rules', body: { type: 'allow', matchType: 'email', value: 'vip@test.com' } },
    ];

    const allowedRoles = ['admin', 'director', 'manager', 'sales_manager'];
    const forbiddenRoles = ['sales_rep', 'senior_ae', 'team_lead', 'site_manager', 'ops_manager'];

    for (const ep of endpoints) {
      for (const role of allowedRoles) {
        it(`allows ${role} on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
          let req = (request(app) as any)[ep.method](ep.path)
            .set('Authorization', `Bearer ${tokens[role]}`);
          if (ep.body) req = req.send(ep.body);
          const res = await req;
          expect(res.status).toBeLessThan(400);
        });
      }

      for (const role of forbiddenRoles) {
        it(`forbids ${role} (403) on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
          let req = (request(app) as any)[ep.method](ep.path)
            .set('Authorization', `Bearer ${tokens[role]}`);
          if (ep.body) req = req.send(ep.body);
          const res = await req;
          expect(res.status).toBe(403);
          expect(res.body.error).toContain('Forbidden');
        });
      }
    }
  });

  describe('4. Promote & Reject Operations', () => {
    it('promotes a held email into a genuine Lead with skipIntentGate so it is not re-filtered', async () => {
      const held = await FlaggedLead.create({
        id: randomUUID(),
        payload: {
          from: 'ahmed@saudicorp.sa',
          subject: 'Need 50 cabins for AlUla project',
          text: 'We are requesting quotation for 50 accommodation cabins.',
          firstName: 'Ahmed',
          lastName: 'Al-Mansoor',
          company: 'Saudi Corp',
        },
        source: 'email',
        channel: 'email',
        reason: 'Held for review',
        disposition: 'review',
        intentLabel: 'new_enquiry',
        intentScore: 65,
        explanation: 'Held for review',
        senderEmail: 'ahmed@saudicorp.sa',
        subject: 'Need 50 cabins for AlUla project',
        reviewed: false,
      });

      const res = await request(app)
        .post(`/api/v1/lead-filter/held/${held.id}/promote`)
        .set('Authorization', `Bearer ${tokens['admin']}`)
        .send({ addSenderToAllowlist: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leadId).toBeDefined();

      const updated = await FlaggedLead.findByPk(held.id) as any;
      expect(updated.disposition).toBe('promoted');
      expect(updated.promotedLeadId).toBe(res.body.leadId);

      const rule = await SenderRule.findOne({ where: { value: 'ahmed@saudicorp.sa' } }) as any;
      expect(rule).not.toBeNull();
      expect(rule.type).toBe('allow');
    });

    it('rejects a held email with blockSender and blockDomain', async () => {
      const held = await FlaggedLead.create({
        id: randomUUID(),
        payload: {
          from: 'spammer@junkdomain.xyz',
          subject: 'Crypto Investment Opportunity',
          text: 'Make 500% profit today.',
        },
        source: 'email',
        channel: 'email',
        reason: 'Crypto spam',
        disposition: 'review',
        intentLabel: 'spam',
        intentScore: 5,
        explanation: 'Crypto spam',
        senderEmail: 'spammer@junkdomain.xyz',
        subject: 'Crypto Investment Opportunity',
        reviewed: false,
      });

      const res = await request(app)
        .post(`/api/v1/lead-filter/held/${held.id}/reject`)
        .set('Authorization', `Bearer ${tokens['manager']}`)
        .send({ blockSender: true, blockDomain: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disposition).toBe('rejected');

      const emailRule = await SenderRule.findOne({ where: { value: 'spammer@junkdomain.xyz' } }) as any;
      expect(emailRule).not.toBeNull();
      expect(emailRule.type).toBe('block');

      const domainRule = await SenderRule.findOne({ where: { value: 'junkdomain.xyz' } }) as any;
      expect(domainRule).not.toBeNull();
      expect(domainRule.type).toBe('block');
    });

    it('fails when promoting the same held row twice (idempotency: second call returns 409 and creates no duplicate lead)', async () => {
      const uniqueEmail = `idempotent.promote.${Date.now()}@example.com`;
      const held = await FlaggedLead.create({
        id: randomUUID(),
        payload: {
          from: uniqueEmail,
          subject: 'Initial Inbound for Idempotency',
          text: 'Need cabins urgently.',
          firstName: 'Idempotent',
          lastName: 'Promote',
        },
        source: 'email',
        channel: 'email',
        disposition: 'review',
        intentLabel: 'too_vague',
        intentScore: 50,
        reason: 'Vague initial enquiry',
        explanation: 'Vague initial enquiry',
        senderEmail: uniqueEmail,
        subject: 'Initial Inbound for Idempotency',
      });

      // First promote
      const res1 = await request(app)
        .post(`/api/v1/lead-filter/held/${held.id}/promote`)
        .set('Authorization', `Bearer ${tokens['admin']}`)
        .send({});

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      const firstLeadId = res1.body.leadId;
      expect(firstLeadId).toBeDefined();

      // Second promote (must be idempotent: return 409 and not create a new lead)
      const res2 = await request(app)
        .post(`/api/v1/lead-filter/held/${held.id}/promote`)
        .set('Authorization', `Bearer ${tokens['admin']}`)
        .send({});

      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/already.*promoted/i);

      // Verify only 1 lead exists in the database for this email
      const leads = await Lead.findAll({ where: { email: uniqueEmail } });
      expect(leads.length).toBe(1);
      expect(leads[0].id).toBe(firstLeadId);
    });

    it('handles concurrent promote calls safely (exactly one succeeds with 200, one 409, exactly 1 lead created)', async () => {
      const concurrentEmail = `concurrent.promote.${Date.now()}@example.com`;
      const held = await FlaggedLead.create({
        id: randomUUID(),
        payload: {
          from: concurrentEmail,
          subject: 'Concurrent Inbound',
          text: 'Need cabins for concurrent test.',
          firstName: 'Concurrent',
          lastName: 'Test',
        },
        source: 'email',
        channel: 'email',
        disposition: 'review',
        intentLabel: 'too_vague',
        intentScore: 50,
        reason: 'Vague initial enquiry',
        explanation: 'Vague initial enquiry',
        senderEmail: concurrentEmail,
        subject: 'Concurrent Inbound',
      });

      // Fire two promote requests simultaneously
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/v1/lead-filter/held/${held.id}/promote`)
          .set('Authorization', `Bearer ${tokens['admin']}`)
          .send({}),
        request(app)
          .post(`/api/v1/lead-filter/held/${held.id}/promote`)
          .set('Authorization', `Bearer ${tokens['admin']}`)
          .send({}),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify only 1 lead was created in total
      const leads = await Lead.findAll({ where: { email: concurrentEmail } });
      expect(leads.length).toBe(1);
    });
  });

  describe('5. Webhook File Attachments Handling', () => {
    it('accepts clean PDF attachment with genuine inquiry', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => ({
          label: 'new_enquiry',
          leadScore: 92,
          confidence: 'high',
          language: 'en',
          reason: 'Inquiry with architectural specs attached',
        }));

        // Minimal valid PDF header buffer
        const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n170\n%%EOF');

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .field('from', 'contractor@saudi-build.com')
          .field('to', 'sales@nexus.test')
          .field('subject', 'Cabin specifications attached')
          .field('text', 'Please find attached the drawings for 20 site cabins.')
          .attach('attachment1', pdfBuffer, 'specifications.pdf');

        expect(res.status).toBe(201);
        expect(res.body.leadId).toBeDefined();
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });

    it('quarantines executable or spoofed attachment without losing lead', async () => {
      const orig = process.env.INTENT_FILTER_MODE;
      process.env.INTENT_FILTER_MODE = 'enforce';
      try {
        _setIntentHandler(async () => ({
          label: 'new_enquiry',
          leadScore: 85,
          confidence: 'high',
          language: 'en',
          reason: 'Valid enquiry with attachment',
        }));

        // Dangerous executable payload (.exe renamed to .pdf)
        const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');

        const res = await request(app)
          .post('/api/v1/emails/inbound')
          .set('x-inbound-secret', INBOUND_SECRET)
          .field('from', 'suspicious@contractor.com')
          .field('to', 'sales@nexus.test')
          .field('subject', 'Pricing inquiry')
          .field('text', 'Please see our requested items.')
          .attach('attachment1', exeBuffer, 'invoice.exe');

        expect(res.status).toBe(201);
        const leadId = res.body.leadId;

        // Verify quarantined security alert Activity was logged on lead
        const alertActivity = await Activity.findOne({
          where: {
            leadId,
            type: 'Security Alert',
          },
        }) as any;
        expect(alertActivity).not.toBeNull();
        expect(alertActivity.outcome).toContain('Attachment Quarantined');
      } finally {
        process.env.INTENT_FILTER_MODE = orig;
      }
    });
  });
});
