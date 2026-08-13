import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

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
  leadScore?: number;
  isStrategic?: boolean;
  destinationEmail?: string;
  destinationPhone?: string;
  assignedChannelUserId?: string;
  isManualEntry?: boolean;
  createdById?: string;
  [key: string]: any;
}

export interface AssignmentResult {
  assignedToId: string | null;
  assignmentType: "AUTOMATIC" | "DIRECT" | "MANUAL" | "EXISTING_ACCOUNT";
}

/**
 * Enterprise 9-Step Lead Assignment Engine
 * 
 * 0. Reassignment Protection Check (MANUAL/DIRECT/EXISTING_ACCOUNT protected from automation theft)
 * 1. Dedicated Channel / Destination Ownership (Dedicated WhatsApp/Email wins)
 * 2. Existing Customer / Account Owner (General Company Channel -> Sarah)
 * 3. Existing Contact Owner (Phone / Email match)
 * 4. Existing Opportunity Owner (Deal match)
 * 5. Strategic / VIP Account AE
 * 6 & 7. Territory + Industry + Skill Candidate Scoring & Capacity Cap
 * 8. Persistent Database Weighted Round-Robin (Oldest lastAssignedAt in DB)
 * 9. Fallback to Manager / Unassigned Pool
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
      console.log(`[ASSIGNMENT STEP 0] Manual lead creation by sales rep: ${createdById}. Setting assignmentType = MANUAL.`);
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
        return { assignedToId: dedicatedOwnerId, assignmentType: "DIRECT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: EXISTING CUSTOMER / ACCOUNT OWNER
    // ─────────────────────────────────────────────────────────────
    let accountOwnerId: string | null = null;

    if (company) {
      const existingCustomer: any = await sequelize.models.Customer.findOne({
        where: { name: { [Op.like]: company } }
      });
      if (existingCustomer) {
        const linkedLead: any = await sequelize.models.Lead.findOne({
          where: { customerId: existingCustomer.id, assignedToId: { [Op.ne]: null } }
        });
        if (linkedLead && linkedLead.assignedToId) {
          accountOwnerId = linkedLead.assignedToId;
        }
      }

      if (!accountOwnerId) {
        const existingLeadComp: any = await sequelize.models.Lead.findOne({
          where: { company: { [Op.like]: company }, assignedToId: { [Op.ne]: null } }
        });
        if (existingLeadComp) accountOwnerId = existingLeadComp.assignedToId;
      }
    }

    if (accountOwnerId) {
      const isEligible = await checkRepEligibility(accountOwnerId);
      if (isEligible) {
        console.log(`[ASSIGNMENT STEP 2] Assigned to Existing Account Owner: ${accountOwnerId}`);
        await updateRepAssignedTimestamp(accountOwnerId);
        return { assignedToId: accountOwnerId, assignmentType: "EXISTING_ACCOUNT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: EXISTING CONTACT OWNER (PHONE / EMAIL MATCH)
    // ─────────────────────────────────────────────────────────────
    let contactOwnerId: string | null = null;
    if (email) {
      const contactLead: any = await sequelize.models.Lead.findOne({
        where: { email: { [Op.like]: email }, assignedToId: { [Op.ne]: null } }
      });
      if (contactLead) contactOwnerId = contactLead.assignedToId;
    }
    if (!contactOwnerId && phone) {
      const phoneLead: any = await sequelize.models.Lead.findOne({
        where: { phone, assignedToId: { [Op.ne]: null } }
      });
      if (phoneLead) contactOwnerId = phoneLead.assignedToId;
    }

    if (contactOwnerId) {
      const isEligible = await checkRepEligibility(contactOwnerId);
      if (isEligible) {
        console.log(`[ASSIGNMENT STEP 3] Assigned to Existing Contact Owner: ${contactOwnerId}`);
        await updateRepAssignedTimestamp(contactOwnerId);
        return { assignedToId: contactOwnerId, assignmentType: "EXISTING_ACCOUNT" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: EXISTING OPPORTUNITY OWNER
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
          return { assignedToId: deal.ownerId, assignmentType: "EXISTING_ACCOUNT" };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: NAMED / STRATEGIC ACCOUNT AE
    // ─────────────────────────────────────────────────────────────
    const isVipBudget = budgetRange && (budgetRange.includes("100") || budgetRange.includes("50") || budgetRange.includes("Enterprise"));
    if (isStrategic || isVipBudget || (leadScore >= 85 && budgetRange)) {
      const seniorAe: any = await sequelize.models.User.findOne({
        where: {
          role: { [Op.or]: ["admin", "sales_manager", "senior_ae"] },
          isAvailable: true
        }
      });
      if (seniorAe && (await checkRepEligibility(seniorAe.id))) {
        console.log(`[ASSIGNMENT STEP 5] Assigned to Strategic/VIP Account AE: ${seniorAe.name} (${seniorAe.id})`);
        await updateRepAssignedTimestamp(seniorAe.id);
        return { assignedToId: seniorAe.id, assignmentType: "AUTOMATIC" };
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEPS 6 & 7: RULE MATCHING, LAYER 1 ELIGIBILITY & LAYER 2 CANDIDATE SCORING
    // ─────────────────────────────────────────────────────────────
    const rules = await sequelize.models.AssignmentRule.findAll({
      where: { isActive: true },
      order: [["priority", "ASC"]],
      include: [{ model: sequelize.models.User, as: "assignTo" }]
    });

    for (const rule of rules) {
      const ruleData = rule.toJSON() as any;
      let isMatch = false;

      try {
        const criteria = JSON.parse(ruleData.criteria);
        if (Array.isArray(criteria)) {
          isMatch = criteria.every((c: any) => evaluateCriterion(c, leadContext));
        } else {
          isMatch = Object.keys(criteria).every(key => {
            const val = criteria[key];
            const contextVal = leadContext[key];
            if (typeof val === "string" && typeof contextVal === "string") {
              return contextVal.toLowerCase() === val.toLowerCase();
            }
            return contextVal === val;
          });
        }
      } catch (err) {
        console.error(`Invalid criteria format in rule ${ruleData.id}:`, err);
        continue;
      }

      if (!isMatch) continue;

      const targetUser = await sequelize.models.User.findByPk(ruleData.assignToId);
      const targetRole = targetUser ? (targetUser as any).role : "sales_rep";

      const allTeamUsers = await sequelize.models.User.findAll({
        where: { role: targetRole, isAvailable: true }
      });

      // Layer 1 Eligibility
      const eligibleCandidates = [];
      for (const u of allTeamUsers) {
        const userObj = u.toJSON() as any;
        if (await checkRepEligibility(userObj.id)) {
          eligibleCandidates.push(userObj);
        }
      }

      if (eligibleCandidates.length === 0) continue;

      // Layer 2 Best-Match Scoring
      const scoredCandidates = await Promise.all(
        eligibleCandidates.map(async (rep) => {
          let score = 0;

          // Territory Match (+30 pts)
          if (territory && rep.territory && rep.territory.toLowerCase().includes(territory.toLowerCase())) {
            score += 30;
          }

          // Skill / Industry Match (+30 pts)
          if (industry && rep.skills) {
            const skillsList = typeof rep.skills === "string" ? JSON.parse(rep.skills || "[]") : rep.skills;
            if (Array.isArray(skillsList) && skillsList.some((s: string) => s.toLowerCase().includes(industry.toLowerCase()))) {
              score += 30;
            }
          }

          // Workload Balance (+20 pts)
          const openLeadsCount = await getActiveLeadCount(rep.id);
          const maxLeads = rep.maxOpenLeads || 20;
          const capacityRatio = openLeadsCount / maxLeads;
          score += Math.round((1 - capacityRatio) * 20);

          // Weight (+10 pts)
          const repWeight = rep.weight || 100;
          score += Math.round(repWeight / 10);

          return { rep, score, openLeadsCount };
        })
      );

      scoredCandidates.sort((a, b) => b.score - a.score);
      const bestCandidate = scoredCandidates[0];

      // STEP 8: Persistent Database Weighted Round-Robin
      const topScore = bestCandidate.score;
      const topScorers = scoredCandidates.filter(c => c.score === topScore);

      let selectedRep = bestCandidate.rep;
      if (topScorers.length > 1 || ruleData.ruleType === "Round-robin") {
        topScorers.sort((a, b) => {
          const timeA = a.rep.lastAssignedAt ? new Date(a.rep.lastAssignedAt).getTime() : 0;
          const timeB = b.rep.lastAssignedAt ? new Date(b.rep.lastAssignedAt).getTime() : 0;
          return timeA - timeB;
        });
        selectedRep = topScorers[0].rep;
      }

      console.log(`[ASSIGNMENT STEPS 6-8] Lead assigned via Rule '${ruleData.id}' to Rep ${selectedRep.name} (${selectedRep.id}) [Score: ${bestCandidate.score}]`);

      await updateRepAssignedTimestamp(selectedRep.id);
      await rule.update({
        lastAssignedRepId: selectedRep.id,
        lastAssignedAt: new Date()
      });

      return { assignedToId: selectedRep.id, assignmentType: "AUTOMATIC" };
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 9: FALLBACK TO AVAILABLE MANAGER OR UNASSIGNED POOL
    // ─────────────────────────────────────────────────────────────
    const defaultManager: any = await sequelize.models.User.findOne({
      where: { role: { [Op.or]: ["admin", "sales_manager"] }, isAvailable: true }
    });

    if (defaultManager && (await checkRepEligibility(defaultManager.id))) {
      console.log(`[ASSIGNMENT STEP 9] Lead routed to Fallback Manager: ${defaultManager.name} (${defaultManager.id})`);
      await updateRepAssignedTimestamp(defaultManager.id);
      return { assignedToId: defaultManager.id, assignmentType: "AUTOMATIC" };
    }

    console.log("[ASSIGNMENT STEP 9] No eligible sales reps matched. Lead left as Unassigned.");
    return { assignedToId: null, assignmentType: "AUTOMATIC" };
  } catch (error) {
    console.error("Advanced 9-Step Lead Assignment Engine error:", error);
    return { assignedToId: null, assignmentType: "AUTOMATIC" };
  }
}

async function checkRepEligibility(userId: string): Promise<boolean> {
  const user: any = await sequelize.models.User.findByPk(userId);
  if (!user) return false;

  if (!user.isAvailable) return false;
  if (user.onLeave) return false;
  if (user.status === "On Leave" || user.status === "Offline") return false;

  const openCount = await getActiveLeadCount(userId);
  const maxLeads = user.maxOpenLeads || 20;

  return openCount < maxLeads;
}

async function getActiveLeadCount(userId: string): Promise<number> {
  return await sequelize.models.Lead.count({
    where: {
      assignedToId: userId,
      status: { [Op.in]: ["New", "Contacted", "Qualified"] }
    }
  });
}

async function updateRepAssignedTimestamp(userId: string): Promise<void> {
  const user = await sequelize.models.User.findByPk(userId);
  if (user) {
    await user.update({ lastAssignedAt: new Date() });
  }
}

function evaluateCriterion(c: any, leadContext: AssignmentContext): boolean {
  if (!c.field) return true;
  const contextVal = leadContext[c.field];
  const op = c.operator || "equals";
  const targetVal = c.value;

  if (contextVal === undefined || contextVal === null) return false;

  switch (op) {
    case "equals":
    case "=":
      return String(contextVal).trim().toLowerCase() === String(targetVal).trim().toLowerCase();
    case "greaterThan":
    case ">":
      return Number(contextVal) > Number(targetVal);
    case "lessThan":
    case "<":
      return Number(contextVal) < Number(targetVal);
    case "contains":
      return String(contextVal).toLowerCase().includes(String(targetVal).toLowerCase());
    case "in":
      if (Array.isArray(targetVal)) {
        return targetVal.map(v => String(v).toLowerCase()).includes(String(contextVal).toLowerCase());
      }
      return String(targetVal).toLowerCase().includes(String(contextVal).toLowerCase());
    default:
      return String(contextVal).toLowerCase() === String(targetVal).toLowerCase();
  }
}
