import { sequelize } from "@nexus-crm/database";
import { getLeadAccessLevel, getDealAccessLevel } from "../../src/services/handoffAccessService";
import { reassignLead } from "../../src/controllers/leadController";
import crypto from "crypto";

describe("Lead -> Deal Handoff Permissions & Data Visibility E2E Test", () => {
  let rep1: any;
  let rep2: any;
  let admin: any;
  let testLead: any;
  let testDeal: any;
  let initialActivity: any;

  beforeAll(async () => {
    // Create test users using sequelize.models
    const { User, Lead, Deal, Activity } = sequelize.models;

    const uid1 = require("crypto").randomUUID();
    const uid2 = require("crypto").randomUUID();
    const uid3 = require("crypto").randomUUID();

    rep1 = await User.create({
      id: uid1,
      name: "Sales Rep 1 (Prior Owner)",
      email: `rep1_${Date.now()}@example.com`,
      password: "hashedpassword",
      role: "sales_rep"
    });

    rep2 = await User.create({
      id: uid2,
      name: "Sales Rep 2 (Current Owner)",
      email: `rep2_${Date.now()}@example.com`,
      password: "hashedpassword",
      role: "sales_rep"
    });

    admin = await User.create({
      id: uid3,
      name: "Sales Manager Admin",
      email: `admin_${Date.now()}@example.com`,
      password: "hashedpassword",
      role: "admin"
    });

    // Create Lead assigned to Rep 1
    testLead = await Lead.create({
      id: crypto.randomUUID(),
      firstName: "Handoff",
      lastName: "Prospect",
      email: `handoff_${Date.now()}@example.com`,
      phone: "+966500009999",
      company: "Acme Handoff Corp",
      status: "Discovery",
      assignedToId: rep1.id
    });

    // Create Deal owned by Rep 1
    testDeal = await Deal.create({
      id: crypto.randomUUID(),
      name: "Acme Enterprise Software",
      amount: 150000.0,
      stageId: "Discovery",
      leadId: testLead.id,
      ownerId: rep1.id
    });

    // Create initial Activity logged by Rep 1
    initialActivity = await Activity.create({
      id: crypto.randomUUID(),
      leadId: testLead.id,
      dealId: testDeal.id,
      type: "call",
      notes: "Initial discovery call conducted by Rep 1",
      createdById: rep1.id
    });
  });

  afterAll(async () => {
    const { User, Lead, Deal, Activity, LeadReassignmentHistory } = sequelize.models;
    if (initialActivity) await Activity.destroy({ where: { id: initialActivity.id } });
    if (testDeal) await Deal.destroy({ where: { id: testDeal.id } });
    if (testLead) {
      if (LeadReassignmentHistory) await LeadReassignmentHistory.destroy({ where: { leadId: testLead.id } });
      await Lead.destroy({ where: { id: testLead.id } });
    }
    if (rep1) await User.destroy({ where: { id: rep1.id } });
    if (rep2) await User.destroy({ where: { id: rep2.id } });
    if (admin) await User.destroy({ where: { id: admin.id } });
  });

  test("Phase 1: Rep 1 is current owner and has full read/write access", async () => {
    const leadAccess = await getLeadAccessLevel(rep1.id, rep1.role, testLead);
    expect(leadAccess.canRead).toBe(true);
    expect(leadAccess.canWrite).toBe(true);
    expect(leadAccess.isViewOnly).toBe(false);

    const dealAccess = await getDealAccessLevel(rep1.id, rep1.role, testDeal);
    expect(dealAccess.canRead).toBe(true);
    expect(dealAccess.canWrite).toBe(true);
    expect(dealAccess.isViewOnly).toBe(false);
  });

  test("Phase 2: Handoff lead to Rep 2 & verify access model update", async () => {
    // Reassign lead to Rep 2
    const req: any = {
      params: { id: testLead.id },
      body: { newAssignedToId: rep2.id, reason: "Account reassignment to Rep 2" },
      user: admin
    };
    const res: any = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    await reassignLead(req, res);
    expect(res.json).toHaveBeenCalled();

    // Refresh Lead & Deal
    await testLead.reload();
    await testDeal.update({ ownerId: rep2.id });

    // Rep 1 (Prior Owner) access evaluation
    const rep1LeadAccess = await getLeadAccessLevel(rep1.id, rep1.role, testLead);
    expect(rep1LeadAccess.canRead).toBe(true);
    expect(rep1LeadAccess.canWrite).toBe(false);
    expect(rep1LeadAccess.isViewOnly).toBe(true);
    expect(rep1LeadAccess.reason).toContain("Handed off — view only");

    const rep1DealAccess = await getDealAccessLevel(rep1.id, rep1.role, testDeal);
    expect(rep1DealAccess.canRead).toBe(true);
    expect(rep1DealAccess.canWrite).toBe(false);
    expect(rep1DealAccess.isViewOnly).toBe(true);

    // Rep 2 (Current Owner) access evaluation
    const rep2LeadAccess = await getLeadAccessLevel(rep2.id, rep2.role, testLead);
    expect(rep2LeadAccess.canRead).toBe(true);
    expect(rep2LeadAccess.canWrite).toBe(true);
    expect(rep2LeadAccess.isViewOnly).toBe(false);

    // Admin access evaluation
    const adminAccess = await getLeadAccessLevel(admin.id, admin.role, testLead);
    expect(adminAccess.canRead).toBe(true);
    expect(adminAccess.canWrite).toBe(true);
    expect(adminAccess.isViewOnly).toBe(false);
  });

  test("Phase 3: Data retention & authorship preservation check", async () => {
    const { Activity } = sequelize.models;
    // Verify historical activity retains createdById = rep1
    const fetchedActivity: any = await Activity.findByPk(initialActivity.id);
    expect(fetchedActivity.createdById).toBe(rep1.id);

    // Log a new activity by Rep 2 (Current Owner)
    const newActivity: any = await Activity.create({
      id: crypto.randomUUID(),
      leadId: testLead.id,
      dealId: testDeal.id,
      type: "note",
      notes: "Follow up note by Rep 2 after handoff",
      createdById: rep2.id
    });

    expect(newActivity.createdById).toBe(rep2.id);

    // Verify all activities for lead are visible to Rep 1 and Rep 2
    const allActivities = await Activity.findAll({ where: { leadId: testLead.id }, order: [["createdAt", "ASC"]] });
    expect(allActivities.length).toBeGreaterThanOrEqual(2);
    expect((allActivities[0] as any).createdById).toBe(rep1.id);
    expect((allActivities[1] as any).createdById).toBe(rep2.id);

    // Cleanup new activity
    await Activity.destroy({ where: { id: newActivity.id } });
  });
});
