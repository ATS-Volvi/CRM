import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { isWonStage, isClosedStage } from "../utils/pipelineStageHelpers";

export interface RepPerformanceProfile {
  userId: string;
  name: string;
  email: string;
  role: string;
  experienceYears: number;
  experienceTier: string;
  skills: string[];
  territory: string | null;
  maxOpenLeads: number;
  openLeadCount: number;
  openOpportunityCount: number;
  openPipelineValue: number;
  weightedWorkload: number;
  totalLeadsAssigned: number;
  convertedLeads: number;
  rawConversionRate: number; // e.g. 0.31
  bayesianConversionRate: number; // e.g. 0.302
  totalDeals: number;
  wonDeals: number;
  opportunityWinRate: number; // e.g. 0.27
  totalRevenueWon: number;
  totalAssignedPipeline: number;
  revenueConversionRate: number;
  averageDealSize: number;
  averageFirstResponseMinutes: number;
  slaComplianceRate: number;
  managerPerformanceRating: number;
  recentHighValueLeadCount: number;
  recentLeadValueAssigned: number;
  performanceScore: number; // Overall 0-100 rep quality metric
}

export interface FactorBreakdown {
  conversionScore: number;
  industrySkillScore: number;
  territoryScore: number;
  revenuePerformanceScore: number;
  experienceTierScore: number;
  responseScore: number;
  slaComplianceScore: number;
  workloadScore: number;
  fairnessScore: number;
  managerRatingScore: number;
}

export interface CandidateEvaluationResult {
  repId: string;
  repName: string;
  repRole: string;
  experienceTier: string;
  finalScore: number;
  breakdown: FactorBreakdown;
  explanationText: string;
}

export interface LeadPriorityDetails {
  priorityScore: number; // 0-100
  expectedRevenue: number;
  isHighValueLead: boolean;
  priorityTier: "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";
  reasonSummary: string;
}

/**
 * Calculates empirical Rep Performance Profile with Bayesian smoothing
 */
export async function calculateRepPerformanceProfile(userId: string): Promise<RepPerformanceProfile> {
  const user: any = await sequelize.models.User.findByPk(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const skillsList = user.skills
    ? (typeof user.skills === "string" ? JSON.parse(user.skills || "[]") : user.skills)
    : [];

  // 1. Fetch Lead Conversion Metrics
  const totalLeadsAssigned = await sequelize.models.Lead.count({
    where: { assignedToId: userId }
  });

  const convertedLeads = await sequelize.models.Lead.count({
    where: {
      assignedToId: userId,
      [Op.or]: [
        { status: "Converted" },
        { customerId: { [Op.ne]: null } }
      ]
    }
  });

  const rawConversionRate = totalLeadsAssigned > 0 ? convertedLeads / totalLeadsAssigned : 0;

  // Bayesian Smoothing (m-estimate prior: prior = 25%, weight = 3)
  const priorRate = 0.25;
  const priorWeight = 3;
  const bayesianConversionRate = (convertedLeads + (priorRate * priorWeight)) / (totalLeadsAssigned + priorWeight);

  // 2. Fetch Deal Win Metrics
  let deals: any[] = [];
  try {
    if (sequelize.models.Deal) {
      deals = await sequelize.models.Deal.findAll({
        where: { ownerId: userId },
        include: [{ model: sequelize.models.PipelineStage, as: "stage", attributes: ["id", "name"] }]
      });
    }
  } catch (err) {
    deals = [];
  }

  const totalDeals = deals.length;
  const wonDeals = deals.filter(d => isWonStage(d.stage?.name)).length;
  const opportunityWinRate = totalDeals > 0 ? (wonDeals + (0.20 * 2)) / (totalDeals + 2) : 0.20;

  const totalRevenueWon = deals
    .filter(d => isWonStage(d.stage?.name))
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const totalAssignedPipeline = deals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const revenueConversionRate = totalAssignedPipeline > 0 ? totalRevenueWon / totalAssignedPipeline : 0;
  const averageDealSize = wonDeals > 0 ? totalRevenueWon / wonDeals : 0;

  // 3. Workload Metrics
  const openLeadCount = await sequelize.models.Lead.count({
    where: {
      assignedToId: userId,
      status: { [Op.notIn]: ["Converted", "Lost", "Disqualified"] }
    }
  });

  const activeDeals = deals.filter(d => !isClosedStage(d.stage?.name));
  const openOpportunityCount = activeDeals.length;
  const openPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const maxLeads = Number(user.maxOpenLeads || 20);

  // Weighted Workload formula
  const weightedWorkload = (openLeadCount * 1.0) + (openOpportunityCount * 2.5) + ((openPipelineValue / 1000000) * 0.5);

  // Overall Performance Quality Score (0-100)
  const performanceScore = Math.round(
    (bayesianConversionRate * 35) +
    (opportunityWinRate * 25) +
    ((Number(user.slaComplianceRate || 0.95)) * 20) +
    ((Number(user.managerPerformanceRating || 4.0) / 5.0) * 20)
  );

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    experienceYears: Number(user.experienceYears ?? 2.0),
    experienceTier: user.experienceTier || "Sales Representative",
    skills: skillsList,
    territory: user.territory || null,
    maxOpenLeads: maxLeads,
    openLeadCount,
    openOpportunityCount,
    openPipelineValue,
    weightedWorkload,
    totalLeadsAssigned,
    convertedLeads,
    rawConversionRate,
    bayesianConversionRate,
    totalDeals,
    wonDeals,
    opportunityWinRate,
    totalRevenueWon,
    totalAssignedPipeline,
    revenueConversionRate,
    averageDealSize,
    averageFirstResponseMinutes: Number(user.averageFirstResponseMinutes ?? 15.0),
    slaComplianceRate: Number(user.slaComplianceRate ?? 0.95),
    managerPerformanceRating: Number(user.managerPerformanceRating ?? 4.0),
    recentHighValueLeadCount: Number(user.recentHighValueLeadCount ?? 0),
    recentLeadValueAssigned: Number(user.recentLeadValueAssigned ?? 0),
    performanceScore
  };
}

/**
 * Calculates Lead Priority Score and High-Value classification
 */
export function calculateLeadPriorityScore(leadContext: any): LeadPriorityDetails {
  const {
    budgetRange, expectedValue, leadScore = 50, isStrategic, source, urgency
  } = leadContext;

  let expectedRevenue = Number(expectedValue || 0);

  if (!expectedRevenue && budgetRange) {
    const cleanStr = String(budgetRange).toLowerCase();
    if (cleanStr.includes("2cr") || cleanStr.includes("20000000")) expectedRevenue = 20000000;
    else if (cleanStr.includes("1cr") || cleanStr.includes("10000000")) expectedRevenue = 10000000;
    else if (cleanStr.includes("50l") || cleanStr.includes("5000000")) expectedRevenue = 5000000;
    else if (cleanStr.includes("25l") || cleanStr.includes("2500000")) expectedRevenue = 2500000;
    else if (cleanStr.includes("100k") || cleanStr.includes("10l")) expectedRevenue = 1000000;
    else if (cleanStr.includes("enterprise") || cleanStr.includes("vip")) expectedRevenue = 15000000;
  }

  let score = Math.min(100, Math.max(10, Number(leadScore || 50)));

  // Value Bonus
  if (expectedRevenue >= 10000000) score += 25; // >= ₹1Cr
  else if (expectedRevenue >= 2500000) score += 15; // >= ₹25L

  // Strategic Account Bonus
  if (isStrategic) score += 20;

  // Source Intent Bonus
  const src = String(source || "").toLowerCase();
  if (src.includes("quote") || src.includes("pricing") || src.includes("rfp")) score += 15;
  else if (src.includes("demo") || src.includes("contact")) score += 10;

  // Urgency Bonus
  if (String(urgency || "").toLowerCase() === "high") score += 10;

  score = Math.min(100, Math.max(10, score));

  const isHighValueLead = expectedRevenue >= 10000000 || score >= 80 || Boolean(isStrategic);

  let priorityTier: "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL" = "NORMAL";
  if (score >= 85 || expectedRevenue >= 10000000) priorityTier = "CRITICAL";
  else if (score >= 70 || expectedRevenue >= 2500000) priorityTier = "HIGH";
  else if (score >= 50) priorityTier = "MEDIUM";

  const reasonSummary = `Priority Score ${score}/100 (${priorityTier}) — Expected Value: ₹${(expectedRevenue / 100000).toFixed(1)}L${isStrategic ? ', Strategic Account' : ''}`;

  return {
    priorityScore: score,
    expectedRevenue,
    isHighValueLead,
    priorityTier,
    reasonSummary
  };
}

/**
 * Calculates Multi-Factor Rep Suitability Score for a specific Lead Context
 */
export function calculateRepSuitabilityScore(
  profile: RepPerformanceProfile,
  leadContext: any,
  policyWeights?: any,
  leadPriorityDetails?: LeadPriorityDetails
): CandidateEvaluationResult {
  const { industry, territory } = leadContext;

  const priorityScore = leadPriorityDetails?.priorityScore ?? 50;
  const isHighValue = leadPriorityDetails?.isHighValueLead ?? false;

  // 1. Conversion Score (0-100)
  const conversionScore = Math.min(100, Math.round(profile.bayesianConversionRate * 100 * 2.5));

  // 2. Industry / Skill Match Score (0-100)
  let industrySkillScore = 20;
  if (industry) {
    const leadInd = String(industry).toLowerCase();
    const matchesSkill = profile.skills.some(s => {
      const sk = String(s).toLowerCase();
      return sk.includes(leadInd) || leadInd.includes(sk);
    });
    if (matchesSkill) industrySkillScore = 100;
    else if (profile.skills.length > 0) industrySkillScore = 50;
  } else {
    industrySkillScore = 60; // neutral fallback
  }

  // 3. Territory Match Score (0-100)
  let territoryScore = 20;
  if (territory && profile.territory) {
    const leadTerr = String(territory).toLowerCase();
    const repTerr = String(profile.territory).toLowerCase();
    if (repTerr.includes(leadTerr) || leadTerr.includes(repTerr)) {
      territoryScore = 100;
    } else {
      territoryScore = 40;
    }
  } else {
    territoryScore = 70; // neutral fallback
  }

  // 4. Revenue Performance Score (0-100)
  const revScore = Math.min(100, Math.round((profile.totalRevenueWon / 5000000) * 50 + (profile.revenueConversionRate * 50)));

  // 5. Experience Tier Score (0-100)
  const tierMap: Record<string, number> = {
    "Strategic AE": 100,
    "Enterprise AE": 90,
    "Senior Sales Representative": 80,
    "senior_ae": 80,
    "manager": 95,
    "Sales Representative": 65,
    "sales_rep": 65,
    "Associate": 50,
    "Trainee": 30
  };
  const experienceTierScore = tierMap[profile.experienceTier] || tierMap[profile.role] || 60;

  // 6. Response Performance Score (0-100)
  const responseScore = Math.max(10, Math.min(100, Math.round(100 - (profile.averageFirstResponseMinutes - 5) * 3)));

  // 7. SLA Compliance Score (0-100)
  const slaComplianceScore = Math.round(profile.slaComplianceRate * 100);

  // 8. Workload / Capacity Score (0-100)
  const capRatio = profile.maxOpenLeads > 0 ? profile.openLeadCount / profile.maxOpenLeads : 0.5;
  const workloadScore = Math.max(0, Math.round((1 - capRatio) * 100));

  // 9. Fairness / Recent Distribution Score (0-100)
  const fairnessPenalty = (profile.recentHighValueLeadCount * 20) + ((profile.recentLeadValueAssigned / 10000000) * 15);
  const fairnessScore = Math.max(10, Math.min(100, Math.round(100 - fairnessPenalty)));

  // 10. Manager Performance Rating Score (0-100)
  const managerRatingScore = Math.round((profile.managerPerformanceRating / 5.0) * 100);

  // Default Weights
  const weights = policyWeights || {
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
  };

  // Dynamic Shift for High-Priority Leads
  let finalConversionW = Number(weights.conversionRate ?? 0.20);
  let finalIndustryW = Number(weights.industrySkill ?? 0.20);
  let finalExpW = Number(weights.experienceTier ?? 0.10);
  let finalRespW = Number(weights.responseTime ?? 0.05);
  let finalWorkloadW = Number(weights.workloadCapacity ?? 0.10);

  if (isHighValue || priorityScore >= 80) {
    finalConversionW += 0.05;
    finalIndustryW += 0.05;
    finalExpW += 0.05;
    finalWorkloadW = Math.max(0.02, finalWorkloadW - 0.05);
  }

  const finalScore = Math.round(
    (conversionScore * finalConversionW) +
    (industrySkillScore * finalIndustryW) +
    (territoryScore * Number(weights.territoryMatch ?? 0.10)) +
    (revScore * Number(weights.revenuePerformance ?? 0.10)) +
    (experienceTierScore * finalExpW) +
    (responseScore * finalRespW) +
    (slaComplianceScore * Number(weights.slaCompliance ?? 0.05)) +
    (workloadScore * finalWorkloadW) +
    (fairnessScore * Number(weights.fairnessDistribution ?? 0.05)) +
    (managerRatingScore * Number(weights.managerRating ?? 0.05))
  );

  const breakdown: FactorBreakdown = {
    conversionScore,
    industrySkillScore,
    territoryScore,
    revenuePerformanceScore: revScore,
    experienceTierScore,
    responseScore,
    slaComplianceScore,
    workloadScore,
    fairnessScore,
    managerRatingScore
  };

  const explanationText = `Match Score: ${finalScore}/100 (${(profile.rawConversionRate * 100).toFixed(0)}% Conv, ${industrySkillScore}% Industry, ${profile.averageFirstResponseMinutes}m Resp, ${profile.openLeadCount}/${profile.maxOpenLeads} Capacity)`;

  return {
    repId: profile.userId,
    repName: profile.name,
    repRole: profile.role,
    experienceTier: profile.experienceTier,
    finalScore,
    breakdown,
    explanationText
  };
}
