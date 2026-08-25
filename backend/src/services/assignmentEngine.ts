import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { createNotification } from "./notificationService";
import {
  calculateRepPerformanceProfile,
  calculateLeadPriorityScore,
  calculateRepSuitabilityScore,
  calculateOpportunityCloserScore,
  CandidateEvaluationResult,
  LeadPriorityDetails
} from "./repPerformanceService";

export interface AssignmentContext {
  leadId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  industry?: string;
  territory?: string;
  budgetRange?: string;
  expectedValue?: number;
  leadScore?: number;
  isStrategic?: boolean;
  destinationEmail?: string;
  destinationPhone?: string;
  assignedChannelUserId?: string;
  isManualEntry?: boolean;
  createdById?: string;
  urgency?: string;
  [key: string]: any;
}

export interface AssignmentResult {
  assignedToId: string | null;
  assignmentType: "AUTOMATIC" | "DIRECT" | "MANUAL" | "EXISTING_ACCOUNT" | "PERFORMANCE_BEST_FIT";
  auditId?: string;
}

/**
 * Intelligent Performance-Aware Lead Assignment Engine
 * 
 * Hierarchy:
 * 0. Manual Entry Protection & Reassignment Shield
 * 1. Dedicated Channel Ownership (Email/WhatsApp)
 * 2. Existing Customer / Account Owner
 * 3. Existing Contact Owner
 * 4. Existing Opportunity Owner
 * 5. Strategic / Named Account Routing
 * 6. Eligible Candidate Pool Filtering (Availability, Leave, Capacity Cap)
 * 7. Multi-Factor Rep Performance & Suitability Scoring (Conversion %, Win Rate, Revenue, Industry/Skill Match, Response Speed, SLA, Workload, Fairness)
 * 8. Audit Trail Logging & High-Value Lead SLA Escalation
 * 9. Fallback Manager / Unassigned Pool
 */
export async function assignLead(leadContext: AssignmentContext): Promise<AssignmentResult> {
  try {
    const {
      leadId, email, company, phone, industry, territory, budgetRange,
      leadScore = 50, isStrategic, destinationEmail, destinationPhone,
      assignedChannelUserId, isManualEntry, createdById
    } = leadContext;

    // ─────────────────────────────────────────────────────────────
    // STEP 0: MANUAL ENTRY & REASSIGNMENT PROTECTION CHECK
    // ─────────────────────────────────────────────────────────────
    if (isManualEntry && createdById) {
      console.log(`[ASSIGNMENT STEP 0] Manual lead creation by user: ${createdById}. Setting assignmentType = MANUAL.`);
      await logAssignmentAudit({
        leadId,
        previousOwnerId: null,
        assignedToId: createdById,
        assignmentType: "MANUAL",
        leadPriorityScore: 50,
        expectedRevenue: Number(leadContext.expectedValue || 0),
        candidateScores: [],
        winningScore: 100,
        reason: "Manual lead creation by sales representative. Ownership protected.",
        triggerSource: leadContext.source || "manual_entry"
      });
      return { assignedToId: createdById, assignmentType: "MANUAL" };
    }

    if (leadId) {
      const existingLead: any = await sequelize.models.Lead.findByPk(leadId);
      if (existingLead && existingLead.assignedToId) {
        const type = String(existingLead.assignmentType || existingLead.assignmentMethod || "").toUpperCase();
        if (type === "MANUAL" || type === "DIRECT" || type === "EXISTING_ACCOUNT") {
          console.log(`[ASSIGNMENT STEP 0] Lead ${leadId} is protected from reassignment (Type: ${type}). Preserving owner: ${existingLead.assignedToId}`);
          return {
            assignedToId: existingLead.assignedToId,
            assignmentType: type as any
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: DEDICATED CHANNEL / DESTINATION OWNERSHIP (CHANNEL OVERRIDE)
    // ─────────────────────────────────────────────────────────────
    let dedicatedOwnerId: string | null = assignedChannelUserId || null;

    if (!dedicatedOwnerId && destinationEmail) {
      const repByEmail: any = await sequelize.models.User.findOne({
        where: {
          [Op.or]: [
            { email: { [Op.like]: destinationEmail } },
            { emailAlias: { [Op.like]: destinationEmail } }
          ]
        }
      });
      if (repByEmail) dedicatedOwnerId = repByEmail.id;
    }

    if (dedicatedOwnerId) {
      const isEligible = await checkRepEligibility(dedicatedOwnerId);
      if (isEligible) {
        console.log(`[ASSIGNMENT STEP 1] Dedicated Channel Match! Assigned to channel owner: ${dedicatedOwnerId}`);
        await updateRepAssignedTimestamp(dedicatedOwnerId);
        await logAssignmentAudit({
          leadId,
          previousOwnerId: null,
          assignedToId: dedicatedOwnerId,
          assignmentType: "DIRECT",
          leadPriorityScore: 60,
          expectedRevenue: Number(leadContext.expectedValue || 0),
          candidateScores: [],
          winningScore: 100,
          reason: "Assigned via Dedicated Sales Representative Channel (Email / WhatsApp routing).",
          triggerSource: leadContext.source || "channel_direct"
        });
        return { assignedToId: dedicatedOwnerId, assignmentType: "DIRECT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: EXISTING CUSTOMER / ACCOUNT OWNER (AUTHORITATIVE)
    // ─────────────────────────────────────────────────────────────
    let accountOwnerId: string | null = null;

    if (company) {
      if (sequelize.models.Account) {
        const existingAccount: any = await sequelize.models.Account.findOne({
          where: { name: { [Op.like]: `%${company}%` } }
        });
        if (existingAccount && existingAccount.ownerId) {
          accountOwnerId = existingAccount.ownerId;
        }
      }
    }

    if (accountOwnerId) {
      const isEligible = await checkRepEligibility(accountOwnerId);
      if (isEligible) {
        console.log(`[ASSIGNMENT STEP 2] Assigned to Existing Account Owner: ${accountOwnerId}`);
        await updateRepAssignedTimestamp(accountOwnerId);
        await logAssignmentAudit({
          leadId,
          previousOwnerId: null,
          assignedToId: accountOwnerId,
          assignmentType: "EXISTING_ACCOUNT",
          leadPriorityScore: 70,
          expectedRevenue: Number(leadContext.expectedValue || 0),
          candidateScores: [],
          winningScore: 100,
          reason: `Authoritative ownership: Preserved existing Account owner (${company || 'Company Account'}).`,
          triggerSource: leadContext.source || "account_match"
        });
        return { assignedToId: accountOwnerId, assignmentType: "EXISTING_ACCOUNT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: EXISTING CONTACT OWNER (DIRECT CONTACT / RELATIONSHIP MATCH)
    // ─────────────────────────────────────────────────────────────
    let contactOwnerId: string | null = null;

    if (sequelize.models.Contact) {
      const contactWhere: any[] = [];
      if (email) contactWhere.push({ email: { [Op.like]: email } });
      if (phone) contactWhere.push({ phone });

      if (contactWhere.length > 0) {
        const existingContact: any = await sequelize.models.Contact.findOne({
          where: { [Op.or]: contactWhere },
          include: sequelize.models.Account ? [{ model: sequelize.models.Account, as: "account" }] : []
        });

        if (existingContact) {
          contactOwnerId = existingContact.ownerId || existingContact.account?.ownerId || null;
        }
      }
    }

    if (!contactOwnerId && (email || phone)) {
      const leadMatchWhere: any[] = [];
      if (email) leadMatchWhere.push({ email: { [Op.like]: email } });
      if (phone) leadMatchWhere.push({ phone });

      const pastLead: any = await sequelize.models.Lead.findOne({
        where: { [Op.or]: leadMatchWhere, assignedToId: { [Op.ne]: null } }
      });
      if (pastLead) contactOwnerId = pastLead.assignedToId;
    }

    if (contactOwnerId) {
      const isEligible = await checkRepEligibility(contactOwnerId);
      if (isEligible) {
        console.log(`[ASSIGNMENT STEP 3] Assigned to Existing Contact Owner: ${contactOwnerId}`);
        await updateRepAssignedTimestamp(contactOwnerId);
        await logAssignmentAudit({
          leadId,
          previousOwnerId: null,
          assignedToId: contactOwnerId,
          assignmentType: "EXISTING_ACCOUNT",
          leadPriorityScore: 70,
          expectedRevenue: Number(leadContext.expectedValue || 0),
          candidateScores: [],
          winningScore: 100,
          reason: `Preserved existing contact relationship (${email || phone}).`,
          triggerSource: leadContext.source || "contact_match"
        });
        return { assignedToId: contactOwnerId, assignmentType: "EXISTING_ACCOUNT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: EXISTING OPEN OPPORTUNITY OWNER
    // ─────────────────────────────────────────────────────────────
    if (email || company) {
      const leadConditions: any[] = [];
      if (email) leadConditions.push({ email: { [Op.like]: email } });
      if (company) leadConditions.push({ company: { [Op.like]: company } });

      const deal: any = await sequelize.models.Deal.findOne({
        include: [{
          model: sequelize.models.Lead,
          as: "lead",
          where: { [Op.or]: leadConditions }
        }]
      });
      if (deal && deal.ownerId) {
        const isEligible = await checkRepEligibility(deal.ownerId);
        if (isEligible) {
          console.log(`[ASSIGNMENT STEP 4] Assigned to Opportunity Owner: ${deal.ownerId}`);
          await updateRepAssignedTimestamp(deal.ownerId);
          await logAssignmentAudit({
            leadId,
            previousOwnerId: null,
            assignedToId: deal.ownerId,
            assignmentType: "EXISTING_ACCOUNT",
            leadPriorityScore: 80,
            expectedRevenue: Number(deal.amount || 0),
            candidateScores: [],
            winningScore: 100,
            reason: `Preserved active opportunity ownership (Opportunity #${deal.id.substring(0,8)}).`,
            triggerSource: leadContext.source || "opportunity_match"
          });
          return { assignedToId: deal.ownerId, assignmentType: "EXISTING_ACCOUNT" };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEPS 6-8: INTELLIGENT PERFORMANCE-AWARE SUITABILITY SCORING
    // ─────────────────────────────────────────────────────────────
    // 1. Calculate Lead Priority & Expected Value
    const priorityDetails: LeadPriorityDetails = calculateLeadPriorityScore(leadContext);
    console.log(`[ASSIGNMENT ENGINE] ${priorityDetails.reasonSummary}`);

    // 2. Load Assignment Policy Settings
    let policy: any = null;
    try {
      if (sequelize.models.SalesAssignmentPolicy) {
        policy = await sequelize.models.SalesAssignmentPolicy.findOne({
          order: [["createdAt", "DESC"]]
        });
      }
    } catch (err) {
      policy = null;
    }

    if (!policy) {
      policy = {
        weights: JSON.stringify({
          conversionRate: 0.20,
          industrySkill: 0.20,
          territoryMatch: 0.10,
          revenuePerformance: 0.10,
          experienceTier: 0.10,
          responseTime: 0.05,
          slaCompliance: 0.05,
          workloadCapacity: 0.10,
          fairnessDistribution: 0.05,
          managerRating: 0.05
        }),
        highValueExperienceTiers: JSON.stringify(["Senior Sales Representative", "Enterprise AE", "Strategic AE", "senior_ae", "manager"])
      };
    }

    const policyWeights = typeof policy.weights === "string" ? JSON.parse(policy.weights) : policy.weights;
    const allowedTiers = typeof policy.highValueExperienceTiers === "string" 
      ? JSON.parse(policy.highValueExperienceTiers) 
      : policy.highValueExperienceTiers;

    // 3. Fetch All Sales Reps
    const allReps: any[] = await sequelize.models.User.findAll({
      where: {
        role: { [Op.ne]: "admin" }
      }
    });

    // 4. Build Eligible Candidate Pool concurrently
    const eligibilityResults = await Promise.all(
      allReps.map(async (r) => ({
        rep: r,
        isEligible: await checkRepEligibility(r.id)
      }))
    );
    let eligibleReps = eligibilityResults.filter(item => item.isEligible).map(item => item.rep);

    // High-Value Experience Tier Gating (If high value lead & senior reps exist)
    if (priorityDetails.isHighValueLead && Array.isArray(allowedTiers) && allowedTiers.length > 0) {
      const seniorEligible = eligibleReps.filter(r => 
        allowedTiers.includes(r.experienceTier) || allowedTiers.includes(r.role)
      );
      if (seniorEligible.length > 0) {
        console.log(`[ASSIGNMENT HIGH-VALUE GATE] Gated ${eligibleReps.length} reps down to ${seniorEligible.length} Senior/Enterprise AEs for High-Value Lead.`);
        eligibleReps = seniorEligible;
      }
    }

    if (eligibleReps.length === 0) {
      console.log("[ASSIGNMENT ENGINE] No eligible sales reps available under capacity cap. Falling back to Manager pool.");
      return await fallbackToManager(leadContext, priorityDetails);
    }

    // 5. Calculate Performance Profile & Multi-Factor Suitability Score for Candidates concurrently
    const candidateEvaluations = await scoreAndRankCandidates(
      eligibleReps,
      leadContext,
      priorityDetails,
      policyWeights
    );

    const winningCandidate = candidateEvaluations[0];

    console.log(`[ASSIGNMENT ENGINE] WINNING CANDIDATE: ${winningCandidate.repName} (${winningCandidate.repRole}) with Score ${winningCandidate.finalScore}/100`);

    // 6. Update Winner Stats
    await updateRepAssignedTimestamp(winningCandidate.repId);

    if (priorityDetails.isHighValueLead) {
      const winnerModel: any = await sequelize.models.User.findByPk(winningCandidate.repId);
      if (winnerModel) {
        await winnerModel.update({
          recentHighValueLeadCount: Number(winnerModel.recentHighValueLeadCount || 0) + 1,
          recentLeadValueAssigned: Number(winnerModel.recentLeadValueAssigned || 0) + priorityDetails.expectedRevenue
        });
      }

      // Notify Team Lead & Admin for High-Value Lead Assignment
      const managers = await sequelize.models.User.findAll({
        where: { role: { [Op.or]: ["manager", "admin"] } }
      });
      for (const mgr of managers) {
        await createNotification(
          (mgr as any).id,
          "system",
          `High-Value Lead Assigned (₹${(priorityDetails.expectedRevenue / 100000).toFixed(1)}L)`,
          `Intelligent Assignment Engine assigned high-value lead ${leadContext.firstName} ${leadContext.lastName} (${leadContext.company || 'Enterprise Prospect'}) to ${winningCandidate.repName} (Score: ${winningCandidate.finalScore}/100).`,
          leadId ? `/leads/${leadId}` : "/sales/queue"
        );
      }
    }

    // 7. Save Audit Explanation Log
    const auditRecord = await logAssignmentAudit({
      leadId: leadId || null,
      previousOwnerId: null,
      assignedToId: winningCandidate.repId,
      assignmentType: "PERFORMANCE_BEST_FIT",
      leadPriorityScore: priorityDetails.priorityScore,
      expectedRevenue: priorityDetails.expectedRevenue,
      candidateScores: candidateEvaluations,
      winningScore: winningCandidate.finalScore,
      reason: `Assigned to ${winningCandidate.repName} (${winningCandidate.experienceTier}): ${winningCandidate.explanationText}`,
      triggerSource: leadContext.source || "inbound_web"
    });

    return {
      assignedToId: winningCandidate.repId,
      assignmentType: "PERFORMANCE_BEST_FIT",
      auditId: auditRecord?.id
    };
  } catch (error) {
    console.error("Performance-Aware Lead Assignment Engine error:", error);
    return { assignedToId: null, assignmentType: "AUTOMATIC" };
  }
}

async function fallbackToManager(leadContext: AssignmentContext, priorityDetails: LeadPriorityDetails): Promise<AssignmentResult> {
  const defaultManager: any = await sequelize.models.User.findOne({
    where: { role: { [Op.or]: ["admin", "manager"] }, isAvailable: true }
  });

  if (defaultManager && (await checkRepEligibility(defaultManager.id))) {
    console.log(`[ASSIGNMENT FALLBACK] Lead routed to Manager: ${defaultManager.name} (${defaultManager.id})`);
    await updateRepAssignedTimestamp(defaultManager.id);
    await logAssignmentAudit({
      leadId: leadContext.leadId || null,
      previousOwnerId: null,
      assignedToId: defaultManager.id,
      assignmentType: "AUTOMATIC",
      leadPriorityScore: priorityDetails.priorityScore,
      expectedRevenue: priorityDetails.expectedRevenue,
      candidateScores: [],
      winningScore: 50,
      reason: `Routed to Manager (${defaultManager.name}) because no sales reps were available under capacity limits.`,
      triggerSource: leadContext.source || "manager_fallback"
    });
    return { assignedToId: defaultManager.id, assignmentType: "AUTOMATIC" };
  }

  console.log("[ASSIGNMENT FALLBACK] No available reps or managers. Lead left as Unassigned.");
  return { assignedToId: null, assignmentType: "AUTOMATIC" };
}

async function checkRepEligibility(userId: string): Promise<boolean> {
  const user: any = await sequelize.models.User.findByPk(userId);
  if (!user) return false;

  if (!user.isAvailable) return false;
  if (user.onLeave) return false;
  if (user.status === "On Leave" || user.status === "Offline" || user.status === "Suspended") return false;

  const openCount = await sequelize.models.Lead.count({
    where: {
      assignedToId: userId,
      status: { [Op.notIn]: ["Converted", "Lost", "Disqualified"] }
    }
  });

  const maxLeads = user.maxOpenLeads || 20;
  return openCount < maxLeads;
}

async function updateRepAssignedTimestamp(userId: string): Promise<void> {
  try {
    if (sequelize.models.User) {
      await sequelize.models.User.update(
        { lastAssignedAt: new Date() },
        { where: { id: userId } }
      );
    }
  } catch (e) {
    // non-fatal timestamp update error
  }
}

async function logAssignmentAudit(data: any): Promise<any> {
  try {
    if (!sequelize.models.LeadAssignmentAudit) return null;
    return await sequelize.models.LeadAssignmentAudit.create({
      id: require("crypto").randomUUID(),
      leadId: data.leadId || null,
      previousOwnerId: data.previousOwnerId || null,
      assignedToId: data.assignedToId,
      assignmentType: data.assignmentType,
      leadPriorityScore: data.leadPriorityScore || 50,
      expectedRevenue: data.expectedRevenue || 0,
      candidateScores: JSON.stringify(data.candidateScores || []),
      winningScore: data.winningScore || 0,
      reason: data.reason || "Automated lead assignment",
      triggerSource: data.triggerSource || "automated",
      createdAt: new Date()
    });
  } catch (err) {
    console.error("Failed to log lead assignment audit:", err);
    return null;
  }
}

/**

 * Reusable experience-weighted scoring and ranking for candidate sales reps.
 */
export async function scoreAndRankCandidates(
  candidates: any[],
  leadContext: AssignmentContext,
  priorityDetails: LeadPriorityDetails,
  policyWeights: any
): Promise<CandidateEvaluationResult[]> {
  const evaluations: CandidateEvaluationResult[] = await Promise.all(
    candidates.map(async (rep) => {
      const profile = await calculateRepPerformanceProfile(rep.id);
      return calculateRepSuitabilityScore(profile, leadContext, policyWeights, priorityDetails);
    })
  );
  evaluations.sort((a, b) => b.finalScore - a.finalScore);
  return evaluations;
}

/**
 * Legacy compatibility alias for Opportunity closer routing
 */
export async function assignDeal(dealContext: AssignmentContext): Promise<string | null> {
  const res = await assignOpportunityCloser(dealContext);
  return res.closerId;
}

/**
 * Opportunity Assignment Engine (Closer / Deal Owner Routing)
 */
export async function assignOpportunityCloser(
  context: AssignmentContext,
  options?: { excludeRepId?: string; fallbackAction?: "keep_lead_rep" | "assign_team_lead" | "assign_manager" | "unassigned_pool" }
): Promise<{ assigned: boolean; closerId: string | null; assignee?: CandidateEvaluationResult; reason?: string; fallbackApplied?: boolean }> {

  try {
    const { WorkspaceSetting, SalesAssignmentPolicy, User } = sequelize.models;

    // 1. Resolve closer tiers
    let closingTiers: string[] = ["senior_ae", "senior sales representative", "enterprise ae", "strategic ae", "closer", "senior ae", "manager", "sales_rep", "sales representative"];
    
    try {
      if (WorkspaceSetting) {
        const setting: any = await WorkspaceSetting.findOne({ where: { key: "closing_tier_names" } });
        if (setting && setting.value) {
          const raw = String(setting.value).trim();
          if (raw.startsWith("[") && raw.endsWith("]")) {
            closingTiers = JSON.parse(raw).map((s: string) => String(s).toLowerCase().trim());
          } else {
            closingTiers = raw.split(",").map((s) => s.toLowerCase().trim()).filter(Boolean);
          }
        }
      }
    } catch (e) {
      // fallback to default
    }

    // 2. Load Opportunity Assignment Policy Weights & Fallback Action
    let policy: any = null;
    try {
      if (SalesAssignmentPolicy) {
        policy = await SalesAssignmentPolicy.findOne({ order: [["createdAt", "DESC"]] });
      }
    } catch (err) {
      policy = null;
    }

    // Parse Opportunity-specific weights
    let oppPolicyWeights = {
      opportunityWinRate: 0.25,
      averageDealSize: 0.15,
      revenueWon: 0.15,
      industrySpecialization: 0.15,
      experienceTier: 0.10,
      territoryMatch: 0.10,
      workloadCapacity: 0.05,
      fairnessDistribution: 0.05
    };

    if (policy?.opportunityWeights) {
      try {
        oppPolicyWeights = typeof policy.opportunityWeights === "string" 
          ? JSON.parse(policy.opportunityWeights) 
          : policy.opportunityWeights;
      } catch (err) {}
    } else if (policy?.weights) {
      try {
        const parsed = typeof policy.weights === "string" ? JSON.parse(policy.weights) : policy.weights;
        if (parsed.opportunityWinRate !== undefined) {
          oppPolicyWeights = { ...oppPolicyWeights, ...parsed };
        }
      } catch (err) {}
    }

    const fallbackAction = options?.fallbackAction 
      || policy?.fallbackCloserAction 
      || "keep_lead_rep";

    const priorityDetails: LeadPriorityDetails = calculateLeadPriorityScore(context);
    const expectedVal = Number(context.expectedValue || priorityDetails.expectedRevenue || 0);

    // 3. Fetch candidate users (all non-admin reps)
    const allUsers: any[] = await User.findAll({
      where: {
        role: { [Op.ne]: "admin" }
      }
    });

    // 4. Filter to designated closer-tier candidates (or all sales reps if tier list is general)
    let closerCandidates = allUsers.filter((u: any) => {
      const roleStr = String(u.role || "").toLowerCase().trim();
      const tierStr = String(u.experienceTier || "").toLowerCase().trim();
      return closingTiers.includes(roleStr) || closingTiers.includes(tierStr);
    });

    if (closerCandidates.length === 0) {
      closerCandidates = allUsers;
    }

    // 5. Exclude qualifying rep if a distinct closer is requested
    let candidatePool = closerCandidates;
    if (options?.excludeRepId) {
      const distinct = closerCandidates.filter((u: any) => u.id !== options.excludeRepId);
      if (distinct.length > 0) {
        candidatePool = distinct;
      }
    }

    // 6. Check eligibility and capacity for closers
    const { getOpenDealsCount } = require("./dealAssignmentEngine");
    const eligibleCloserCandidates: any[] = [];
    for (const rep of candidatePool) {
      if (rep.isAvailable === false) continue;
      if (rep.onLeave) continue;
      if (rep.status === "On Leave" || rep.status === "Offline" || rep.status === "Suspended") continue;

      // Open deals capacity check
      if (rep.maxOpenDeals !== null && rep.maxOpenDeals !== undefined) {
        const openDeals = await getOpenDealsCount(rep.id);
        if (openDeals >= Number(rep.maxOpenDeals)) continue;
      }

      eligibleCloserCandidates.push(rep);
    }

    // 7. Handle Fallback if no distinct closer candidate matches
    if (eligibleCloserCandidates.length === 0) {
      console.log(`[assignOpportunityCloser] No eligible distinct closer-tier rep found. Executing fallback policy: ${fallbackAction}`);

      if (fallbackAction === "keep_lead_rep" && options?.excludeRepId) {
        const leadRep: any = await User.findByPk(options.excludeRepId);
        if (leadRep) {
          return {
            assigned: true,
            closerId: leadRep.id,
            fallbackApplied: true,
            reason: `Fallback Policy: Retained qualifying representative (${leadRep.name}) as Opportunity Owner.`
          };
        }
      } else if (fallbackAction === "assign_team_lead" || fallbackAction === "assign_manager") {
        const manager: any = await User.findOne({
          where: { role: { [Op.in]: ["manager", "team_lead"] }, isAvailable: true }
        });
        if (manager) {
          return {
            assigned: true,
            closerId: manager.id,
            fallbackApplied: true,
            reason: `Fallback Policy: Routed to ${manager.name} (${manager.role}) for assignment review.`
          };
        }
      }

      return {
        assigned: false,
        closerId: null,
        fallbackApplied: true,
        reason: "No eligible closer-tier rep available under capacity/cutoff constraints."
      };
    }

    // 8. Score and rank candidates using dedicated Opportunity closer evaluation
    const profiles = await Promise.all(
      eligibleCloserCandidates.map(r => calculateRepPerformanceProfile(r.id))
    );

    const candidateEvaluations = profiles.map(profile =>
      calculateOpportunityCloserScore(profile, context, oppPolicyWeights, priorityDetails)
    );

    candidateEvaluations.sort((a, b) => b.finalScore - a.finalScore);
    const winner = candidateEvaluations[0];

    await updateRepAssignedTimestamp(winner.repId);

    console.log(
      `[assignOpportunityCloser] Winner: ${winner.repName} (${winner.repRole} / ${winner.experienceTier}) with Score ${winner.finalScore}/100.`
    );

    return {
      assigned: true,
      closerId: winner.repId,
      assignee: winner,
      reason: `Assigned via Opportunity Policy to closer ${winner.repName} (${winner.experienceTier || winner.repRole}) with score ${winner.finalScore}/100.`
    };
  } catch (error: any) {
    console.error("[assignOpportunityCloser] Error:", error);
    return {
      assigned: false,
      closerId: null,
      reason: error?.message || "Error during closer assignment pass"
    };
  }
}

