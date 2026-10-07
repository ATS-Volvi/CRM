import { handleUnsubscribe } from "../../src/controllers/leadController";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

describe("handleUnsubscribe Unit Tests (POST /api/v1/leads/unsubscribe/:id)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("a. First POST for a valid lead: returns success HTML, sets optedOutEmail true, creates Activity with type 'email', and sets unsubscribedAt on CampaignRecipient rows", async () => {
    const mockLead: any = {
      id: crypto.randomUUID(),
      email: "valid-lead@example.com",
      optedOutEmail: false,
      assignedToId: "user-123",
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(sequelize.models.Lead, "findByPk").mockResolvedValueOnce(mockLead);
    const activitySpy = jest.spyOn(sequelize.models.Activity, "create").mockResolvedValueOnce({} as any);
    const recipientSpy = jest.spyOn(sequelize.models.CampaignRecipient, "update").mockResolvedValueOnce([1] as any);

    const req: any = { params: { id: mockLead.id } };
    let responseHtml = "";
    const res: any = {
      send: jest.fn((html: string) => {
        responseHtml = html;
      }),
      status: jest.fn().mockReturnThis()
    };

    await handleUnsubscribe(req, res);

    expect(mockLead.optedOutEmail).toBe(true);
    expect(mockLead.save).toHaveBeenCalled();

    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: mockLead.id,
        type: "email",
        direction: "internal",
        notes: expect.stringContaining("Client confirmed Unsubscribe")
      })
    );

    const activityPayload = activitySpy.mock.calls[0][0] as any;
    expect(activityPayload).not.toHaveProperty("status");
    expect(activityPayload).not.toHaveProperty("assignedToId");

    expect(recipientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribedAt: expect.any(Date) }),
      expect.objectContaining({ where: { leadId: mockLead.id, unsubscribedAt: null } })
    );

    expect(responseHtml).toContain("Unsubscribed Successfully");
  });

  it("b. Second POST for the same lead: still returns success and does not create duplicate Activity", async () => {
    const mockLead: any = {
      id: crypto.randomUUID(),
      email: "already-opted-out@example.com",
      optedOutEmail: true,
      assignedToId: "user-123",
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(sequelize.models.Lead, "findByPk").mockResolvedValueOnce(mockLead);
    const activitySpy = jest.spyOn(sequelize.models.Activity, "create");
    const recipientSpy = jest.spyOn(sequelize.models.CampaignRecipient, "update").mockResolvedValueOnce([0] as any);

    const req: any = { params: { id: mockLead.id } };
    let responseHtml = "";
    const res: any = {
      send: jest.fn((html: string) => {
        responseHtml = html;
      }),
      status: jest.fn().mockReturnThis()
    };

    await handleUnsubscribe(req, res);

    expect(mockLead.save).not.toHaveBeenCalled();
    expect(activitySpy).not.toHaveBeenCalled();
    expect(recipientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribedAt: expect.any(Date) }),
      expect.objectContaining({ where: { leadId: mockLead.id, unsubscribedAt: null } })
    );
    expect(responseHtml).toContain("Unsubscribed Successfully");
  });

  it("c. Activity.create throwing: still returns success HTML and the lead is still opted out", async () => {
    const mockLead: any = {
      id: crypto.randomUUID(),
      email: "error-lead@example.com",
      optedOutEmail: false,
      assignedToId: "user-123",
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(sequelize.models.Lead, "findByPk").mockResolvedValueOnce(mockLead);
    jest.spyOn(sequelize.models.Activity, "create").mockRejectedValueOnce(
      new Error("SequelizeDatabaseError: invalid input value for enum enum_Activities_type: \"Email\"")
    );
    const recipientSpy = jest.spyOn(sequelize.models.CampaignRecipient, "update").mockResolvedValueOnce([1] as any);

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const req: any = { params: { id: mockLead.id } };
    let responseHtml = "";
    const res: any = {
      send: jest.fn((html: string) => {
        responseHtml = html;
      }),
      status: jest.fn().mockReturnThis()
    };

    await handleUnsubscribe(req, res);

    expect(mockLead.optedOutEmail).toBe(true);
    expect(mockLead.save).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error logging unsubscribe activity:",
      expect.any(Error)
    );
    expect(recipientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribedAt: expect.any(Date) }),
      expect.objectContaining({ where: { leadId: mockLead.id, unsubscribedAt: null } })
    );
    expect(responseHtml).toContain("Unsubscribed Successfully");

    consoleErrorSpy.mockRestore();
  });

  it("d. Unknown lead id: returns the existing generic success page", async () => {
    jest.spyOn(sequelize.models.Lead, "findByPk").mockResolvedValueOnce(null);

    const req: any = { params: { id: "non-existent-lead-id" } };
    let responseHtml = "";
    const res: any = {
      send: jest.fn((html: string) => {
        responseHtml = html;
      }),
      status: jest.fn().mockReturnThis()
    };

    await handleUnsubscribe(req, res);

    expect(responseHtml).toContain("Unsubscribed Successfully");
    expect(responseHtml).toContain("You have been removed from our mailing list");
  });
});
