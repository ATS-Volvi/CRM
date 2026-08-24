import { getHandoffMessages, sendHandoffMessage, getHandoffParticipants } from "../../src/controllers/handoffMessageController";
import { getDealAccessLevel } from "../../src/services/handoffAccessService";
import { sequelize } from "@nexus-crm/database";

describe("Handoff Message Permissions & Multi-Hop Chat Tests", () => {
  const dealId = "deal-test-4444";
  const rep1Id = "rep-1111-salesman1";
  const rep2Id = "rep-2222";
  const rep3Id = "rep-3333";
  const rep4Id = "rep-4444-salesman2";
  const unrelatedRepId = "rep-9999-unrelated";

  const sampleDeal = {
    id: dealId,
    leadId: "lead-test-1111",
    ownerId: rep4Id,
    name: "Test Enterprise Opportunity",
    amount: 500000
  };

  const sampleLead = {
    id: "lead-test-1111",
    assignedToId: rep1Id,
    firstName: "John",
    lastName: "Doe"
  };

  beforeAll(() => {
    // Mock sequelize models for handoff chat test isolation
    sequelize.models.Deal = {
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === dealId) return sampleDeal;
        return null;
      })
    } as any;

    sequelize.models.Lead = {
      findByPk: jest.fn().mockImplementation(async (id: string) => {
        if (id === "lead-test-1111") return sampleLead;
        return null;
      })
    } as any;

    // Simulate 4-rep handoff chain history: Rep 1 -> Rep 2 -> Rep 3 -> Rep 4
    sequelize.models.DealReassignmentHistory = {
      findAll: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.dealId === dealId) {
          return [
            { id: "h-3", dealId, oldOwnerId: rep3Id, newOwnerId: rep4Id, createdAt: "2026-08-24T12:00:00Z" },
            { id: "h-2", dealId, oldOwnerId: rep2Id, newOwnerId: rep3Id, createdAt: "2026-08-24T10:00:00Z" },
            { id: "h-1", dealId, oldOwnerId: rep1Id, newOwnerId: rep2Id, createdAt: "2026-08-24T08:00:00Z" }
          ];
        }
        return [];
      }),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.dealId === dealId) {
          const syms = Object.getOwnPropertySymbols(where);
          const orArray = syms.length > 0 ? where[syms[0]] : where["Symbol(or)"] || [];
          const targetId = orArray[0]?.oldOwnerId || orArray[1]?.newOwnerId;
          if (targetId && [rep1Id, rep2Id, rep3Id, rep4Id].includes(targetId)) {
            return { id: "h-3", dealId, oldOwnerId: rep3Id, newOwnerId: rep4Id, createdAt: "2026-08-24T12:00:00Z" };
          }
        }
        return null;
      })
    } as any;

    sequelize.models.LeadReassignmentHistory = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null)
    } as any;

    sequelize.models.LeadAssignmentAudit = { findOne: jest.fn().mockResolvedValue(null) } as any;
    sequelize.models.DealOwner = { findOne: jest.fn().mockResolvedValue(null) } as any;

    sequelize.models.User = {
      findAll: jest.fn().mockImplementation(async ({ where }: any) => {
        const ids = where?.id || [];
        return [
          { id: rep1Id, name: "Salesman 1 (Liam)", email: "liam@nexus.com", role: "sales_rep" },
          { id: rep2Id, name: "Rep 2 (Sarah)", email: "sarah@nexus.com", role: "sales_rep" },
          { id: rep3Id, name: "Rep 3 (Alex)", email: "alex@nexus.com", role: "sales_rep" },
          { id: rep4Id, name: "Salesman 2 (Emma)", email: "emma@nexus.com", role: "senior_ae" }
        ].filter(u => ids.includes(u.id));
      })
    } as any;

    sequelize.models.HandoffMessage = {
      findAndCountAll: jest.fn().mockResolvedValue({
        count: 2,
        rows: [
          { id: "msg-1", dealId, senderId: rep1Id, message: "Initial handoff note", createdAt: "2026-08-24T09:00:00Z" },
          { id: "msg-2", dealId, senderId: rep4Id, message: "Received details", createdAt: "2026-08-24T13:00:00Z" }
        ]
      }),
      create: jest.fn().mockImplementation(async (data: any) => ({
        id: "msg-new-123",
        ...data,
        createdAt: new Date().toISOString()
      })),
      findByPk: jest.fn().mockImplementation(async (id: string) => ({
        id,
        dealId,
        senderId: rep1Id,
        message: "Test response",
        createdAt: new Date().toISOString(),
        sender: { id: rep1Id, name: "Salesman 1 (Liam)", email: "liam@nexus.com", role: "sales_rep" }
      }))
    } as any;
  });

  test("1. Unrelated rep gets 403 Forbidden on handoff chat room", async () => {
    const req: any = { query: { dealId }, user: { id: unrelatedRepId, role: "sales_rep" } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await getHandoffMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Forbidden") })
    );
  });

  test("2. Prior Owner (Salesman 1) has deal isViewOnly: true, but successfully sends & reads chat messages", async () => {
    // Verify deal view-only check first
    const dealAccess = await getDealAccessLevel(rep1Id, "sales_rep", sampleDeal);
    expect(dealAccess.isViewOnly).toBe(true);
    expect(dealAccess.canWrite).toBe(false);
    expect(dealAccess.canRead).toBe(true);

    // Verify chat message list read
    const readReq: any = { query: { dealId }, user: { id: rep1Id, role: "sales_rep" } };
    const readRes: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await getHandoffMessages(readReq, readRes);
    expect(readRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 2, data: expect.any(Array) })
    );

    // Verify chat message send (decoupled write)
    const sendReq: any = { body: { dealId, message: "Clarification on client spec" }, user: { id: rep1Id, role: "sales_rep" } };
    const sendRes: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await sendHandoffMessage(sendReq, sendRes);
    expect(sendRes.status).toHaveBeenCalledWith(201);
  });

  test("3. 4-Rep handoff chain (Rep 1 -> Rep 2 -> Rep 3 -> Rep 4) all land in the same chat room with full access", async () => {
    const participants = await getHandoffParticipants({ dealId });

    expect(participants.firstQualifyingRep.id).toBe(rep1Id);
    expect(participants.previousOwner.id).toBe(rep3Id);
    expect(participants.currentOwner.id).toBe(rep4Id);
    expect(participants.allParticipants.length).toBe(4);

    const participantIds = participants.allParticipants.map((p: any) => p.id);
    expect(participantIds).toContain(rep1Id);
    expect(participantIds).toContain(rep2Id);
    expect(participantIds).toContain(rep3Id);
    expect(participantIds).toContain(rep4Id);
  });

  test("4. getHandoffMessages supports pagination (page & limit)", async () => {
    const req: any = { query: { dealId, page: "2", limit: "10" }, user: { id: rep4Id, role: "senior_ae" } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await getHandoffMessages(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        data: expect.any(Array)
      })
    );
  });
});
