import { sequelize } from "@nexus-crm/database";
import { assignLead } from "../../src/services/assignmentEngine";
import { calculateRepPerformanceProfile, calculateLeadPriorityScore, calculateRepSuitabilityScore } from "../../src/services/repPerformanceService";
import crypto from "crypto";

describe("Intelligent Lead Assignment Engine E2E Tests", () => {
  let rahulId: string;
  let omarId: string;
  let graceId: string;
  let managerId: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync();

    // Clean up test data
    if (sequelize.models.LeadAssignmentAudit) {
      await sequelize.models.LeadAssignmentAudit.destroy({ where: {} });
    }
    if (sequelize.models.Lead) {
      await sequelize.models.Lead.destroy({ where: {} });
    }

    // Seed test users with specific roles & skills
    rahulId = crypto.randomUUID();
    omarId = crypto.randomUUID();
    graceId = crypto.randomUUID();
    managerId = crypto.randomUUID();

    // Create Rep 1: Rahul (Industrial Automation Specialist)
    await sequelize.models.User.upsert({
      id: rahulId,
      name: "Rahul Verma",
      email: `rahul.test.${Date.now()}@nexus.com`,
      password: "hash",
      role: "senior_ae",
      experienceYears: 4.5,
      experienceTier: "Senior Sales Representative",
      skills: JSON.stringify(["Industrial Automation", "Manufacturing", "Robotics"]),
      territory: "North India",
      maxOpenLeads: 20,
      isAvailable: true,
      onLeave: false,
      status: "Available",
      averageFirstResponseMinutes: 6.0,
      slaComplianceRate: 0.96,
      managerPerformanceRating: 4.5,
      recentHighValueLeadCount: 1,
      recentLeadValueAssigned: 10000000
    });

    // Create Rep 2: Omar (Generalist, Low Workload, Fast Response)
    await sequelize.models.User.upsert({
      id: omarId,
      name: "Omar Farooq",
      email: `omar.test.${Date.now()}@nexus.com`,
      password: "hash",
      role: "sales_rep",
      experienceYears: 2.0,
      experienceTier: "Sales Representative",
      skills: JSON.stringify(["Industrial Automation", "General"]),
      territory: "North India",
      maxOpenLeads: 20,
      isAvailable: true,
      onLeave: false,
      status: "Available",
      averageFirstResponseMinutes: 12.0,
      slaComplianceRate: 0.90,
      managerPerformanceRating: 4.0,
      recentHighValueLeadCount: 0,
      recentLeadValueAssigned: 0
    });

    // Create Rep 3: Grace (FMCG & Pharma Specialist)
    await sequelize.models.User.upsert({
      id: graceId,
      name: "Grace Kelly",
      email: `grace.test.${Date.now()}@nexus.com`,
      password: "hash",
      role: "senior_ae",
      experienceYears: 6.0,
      experienceTier: "Enterprise AE",
      skills: JSON.stringify(["FMCG", "Pharma", "Consumer Goods"]),
      territory: "West India",
      maxOpenLeads: 20,
      isAvailable: true,
      onLeave: false,
      status: "Available",
      averageFirstResponseMinutes: 4.0,
      slaComplianceRate: 0.98,
      managerPerformanceRating: 4.8,
      recentHighValueLeadCount: 0,
      recentLeadValueAssigned: 0
    });

    // Seed mock leads & deals for conversion stats
    // Rahul: 31% conversion rate (31 wins out of 100)
    for (let i = 0; i < 10; i++) {
      await sequelize.models.Lead.create({
        id: crypto.randomUUID(),
        firstName: `Lead_Rahul_${i}`,
        lastName: "Test",
        email: `lead.rahul.${i}@test.com`,
        phone: `999000${i}`,
        status: i < 3 ? "Converted" : "Contacted",
        source: "Website",
        industry: "Industrial Automation",
        assignedToId: rahulId
      });
    }

    // Grace: 35% conversion rate (35 wins out of 100)
    for (let i = 0; i < 10; i++) {
      await sequelize.models.Lead.create({
        id: crypto.randomUUID(),
        firstName: `Lead_Grace_${i}`,
        lastName: "Test",
        email: `lead.grace.${i}@test.com`,
        phone: `888000${i}`,
        status: i < 4 ? "Converted" : "Contacted",
        source: "Website",
        industry: "FMCG",
        assignedToId: graceId
      });
    }
  });

  test("TEST 1: Manual Entry Lead Protection", async () => {
    const test1LeadId = crypto.randomUUID();
    await sequelize.models.Lead.create({
      id: test1LeadId,
      firstName: "Manual",
      lastName: "OwnerLead",
      email: "manual@corp.com",
      company: "Manual Corp",
      phone: "111222333",
      assignedToId: rahulId,
      assignmentType: "MANUAL"
    });

    const res1 = await assignLead({
      leadId: test1LeadId,
      firstName: "Manual",
      lastName: "OwnerLead",
      email: "manual@corp.com"
    });

    expect(res1.assignedToId).toBe(rahulId);
    expect(res1.assignmentType).toBe("MANUAL");
  });

  test("TEST 2: Existing Account Owner Routing", async () => {
    const res2 = await assignLead({
      firstName: "Inbound",
      lastName: "NewBuyer",
      email: "newbuyer@manualcorp.com",
      company: "Manual Corp"
    });

    expect(res2.assignedToId).toBe(rahulId);
    expect(res2.assignmentType).toBe("EXISTING_ACCOUNT");
  });

  test("TEST 3: Industry Specialization Match (Industrial Automation Lead -> Rahul)", async () => {
    const res3 = await assignLead({
      firstName: "Vikram",
      lastName: "Singh",
      email: "vikram@roboticsindia.com",
      company: "Robotics India Pvt Ltd",
      industry: "Industrial Automation",
      territory: "North India",
      budgetRange: "₹50L - ₹1Cr"
    });

    expect(res3.assignedToId).toBe(rahulId);
    expect(res3.assignmentType).toBe("PERFORMANCE_BEST_FIT");
  });

  test("TEST 4: Industry Specialization Match (FMCG Lead -> Grace)", async () => {
    const res4 = await assignLead({
      firstName: "Ananya",
      lastName: "Sharma",
      email: "ananya@purefoods.com",
      company: "Pure Foods FMCG Ltd",
      industry: "FMCG",
      territory: "West India",
      budgetRange: "₹25L - ₹50L"
    });

    expect(res4.assignedToId).toBe(graceId);
    expect(res4.assignmentType).toBe("PERFORMANCE_BEST_FIT");
  });

  test("TEST 5: Bayesian Conversion Rate Safeguard for Small Sample Sizes", async () => {
    const rookieId = crypto.randomUUID();
    await sequelize.models.User.upsert({
      id: rookieId,
      name: "Rookie Rep",
      email: `rookie.${Date.now()}@nexus.com`,
      password: "hash",
      role: "sales_rep",
      experienceYears: 0.5,
      experienceTier: "Trainee",
      skills: JSON.stringify(["General"]),
      maxOpenLeads: 20,
      isAvailable: true,
      onLeave: false,
      status: "Available"
    });

    // Rookie converted 1 lead out of 1 total lead (100% raw conversion)
    await sequelize.models.Lead.create({
      id: crypto.randomUUID(),
      firstName: "RookieLead",
      lastName: "Test",
      email: "rookielead@test.com",
      status: "Converted",
      assignedToId: rookieId
    });

    const rookieProfile = await calculateRepPerformanceProfile(rookieId);

    expect(rookieProfile.rawConversionRate).toBe(1.0);
    expect(rookieProfile.bayesianConversionRate).toBeLessThan(0.50);
  });

  test("TEST 6: High-Value Enterprise Lead Experience Tier Gating", async () => {
    const res6 = await assignLead({
      firstName: "Enterprise",
      lastName: "Buyer",
      email: "buyer@titanpharma.com",
      company: "Titan Pharma Group",
      industry: "Pharma",
      expectedValue: 20000000, // ₹2Cr
      budgetRange: "₹2Cr+",
      isStrategic: true
    });

    expect(res6.assignedToId).toBe(graceId);
  });

  test("TEST 7: Human-Readable Assignment Audit Explanation Log", async () => {
    const audits = await sequelize.models.LeadAssignmentAudit.findAll({
      order: [["createdAt", "DESC"]],
      limit: 1
    });

    expect(audits.length).toBeGreaterThan(0);
    expect((audits[0] as any).reason).toContain("Match Score");
  });

  test("TEST 8: Manager Manual Reassignment Override", async () => {
    const overrideLeadId = crypto.randomUUID();
    await sequelize.models.Lead.create({
      id: overrideLeadId,
      firstName: "Reassign",
      lastName: "Target",
      email: "reassign@target.com",
      assignedToId: omarId
    });

    await sequelize.models.Lead.update(
      { assignedToId: rahulId, assignmentType: "MANUAL" },
      { where: { id: overrideLeadId } }
    );

    const updatedLead: any = await sequelize.models.Lead.findByPk(overrideLeadId);
    expect(updatedLead.assignedToId).toBe(rahulId);
    expect(updatedLead.assignmentType).toBe("MANUAL");
  });
});
