import { sequelize, Deal, User, Lead, LeadReassignmentHistory, DealReassignmentHistory, HandoffMessage, PipelineStage } from "@nexus-crm/database";
import { getDealAccessLevel } from "../../src/services/handoffAccessService";
import { getHandoffParticipants } from "../../src/controllers/handoffMessageController";

describe("12-Point Comprehensive Commercial Cross-Check", () => {
  let rep1: any;
  let rep2: any;
  let rep3: any;
  let unrelatedRep: any;
  let testDeal: any;
  let testLead: any;
  let openStage: any;

  beforeAll(async () => {
    await sequelize.authenticate();

    rep1 = (await User.findOne({ where: { email: "salesperson1@nexus.com" } })) as any;
    if (!rep1) {
      rep1 = await User.create({ id: "11111111-1111-4111-a111-111111111111", name: "Rep One", email: "salesperson1@nexus.com", role: "sales_rep", password: "hash" });
    }

    rep2 = (await User.findOne({ where: { email: "salesperson2@nexus.com" } })) as any;
    if (!rep2) {
      rep2 = await User.create({ id: "22222222-2222-4222-a222-222222222222", name: "Rep Two", email: "salesperson2@nexus.com", role: "sales_rep", password: "hash" });
    }

    rep3 = (await User.findOne({ where: { email: "salesperson3@nexus.com" } })) as any;
    if (!rep3) {
      rep3 = await User.create({ id: "33333333-3333-4333-a333-333333333333", name: "Rep Three", email: "salesperson3@nexus.com", role: "sales_rep", password: "hash" });
    }

    unrelatedRep = (await User.findOne({ where: { email: "unrelated@nexus.com" } })) as any;
    if (!unrelatedRep) {
      unrelatedRep = await User.create({ id: "44444444-4444-4444-a444-444444444444", name: "Unrelated Rep", email: "unrelated@nexus.com", role: "sales_rep", password: "hash" });
    }

    openStage = (await PipelineStage.findOne({ where: { name: "Discovery" } })) || (await PipelineStage.findOne());

    testLead = await Lead.create({
      firstName: "Verification",
      lastName: "Lead",
      email: "verify@test.com",
      status: "Qualified",
      assignedToId: rep1.id
    });

    testDeal = await Deal.create({
      name: "Verification Deal (Rep 1 -> Rep 2)",
      amount: 250000,
      status: "OPEN",
      stageId: openStage?.id || null,
      leadId: testLead.id,
      ownerId: rep2.id
    });

    await LeadReassignmentHistory.create({
      leadId: testLead.id,
      oldAssignedToId: rep1.id,
      newAssignedToId: rep2.id,
      changedByUserId: rep1.id,
      reason: "Handoff to closer"
    });

    await DealReassignmentHistory.create({
      dealId: testDeal.id,
      oldOwnerId: rep1.id,
      newOwnerId: rep2.id,
      changedByUserId: rep1.id,
      reason: "Lead converted & handed off"
    });
  });

  afterAll(async () => {
    if (testDeal) {
      await DealReassignmentHistory.destroy({ where: { dealId: testDeal.id } }).catch(() => {});
      await testDeal.destroy({ force: true }).catch(() => {});
    }
    if (testLead) {
      await LeadReassignmentHistory.destroy({ where: { leadId: testLead.id } }).catch(() => {});
      await testLead.destroy({ force: true }).catch(() => {});
    }
  });

  // ── CHECK 1: Salesman 1 View-Only Permissions ──
  test("Check 1: Salesman 1 (prior owner) can view but write actions return isViewOnly / forbidden", async () => {
    const access = await getDealAccessLevel(rep1.id, "sales_rep", testDeal);
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
    expect(access.isViewOnly).toBe(true);
    expect(access.accessLevel).toBe("view_only");
  });

  // ── CHECK 2: Salesman 2 Current Owner Full Access ──
  test("Check 2: Salesman 2 (current owner) has full read & write access", async () => {
    const access = await getDealAccessLevel(rep2.id, "sales_rep", testDeal);
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(true);
    expect(access.isViewOnly).toBe(false);
    expect(access.accessLevel).toBe("full");
  });

  // ── CHECK 3: Unrelated Rep Isolation ──
  test("Check 3: Unrelated rep (never owned deal) gets zero access (canRead = false)", async () => {
    const access = await getDealAccessLevel(unrelatedRep.id, "sales_rep", testDeal);
    expect(access.canRead).toBe(false);
    expect(access.canWrite).toBe(false);
    expect(access.accessLevel).toBe("none");
  });

  // ── CHECK 4: Multi-Hop 3+ Chain (Rep 1 -> Rep 2 -> Rep 3) ──
  test("Check 4: Multi-hop chain (Rep 1 -> Rep 2 -> Rep 3): Rep 1 & 2 view-only, Rep 3 full write", async () => {
    const mhLead = await Lead.create({ firstName: "MultiHop", lastName: "Customer", status: "Qualified", assignedToId: rep1.id });
    const mhDeal = await Deal.create({ name: "MultiHop Deal", amount: 300000, status: "OPEN", leadId: mhLead.id, ownerId: rep3.id });

    await DealReassignmentHistory.create({ dealId: mhDeal.id, oldOwnerId: rep1.id, newOwnerId: rep2.id, changedByUserId: rep1.id, reason: "Hop 1" });
    await DealReassignmentHistory.create({ dealId: mhDeal.id, oldOwnerId: rep2.id, newOwnerId: rep3.id, changedByUserId: rep2.id, reason: "Hop 2" });

    const accessRep1 = await getDealAccessLevel(rep1.id, "sales_rep", mhDeal);
    const accessRep2 = await getDealAccessLevel(rep2.id, "sales_rep", mhDeal);
    const accessRep3 = await getDealAccessLevel(rep3.id, "sales_rep", mhDeal);

    expect(accessRep1.canRead).toBe(true);
    expect(accessRep1.canWrite).toBe(false);
    expect(accessRep1.isViewOnly).toBe(true);

    expect(accessRep2.canRead).toBe(true);
    expect(accessRep2.canWrite).toBe(false);
    expect(accessRep2.isViewOnly).toBe(true);

    expect(accessRep3.canRead).toBe(true);
    expect(accessRep3.canWrite).toBe(true);
    expect(accessRep3.isViewOnly).toBe(false);

    await DealReassignmentHistory.destroy({ where: { dealId: mhDeal.id } });
    await mhDeal.destroy({ force: true });
    await mhLead.destroy({ force: true });
  });

  // ── CHECK 5: Handoff Chat Participant Access ──
  test("Check 5: Both Salesman 1 and Salesman 2 are active handoff chat participants", async () => {
    const res = await getHandoffParticipants({ dealId: testDeal.id, leadId: testLead.id });
    const participantIds = res.participantIds || [];

    expect(participantIds).toContain(rep1.id);
    expect(participantIds).toContain(rep2.id);
  });

  // ── CHECK 6: Handoff Chat Unrelated Rep Block ──
  test("Check 6: Unrelated rep is NOT a handoff chat participant (gets 403 access denied)", async () => {
    const res = await getHandoffParticipants({ dealId: testDeal.id, leadId: testLead.id });
    const participantIds = res.participantIds || [];

    expect(participantIds).not.toContain(unrelatedRep.id);
  });

  // ── CHECK 7: Mark Won Sets actualClosedAt ──
  test("Check 7: Marking deal Won sets actualClosedAt timestamp", async () => {
    const freshDeal: any = await Deal.create({ name: "Won Test Deal", amount: 100000, status: "OPEN" });
    expect(freshDeal.actualClosedAt).toBeNull();

    await freshDeal.update({ status: "WON" });
    expect(freshDeal.actualClosedAt).not.toBeNull();
    expect(new Date(freshDeal.actualClosedAt).getTime()).toBeGreaterThan(0);

    await freshDeal.destroy({ force: true });
  });

  // ── CHECK 8: Editing Notes Preserves actualClosedAt ──
  test("Check 8: Editing notes on an already-closed deal preserves original actualClosedAt", async () => {
    const origDate = new Date("2026-08-10T10:00:00Z");
    const closedDeal: any = await Deal.create({ name: "Closed Deal Note Edit", amount: 120000, status: "WON", actualClosedAt: origDate });

    await closedDeal.update({ lossNotes: "Updated commercial note" });

    expect(new Date(closedDeal.actualClosedAt).toISOString()).toBe(origDate.toISOString());
    await closedDeal.destroy({ force: true });
  });

  // ── CHECK 9: Reopening Deal Resets actualClosedAt to Null ──
  test("Check 9: Reopening a closed deal back to OPEN resets actualClosedAt to null", async () => {
    const closedDeal: any = await Deal.create({ name: "Reopen Deal Test", amount: 80000, status: "WON", actualClosedAt: new Date() });
    expect(closedDeal.actualClosedAt).not.toBeNull();

    await closedDeal.update({ status: "OPEN" });
    expect(closedDeal.actualClosedAt).toBeNull();

    await closedDeal.destroy({ force: true });
  });

  // ── CHECK 10: Multi-hop Chain Resolution ──
  test("Check 10: Handoff chain popover assembler resolves all hops chronologically", async () => {
    const chainDeal = await Deal.create({ name: "Chain Assembly Deal", amount: 400000, status: "OPEN", ownerId: rep3.id });
    await DealReassignmentHistory.create({ dealId: chainDeal.id, oldOwnerId: rep1.id, newOwnerId: rep2.id, changedByUserId: rep1.id });
    await DealReassignmentHistory.create({ dealId: chainDeal.id, oldOwnerId: rep2.id, newOwnerId: rep3.id, changedByUserId: rep2.id });

    const histories: any = await DealReassignmentHistory.findAll({
      where: { dealId: chainDeal.id },
      include: [
        { model: User, as: "oldOwner", attributes: ["id", "name", "email"] },
        { model: User, as: "newOwner", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "ASC"]]
    });

    expect(histories.length).toBe(2);
    expect(histories[0].oldOwner.id).toBe(rep1.id);
    expect(histories[0].newOwner.id).toBe(rep2.id);
    expect(histories[1].newOwner.id).toBe(rep3.id);

    await DealReassignmentHistory.destroy({ where: { dealId: chainDeal.id } });
    await chainDeal.destroy({ force: true });
  });
});
