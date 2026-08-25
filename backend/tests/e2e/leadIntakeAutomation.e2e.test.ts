process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = "./test.sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import jwt from "jsonwebtoken";
import {
  getMissingLeadInformation,
  generateCollectionMessage,
  generateAcknowledgementMessage,
  parseInboundCustomerResponse,
  processInboundIntakeEvent
} from "../../src/services/leadIntakeAutomationEngine";

describe("Automated Lead Intake & Missing Information Collection Engine E2E Tests", () => {
  let app: any;
  let authToken: string;
  const adminUserId = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    app = createServer();
    authToken = jwt.sign(
      { id: adminUserId, email: "admin@nexus.com", role: "admin" },
      process.env.JWT_SECRET || "default_secret"
    );
  });

  beforeEach(() => {
    jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mailgun_intake_001" } as any);
    jest.spyOn(emailService, "sendCustomEmail").mockResolvedValue({ id: "mailgun_intake_002" } as any);
    jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({
      success: true,
      messageId: "twilio_intake_003"
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Field Completeness & Conversational Prompt Generation", () => {
    it("should identify missing name, company, and email when only WhatsApp number and requirement are provided", async () => {
      const mockLead = {
        phone: "+971501234567",
        whatsappPhone: "+971501234567",
        extractedRequirement: { item: "20 control panels" }
      };

      const result = await getMissingLeadInformation(mockLead);
      expect(result.isComplete).toBe(false);
      expect(result.missing).toEqual(expect.arrayContaining(["name", "company", "email"]));
      expect(result.missing).not.toContain("phone");
      expect(result.missing).not.toContain("requirement");

      const prompt = generateCollectionMessage(result.missing, "whatsapp");
      expect(prompt).toContain("full name, company name and email address");
      expect(prompt).not.toContain("phone");
    });

    it("should identify missing phone when email, name, and company are provided", async () => {
      const mockLead = {
        firstName: "Faisal",
        lastName: "Rahman",
        company: "Gulf Manufacturing",
        email: "faisal@gulfmfg.com",
        message: "Need 20 PLC panels"
      };

      const result = await getMissingLeadInformation(mockLead);
      expect(result.isComplete).toBe(false);
      expect(result.missing).toEqual(["phone"]);
      expect(result.known.email).toBe("faisal@gulfmfg.com");

      const prompt = generateCollectionMessage(result.missing, "email", "Faisal");
      expect(prompt).toContain("phone/WhatsApp number");
      expect(prompt).not.toContain("email address");
    });

    it("should recognize complete lead information without sending redundant requests", async () => {
      const mockLead = {
        firstName: "Faisal",
        lastName: "Rahman",
        company: "Gulf Manufacturing",
        email: "faisal@gulfmfg.com",
        phone: "+971501234567",
        message: "20 control panels for plant"
      };

      const result = await getMissingLeadInformation(mockLead);
      expect(result.isComplete).toBe(true);
      expect(result.missing).toHaveLength(0);

      const ack = generateAcknowledgementMessage("whatsapp", "Faisal");
      expect(ack.body).toContain("Thanks, Faisal! We've received your enquiry");
    });
  });

  describe("2. Natural Language Customer Response Parsing", () => {
    it("should extract name, company, and email from natural conversational text", () => {
      const text = "My name is Faisal, I work at Gulf Manufacturing and my email is faisal@gulfmfg.com.";
      const parsed = parseInboundCustomerResponse(text);

      expect(parsed.firstName).toBe("Faisal");
      expect(parsed.companyName).toBe("Gulf Manufacturing");
      expect(parsed.email).toBe("faisal@gulfmfg.com");
    });

    it("should extract requirement quantity and context from natural messages", () => {
      const text = "Need 20 PLC panels for our new plant expansion.";
      const parsed = parseInboundCustomerResponse(text);

      expect(parsed.quantity).toBe(20);
      expect(parsed.context).toContain("plant expansion");
      expect(parsed.requirement).toContain("PLC panels");
    });
  });

  describe("3. Acceptance Test: WhatsApp Lead Intake Flow", () => {
    it("should intake new WhatsApp lead -> request missing details -> parse reply -> assign sales rep", async () => {
      const whatsappFrom = "+971509998877";

      // Step 1: Inbound WhatsApp message arrives with only requirement
      const firstEvent = await processInboundIntakeEvent({
        channel: "whatsapp",
        eventId: "wa_evt_001",
        senderPhone: whatsappFrom,
        message: "Hi, I need a quotation for 20 control panels."
      });

      expect(firstEvent.leadId).toBeDefined();
      expect(firstEvent.isComplete).toBe(false);
      expect(firstEvent.intakeStatus).toBe("COLLECTING_DETAILS");
      expect(whatsappService.sendWhatsAppMessage).toHaveBeenCalledWith(
        whatsappFrom,
        expect.stringContaining("full name, company name and email address")
      );

      // Verify Lead created with missing fields
      const { Lead, Contact, Activity } = sequelize.models;
      const lead1 = await Lead.findByPk(firstEvent.leadId) as any;
      expect(lead1.intakeStatus).toBe("COLLECTING_DETAILS");
      expect(lead1.intakeMessageCount).toBe(1);
      expect(lead1.missingFields).toEqual(expect.arrayContaining(["name", "company", "email"]));

      // Step 2: Customer replies with missing details
      const secondEvent = await processInboundIntakeEvent({
        channel: "whatsapp",
        eventId: "wa_evt_002",
        leadId: firstEvent.leadId,
        senderPhone: whatsappFrom,
        message: "My name is Faisal Rahman, I work at Gulf Manufacturing and my email is faisal@gulfmfg.com."
      });

      expect(secondEvent.isComplete).toBe(true);
      expect(secondEvent.intakeStatus).toBe("ASSIGNED");
      expect(secondEvent.assignedToId).toBeDefined();

      // Verify Lead and Contact updated
      const lead2 = await Lead.findByPk(firstEvent.leadId) as any;
      expect(lead2.firstName).toBe("Faisal");
      expect(lead2.lastName).toBe("Rahman");
      expect(lead2.company).toBe("Gulf Manufacturing");
      expect(lead2.email).toBe("faisal@gulfmfg.com");
      expect(lead2.intakeStatus).toBe("ASSIGNED");

      // Verify Contact resolved without duplication
      const contacts = await Contact.findAll({ where: { email: "faisal@gulfmfg.com" } });
      expect(contacts.length).toBe(1);
      expect((contacts[0] as any).firstName).toBe("Faisal");

      // Verify acknowledgement sent to customer
      expect(whatsappService.sendWhatsAppMessage).toHaveBeenCalledWith(
        whatsappFrom,
        expect.stringMatching(/Thanks,\s+Faisal.*We've received your enquiry/)
      );
    });
  });

  describe("4. Acceptance Test: Email Intake Flow", () => {
    it("should intake inbound email -> request missing phone -> parse reply -> assign sales rep", async () => {
      const email = "karim@almadinagroup.com";

      // Step 1: Inbound Email arrives with name, company, email, but no phone
      const emailEvent1 = await processInboundIntakeEvent({
        channel: "email",
        eventId: "email_evt_101",
        senderEmail: email,
        senderName: "Karim Mansoor",
        message: "We need pricing for 15 server nodes for Al Madina Group.",
        formData: {
          firstName: "Karim",
          lastName: "Mansoor",
          company: "Al Madina Group",
          email: email,
          requirement: "15 server nodes"
        }
      });

      expect(emailEvent1.isComplete).toBe(false);
      expect(emailEvent1.intakeStatus).toBe("COLLECTING_DETAILS");
      expect(emailService.sendCustomEmail).toHaveBeenCalledWith(
        email,
        expect.stringContaining("enquiry"),
        expect.stringContaining("phone/WhatsApp number"),
        emailEvent1.leadId
      );

      // Step 2: Customer replies with phone number
      const emailEvent2 = await processInboundIntakeEvent({
        channel: "email",
        eventId: "email_evt_102",
        leadId: emailEvent1.leadId,
        senderEmail: email,
        message: "You can reach me at +971 52 345 6789."
      });

      expect(emailEvent2.isComplete).toBe(true);
      expect(emailEvent2.intakeStatus).toBe("ASSIGNED");

      const { Lead } = sequelize.models;
      const updatedLead = await Lead.findByPk(emailEvent1.leadId) as any;
      expect(updatedLead.phone).toBe("+971 52 345 6789");
      expect(updatedLead.intakeStatus).toBe("ASSIGNED");
    });
  });

  describe("5. Acceptance Test: Website Form Submission", () => {
    it("should intake complete website lead without requesting known data and acknowledge immediately", async () => {
      const response = await request(app)
        .post("/api/v1/public/leads")
        .send({
          firstName: "Rashid",
          lastName: "Al-Nuaimi",
          company: "Emirates Steel Corp",
          email: "rashid@emiratessteel.ae",
          phone: "+971558889900",
          message: "Require 30 heavy automation controllers.",
          source: "Website",
          utm_source: "google_ads",
          utm_campaign: "q3_enterprise_launch"
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.leadId).toBeDefined();

      const { Lead, Contact } = sequelize.models;
      const lead = await Lead.findByPk(response.body.leadId) as any;
      expect(lead.intakeStatus).toBe("ASSIGNED");
      expect(lead.missingFields).toHaveLength(0);
      expect(lead.assignedToId).toBeDefined();

      const contact = await Contact.findOne({ where: { email: "rashid@emiratessteel.ae" } });
      expect(contact).not.toBeNull();
      expect((contact as any)?.emailVerified).toBe(true);
    });
  });

  describe("6. Idempotency & Safety Limits", () => {
    it("should ignore duplicate webhook events with same eventId", async () => {
      const res1 = await processInboundIntakeEvent({
        channel: "whatsapp",
        eventId: "duplicate_test_evt_999",
        senderPhone: "+971500001122",
        message: "First message"
      });

      const res2 = await processInboundIntakeEvent({
        channel: "whatsapp",
        eventId: "duplicate_test_evt_999",
        senderPhone: "+971500001122",
        message: "First message duplicate webhook"
      });

      expect(res1.leadId).toBe(res2.leadId);
      expect(res2.isDuplicateEvent).toBe(true);
    });

    it("should fallback to sales rep assignment if customer does not provide details after 2 requests", async () => {
      const { Lead } = sequelize.models;
      const lead = await Lead.create({
        id: require("crypto").randomUUID(),
        leadNumber: "LD-TEST-FALLBACK",
        firstName: "Incomplete",
        lastName: "Lead",
        phone: "+971507773344",
        intakeStatus: "COLLECTING_DETAILS",
        intakeMessageCount: 2,
        missingFields: ["email", "company"]
      }) as any;

      const fallbackResult = await processInboundIntakeEvent({
        channel: "whatsapp",
        leadId: lead.id,
        senderPhone: "+971507773344",
        message: "Still not providing email"
      });

      expect(fallbackResult.intakeStatus).toBe("INCOMPLETE");
      expect(fallbackResult.assignedToId).toBeDefined();
    });
  });

  describe("7. Missing Info & Request Details API Endpoints", () => {
    it("should return missing fields via GET /api/v1/leads/:id/missing-info", async () => {
      const { Lead } = sequelize.models;
      const testLead = await Lead.create({
        id: require("crypto").randomUUID(),
        leadNumber: "LD-API-TEST-001",
        firstName: "Tariq",
        lastName: "Habib",
        phone: "+971506661122",
        intakeStatus: "INCOMPLETE",
        missingFields: ["email", "company", "requirement"]
      }) as any;

      const res = await request(app)
        .get(`/api/v1/leads/${testLead.id}/missing-info`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(false);
      expect(res.body.missing).toEqual(expect.arrayContaining(["email", "company", "requirement"]));
    });

    it("should allow sales rep to trigger manual details request via POST /api/v1/leads/:id/request-details", async () => {
      const { Lead } = sequelize.models;
      const testLead = await Lead.create({
        id: require("crypto").randomUUID(),
        leadNumber: "LD-API-TEST-002",
        firstName: "Tariq",
        lastName: "Habib",
        phone: "+971506661122",
        intakeStatus: "INCOMPLETE"
      }) as any;

      const res = await request(app)
        .post(`/api/v1/leads/${testLead.id}/request-details`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "whatsapp" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intakeStatus).toBe("COLLECTING_DETAILS");
      expect(whatsappService.sendWhatsAppMessage).toHaveBeenCalled();
    });
  });
});
