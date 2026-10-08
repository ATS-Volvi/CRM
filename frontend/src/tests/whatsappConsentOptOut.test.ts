// Mock external modules before imports
const mockSendWhatsAppMessage = jest.fn();
const mockSendWhatsAppTemplateMessage = jest.fn();

jest.mock("../../../backend/src/services/whatsappService", () => ({
  sendWhatsAppMessage: (...args: any[]) => mockSendWhatsAppMessage(...args),
  sendWhatsAppTemplateMessage: (...args: any[]) => mockSendWhatsAppTemplateMessage(...args)
}));

jest.mock("../../../backend/src/services/handoffAccessService", () => ({
  checkRecordAccess: jest.fn().mockResolvedValue({ canWrite: true })
}));

jest.mock("../../../backend/src/services/aiLeadExtraction", () => ({
  extractLeadDetailsFromText: jest.fn().mockResolvedValue({})
}));

jest.mock("../../../backend/src/services/leadIntakeAutomationEngine", () => ({
  processInboundIntakeEvent: jest.fn().mockResolvedValue({})
}));

jest.mock("../../../backend/src/lead-security-layer", () => ({
  runPipeline: jest.fn((payload) => Promise.resolve(payload)),
  leadSecurityPipeline: () => []
}));

jest.mock("../../../backend/src/services/attributionService", () => ({
  recordLeadTouch: jest.fn().mockResolvedValue({})
}));

jest.mock("../../../backend/src/services/notificationEngine", () => ({
  triggerLeadAssignedNotifications: jest.fn().mockResolvedValue({})
}));

jest.mock("../../../backend/src/services/enrichmentService", () => ({
  enrichLeadAsync: jest.fn().mockResolvedValue({}),
  isPersonalDomain: jest.fn().mockReturnValue(false),
  extractDomain: jest.fn().mockReturnValue("example.com")
}));

const mockModels = {
  Lead: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: "lead-new-123" }),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(1)
  },
  Account: {
    findOne: jest.fn().mockResolvedValue(null)
  },
  Contact: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn().mockResolvedValue([1])
  },
  Customer: {
    findByPk: jest.fn()
  },
  Deal: {
    findOne: jest.fn()
  },
  Activity: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: "act-123" })
  },
  Notification: {
    create: jest.fn().mockResolvedValue({ id: "notif-123" })
  },
  WebhookEvent: {
    create: jest.fn().mockResolvedValue({ id: "we-123" }),
    update: jest.fn().mockResolvedValue([1])
  },
  WhatsAppLog: {
    create: jest.fn().mockResolvedValue({ id: "wal-123" })
  },
  CampaignRecipient: {
    update: jest.fn().mockResolvedValue([1])
  },
  MessageTemplate: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  },
  User: {
    findByPk: jest.fn().mockResolvedValue({ id: "admin-user-01", role: "admin", name: "System Admin" }),
    findOne: jest.fn().mockResolvedValue({ id: "admin-user-01", role: "admin", name: "System Admin" })
  }
};

jest.mock("@nexus-crm/database", () => ({
  sequelize: {
    models: mockModels
  },
  Database: {
    createConnection: jest.fn()
  }
}));

import {
  isWhatsAppOptOutKeyword,
  isWhatsAppOptInKeyword,
  WHATSAPP_OPTOUT_KEYWORDS,
  WHATSAPP_OPTIN_KEYWORDS,
  sendMessage,
  handleIncomingWebhook
} from "../../../backend/src/controllers/whatsappController";
import { createPublicLead } from "../../../backend/src/controllers/publicLeads";
import { recordWhatsAppConsent } from "../../../backend/src/controllers/leadController";

describe("Phase B: WhatsApp Compliance & Opt-Out Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Keyword Helpers", () => {
    test("WHATSAPP_OPTOUT_KEYWORDS contains standard opt-out keywords", () => {
      expect(WHATSAPP_OPTOUT_KEYWORDS.has("STOP")).toBe(true);
      expect(WHATSAPP_OPTOUT_KEYWORDS.has("UNSUBSCRIBE")).toBe(true);
      expect(WHATSAPP_OPTOUT_KEYWORDS.has("CANCEL")).toBe(true);
      expect(WHATSAPP_OPTOUT_KEYWORDS.has("QUIT")).toBe(true);
      expect(WHATSAPP_OPTOUT_KEYWORDS.has("END")).toBe(true);
    });

    test("isWhatsAppOptOutKeyword accurately identifies opt-out commands", () => {
      // Direct matches
      expect(isWhatsAppOptOutKeyword("STOP")).toBe(true);
      expect(isWhatsAppOptOutKeyword("stop")).toBe(true);
      expect(isWhatsAppOptOutKeyword("  Stop  ")).toBe(true);
      expect(isWhatsAppOptOutKeyword("UNSUBSCRIBE")).toBe(true);
      expect(isWhatsAppOptOutKeyword("unsubscribe")).toBe(true);
      expect(isWhatsAppOptOutKeyword("cancel")).toBe(true);
      expect(isWhatsAppOptOutKeyword("quit")).toBe(true);
      expect(isWhatsAppOptOutKeyword("end")).toBe(true);

      // Non-matches
      expect(isWhatsAppOptOutKeyword("STOPPING")).toBe(false);
      expect(isWhatsAppOptOutKeyword("Please stop calling me")).toBe(false);
      expect(isWhatsAppOptOutKeyword("hello")).toBe(false);
      expect(isWhatsAppOptOutKeyword("")).toBe(false);
      expect(isWhatsAppOptOutKeyword(null)).toBe(false);
      expect(isWhatsAppOptOutKeyword(undefined)).toBe(false);
    });

    test("isWhatsAppOptInKeyword accurately identifies opt-in commands", () => {
      expect(isWhatsAppOptInKeyword("START")).toBe(true);
      expect(isWhatsAppOptInKeyword("start")).toBe(true);
      expect(isWhatsAppOptInKeyword("  START  ")).toBe(true);
      expect(isWhatsAppOptInKeyword("UNSTOP")).toBe(true);
      expect(isWhatsAppOptInKeyword("YES")).toBe(true);
      expect(isWhatsAppOptInKeyword("yes")).toBe(true);

      // Non-matches
      expect(isWhatsAppOptInKeyword("STARTING")).toBe(false);
      expect(isWhatsAppOptInKeyword("hello")).toBe(false);
      expect(isWhatsAppOptInKeyword("")).toBe(false);
      expect(isWhatsAppOptInKeyword(null)).toBe(false);
    });
  });

  describe("Outbound WhatsApp Guard (sendMessage)", () => {
    test("rejects send request when Lead has optedOutWhatsapp=true", async () => {
      const mockLead = {
        id: "lead-opted-out-1",
        phone: "+971501234567",
        optedOutWhatsapp: true,
        whatsappConsentStatus: "OPTED_OUT"
      };
      (mockModels.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);

      const req: any = {
        body: {
          leadId: "lead-opted-out-1",
          text: "Hello from our sales team"
        },
        user: { id: "rep-1", role: "rep" }
      };

      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      };

      await sendMessage(req, res);

      expect(statusCode).toBe(400);
      expect(responseBody.optedOut).toBe(true);
      expect(responseBody.error).toContain("recipient has opted out");
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();
    });

    test("rejects send request when Lead has whatsappConsentStatus='OPTED_OUT'", async () => {
      const mockLead = {
        id: "lead-opted-out-2",
        phone: "+971501234567",
        optedOutWhatsapp: false,
        whatsappConsentStatus: "OPTED_OUT"
      };
      (mockModels.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLead);

      const req: any = {
        body: {
          leadId: "lead-opted-out-2",
          text: "Special offer discount"
        },
        user: { id: "rep-1", role: "rep" }
      };

      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      };

      await sendMessage(req, res);

      expect(statusCode).toBe(400);
      expect(responseBody.optedOut).toBe(true);
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    test("rejects send request when recipient phone matches an opted-out Contact", async () => {
      (mockModels.Lead.findByPk as jest.Mock).mockResolvedValueOnce(null);
      (mockModels.Lead.findOne as jest.Mock).mockResolvedValueOnce(null);
      (mockModels.Contact.findOne as jest.Mock).mockResolvedValueOnce({
        id: "contact-opted-out-1",
        phone: "+971509998888",
        optedOutWhatsapp: true,
        whatsappConsentStatus: "OPTED_OUT"
      });

      const req: any = {
        body: {
          phone: "+971509998888",
          text: "Checking in on the quote"
        },
        user: { id: "rep-1", role: "rep" }
      };

      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      };

      await sendMessage(req, res);

      expect(statusCode).toBe(400);
      expect(responseBody.optedOut).toBe(true);
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });
  });

  describe("Inbound Webhook Opt-Out / Opt-In Processing (handleIncomingWebhook)", () => {
    test("inbound STOP keyword sets Lead and Contact to opted-out, logs Activity, creates Notification, and sends zero outbound messages", async () => {
      const mockLead = {
        id: "lead-stop-test",
        name: "Omar Farooq",
        phone: "+971501112233",
        assignedToId: "rep-05",
        update: jest.fn().mockResolvedValue(true)
      };

      (mockModels.Activity.findOne as jest.Mock).mockResolvedValueOnce(null); // No duplicate
      (mockModels.Lead.findOne as jest.Mock).mockResolvedValueOnce(mockLead);
      (mockModels.Contact.findOne as jest.Mock).mockResolvedValueOnce(null);
      (mockModels.Lead.update as jest.Mock).mockResolvedValueOnce([1]);
      (mockModels.Contact.update as jest.Mock).mockResolvedValueOnce([1]);
      (mockModels.CampaignRecipient.update as jest.Mock).mockResolvedValueOnce([1]);

      const req: any = {
        headers: {},
        body: {
          MessageSid: "SM_test_stop_123",
          From: "whatsapp:+971501112233",
          Body: "STOP",
          ProfileName: "Omar Farooq"
        }
      };

      let sentXml = "";
      let statusCode = 200;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            type: () => ({
              send: (xml: string) => {
                sentXml = xml;
              }
            })
          };
        }
      };

      await handleIncomingWebhook(req, res);

      // Verification 1: Lead updated to opted out
      expect(mockModels.Lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          optedOutWhatsapp: true,
          whatsappConsentStatus: "OPTED_OUT",
          whatsappOptOutSource: "INBOUND_KEYWORD"
        }),
        expect.anything()
      );

      // Verification 2: Contact updated to opted out
      expect(mockModels.Contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          optedOutWhatsapp: true,
          whatsappConsentStatus: "OPTED_OUT"
        }),
        expect.anything()
      );

      // Verification 3: CampaignRecipient unsubscribedAt marked
      expect(mockModels.CampaignRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          unsubscribedAt: expect.any(Date)
        }),
        expect.objectContaining({
          where: expect.objectContaining({ leadId: "lead-stop-test" })
        })
      );

      // Verification 4: Activity logged
      expect(mockModels.Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-stop-test",
          type: "whatsapp_sms",
          outcome: "opted_out",
          notes: 'WhatsApp Opt-Out received: "STOP"',
          direction: "inbound"
        })
      );

      // Verification 5: Notification created for rep
      expect(mockModels.Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "rep-05",
          type: "whatsapp_inbound",
          title: expect.stringContaining("🛑 WhatsApp Opt-Out"),
          message: expect.stringContaining('keyword "STOP"')
        })
      );

      // Verification 6: Clean XML response with ZERO outbound messages
      expect(statusCode).toBe(200);
      expect(sentXml).toBe("<Response></Response>");
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppTemplateMessage).not.toHaveBeenCalled();
    });

    test("inbound START keyword resets Lead and Contact to opted-in and logs Activity", async () => {
      const mockLead = {
        id: "lead-start-test",
        name: "Omar Farooq",
        phone: "+971501112233",
        assignedToId: "rep-05",
        update: jest.fn().mockResolvedValue(true)
      };

      (mockModels.Activity.findOne as jest.Mock).mockResolvedValueOnce(null);
      (mockModels.Lead.findOne as jest.Mock).mockResolvedValueOnce(mockLead);
      (mockModels.Contact.findOne as jest.Mock).mockResolvedValueOnce(null);
      (mockModels.Lead.update as jest.Mock).mockResolvedValueOnce([1]);
      (mockModels.Contact.update as jest.Mock).mockResolvedValueOnce([1]);

      const req: any = {
        headers: {},
        body: {
          MessageSid: "SM_test_start_456",
          From: "whatsapp:+971501112233",
          Body: "START",
          ProfileName: "Omar Farooq"
        }
      };

      let sentXml = "";
      let statusCode = 200;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            type: () => ({
              send: (xml: string) => {
                sentXml = xml;
              }
            })
          };
        }
      };

      await handleIncomingWebhook(req, res);

      // Verification 1: Lead updated to opted in
      expect(mockModels.Lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          optedOutWhatsapp: false,
          whatsappConsentStatus: "OPTED_IN",
          whatsappOptInAt: expect.any(Date)
        }),
        expect.anything()
      );

      // Verification 2: Contact updated to opted in
      expect(mockModels.Contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          optedOutWhatsapp: false,
          whatsappConsentStatus: "OPTED_IN",
          whatsappOptInAt: expect.any(Date)
        }),
        expect.anything()
      );

      // Verification 3: Activity logged with outcome opted_in
      expect(mockModels.Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-start-test",
          type: "whatsapp_sms",
          outcome: "opted_in",
          notes: 'WhatsApp Opt-In received: "START"',
          direction: "inbound"
        })
      );

      // Verification 4: Notification sent
      expect(mockModels.Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "rep-05",
          title: expect.stringContaining("🟢 WhatsApp Opt-In")
        })
      );

      // Verification 5: Empty response without outbound messages
      expect(statusCode).toBe(200);
      expect(sentXml).toBe("<Response></Response>");
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });
  });

  describe("Public Lead Intake WhatsApp Consent (createPublicLead)", () => {
    test("sets whatsappConsentStatus='OPTED_IN' and source='public_form' only when whatsappConsent: true is explicitly passed", async () => {
      let createdLeadData: any = null;
      (mockModels.Lead.create as jest.Mock).mockImplementationOnce((data: any) => {
        createdLeadData = data;
        return Promise.resolve({ id: "lead-form-optin-1", ...data });
      });

      const req: any = {
        body: {
          firstName: "Fatima",
          lastName: "Al-Zahra",
          email: "fatima@modular.ae",
          phone: "+971508887766",
          company: "Al-Zahra Logistics",
          whatsappConsent: true
        }
      };

      let responseJson: any = null;
      let statusCode = 200;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseJson = body;
            }
          };
        }
      };

      await createPublicLead(req, res);

      expect(createdLeadData).not.toBeNull();
      expect(createdLeadData.whatsappConsentStatus).toBe("OPTED_IN");
      expect(createdLeadData.whatsappConsentSource).toBe("public_form");
      expect(createdLeadData.whatsappOptInAt).toBeInstanceOf(Date);
      expect(createdLeadData.optedOutWhatsapp).toBe(false);
    });

    test("leaves lead at whatsappConsentStatus='UNSPECIFIED' when whatsappConsent is absent or false", async () => {
      let createdLeadData: any = null;
      (mockModels.Lead.create as jest.Mock).mockImplementationOnce((data: any) => {
        createdLeadData = data;
        return Promise.resolve({ id: "lead-form-unspecified-1", ...data });
      });

      const req: any = {
        body: {
          firstName: "Khalid",
          lastName: "Mansoor",
          email: "khalid@constructions.ae",
          phone: "+971505554433",
          company: "Mansoor Build"
          // whatsappConsent omitted
        }
      };

      const res: any = {
        status: () => ({
          json: () => {}
        })
      };

      await createPublicLead(req, res);

      expect(createdLeadData).not.toBeNull();
      expect(createdLeadData.whatsappConsentStatus).toBe("UNSPECIFIED");
      expect(createdLeadData.whatsappConsentSource).toBeNull();
      expect(createdLeadData.whatsappOptInAt).toBeNull();
      expect(createdLeadData.optedOutWhatsapp).toBe(false);
    });

    test("sets whatsappPhone from payload.phone when utmSource is 'whatsapp' (case-insensitive) but source is Website", async () => {
      let createdLeadData: any = null;
      (mockModels.Lead.create as jest.Mock).mockImplementationOnce((data: any) => {
        createdLeadData = data;
        return Promise.resolve({ id: "lead-utm-wa-1", ...data });
      });

      const req: any = {
        body: {
          firstName: "Zaid",
          lastName: "Khoury",
          email: "zaid@khoury.ae",
          phone: "+971501239876",
          company: "Khoury Logistics",
          source: "Website",
          utm_source: "WhatsApp"
          // whatsappConsent omitted
        }
      };

      const res: any = {
        status: () => ({
          json: () => {}
        })
      };

      await createPublicLead(req, res);

      expect(createdLeadData).not.toBeNull();
      expect(createdLeadData.whatsappPhone).toBe("+971501239876");
      expect(createdLeadData.whatsappConsentStatus).toBe("UNSPECIFIED");
    });

    test("flags phone-based duplicate, logs Activity referencing older lead leadNumber, and does not merge", async () => {
      const existingOlderLead = {
        id: "lead-older-100",
        leadNumber: "LD-2026-00042",
        phone: "+971509998877",
        createdAt: new Date("2026-01-01")
      };

      // Mock finding the older lead by phone
      (mockModels.Lead.findAll as jest.Mock).mockResolvedValueOnce([existingOlderLead]);

      let createdNewLeadData: any = null;
      (mockModels.Lead.create as jest.Mock).mockImplementationOnce((data: any) => {
        createdNewLeadData = data;
        return Promise.resolve({ id: "lead-new-dup-101", ...data });
      });

      const req: any = {
        body: {
          firstName: "Tariq",
          lastName: "Duplicate",
          email: "tariq.dup@example.com",
          phone: "+971 50 999 8877", // same normalized digits
          company: "Second Submissions Co"
        }
      };

      const res: any = {
        status: () => ({
          json: () => {}
        })
      };

      await createPublicLead(req, res);

      // Verify new lead was created (not merged) and duplicate marker set in rawPayload without polluting sourceDetail
      expect(createdNewLeadData).not.toBeNull();
      const parsedRawPayload = JSON.parse(createdNewLeadData.rawPayload);
      expect(parsedRawPayload.isPossibleDuplicate).toBe(true);
      expect(parsedRawPayload.duplicateOfLeadNumber).toBe("LD-2026-00042");

      // Verify Activity logged on new lead referencing older lead's leadNumber
      expect(mockModels.Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "note",
          outcome: "Possible Duplicate Lead Detected",
          notes: expect.stringContaining("LD-2026-00042"),
          direction: "internal"
        })
      );
    });
  });

  describe("Manual Rep Consent Recording (recordWhatsAppConsent)", () => {
    test("writes Activity, updates Lead fields with chosen source (verbal), and sets OPTED_IN", async () => {
      const mockLeadInstance = {
        id: "lead-manual-consent-1",
        firstName: "Tariq",
        phone: "+971507776655",
        whatsappConsentStatus: "UNSPECIFIED",
        optedOutWhatsapp: false,
        whatsappOptInAt: null,
        whatsappConsentSource: null,
        save: jest.fn().mockResolvedValue(true)
      };

      (mockModels.Lead.findByPk as jest.Mock).mockResolvedValueOnce(mockLeadInstance);
      (mockModels.Activity.create as jest.Mock).mockResolvedValueOnce({ id: "act-consent-1" });

      const req: any = {
        params: { id: "lead-manual-consent-1" },
        body: { source: "verbal" },
        user: { id: "rep-007", name: "Agent Smith", role: "rep" }
      };

      let statusCode = 200;
      let responseJson: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseJson = body;
            }
          };
        }
      };

      await recordWhatsAppConsent(req, res);

      // Verification 1: Lead fields updated
      expect(statusCode).toBe(200);
      expect(mockLeadInstance.whatsappConsentStatus).toBe("OPTED_IN");
      expect(mockLeadInstance.whatsappConsentSource).toBe("verbal");
      expect(mockLeadInstance.optedOutWhatsapp).toBe(false);
      expect(mockLeadInstance.whatsappOptInAt).toBeInstanceOf(Date);
      expect(mockLeadInstance.save).toHaveBeenCalled();

      // Verification 2: Activity logged noting rep and source
      expect(mockModels.Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-manual-consent-1",
          type: "note",
          notes: expect.stringContaining("Agent Smith"),
          outcome: expect.stringMatching(/verbal/i),
          direction: "internal",
          createdById: "rep-007"
        })
      );
    });
  });

  describe("Phase C WhatsApp Campaign Audience Eligibility Rule", () => {
    // Pure function representing Phase C WhatsApp campaign audience filter rule:
    // "whatsappConsentStatus === 'OPTED_IN' AND optedOutWhatsapp !== true"
    function isEligibleForWhatsAppCampaign(lead: {
      whatsappConsentStatus?: string;
      optedOutWhatsapp?: boolean;
    }): boolean {
      return (
        lead.whatsappConsentStatus === "OPTED_IN" &&
        lead.optedOutWhatsapp !== true
      );
    }

    test("correctly excludes leads with UNSPECIFIED status from WhatsApp campaign audience", () => {
      const unspecifiedLead = {
        whatsappConsentStatus: "UNSPECIFIED",
        optedOutWhatsapp: false
      };
      expect(isEligibleForWhatsAppCampaign(unspecifiedLead)).toBe(false);
    });

    test("correctly excludes leads with OPTED_OUT status or optedOutWhatsapp=true", () => {
      const optedOutLead1 = {
        whatsappConsentStatus: "OPTED_OUT",
        optedOutWhatsapp: false
      };
      const optedOutLead2 = {
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: true
      };
      expect(isEligibleForWhatsAppCampaign(optedOutLead1)).toBe(false);
      expect(isEligibleForWhatsAppCampaign(optedOutLead2)).toBe(false);
    });

    test("allows only leads with explicitly verified OPTED_IN and not opted out", () => {
      const optedInLead = {
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false
      };
      expect(isEligibleForWhatsAppCampaign(optedInLead)).toBe(true);
    });
  });
});
