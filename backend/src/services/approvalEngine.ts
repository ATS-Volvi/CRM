import { sequelize } from "@nexus-crm/database";
import { formatMoney } from "../utils/formatMoney";
import { convertToOrgCurrency, resolveLimit } from "../utils/exchangeRate";
import { getOrgCurrency } from "../utils/orgSettings";

export interface QuoteApprovalEvaluationResult {
  approvalRequired: boolean;
  approvalLevel: "NONE" | "SALES_REP" | "TEAM_LEAD" | "ADMIN";
  requiredApproverId: string | null;
  reason: string;
  quoteValue: number;
  repLimit: number;
  teamLeadLimit: number;
  repLimitDisplay?: string;
  teamLeadLimitDisplay?: string;
  discount: number; // e.g. 0.08 for 8%
  margin: number | null; // null if cost unavailable
  repDiscountLimit: number;
  teamLeadDiscountLimit: number;
  repMinMargin: number;
  teamLeadMinMargin: number;
  salesRepId: string;
  teamLeadId: string | null;
}

export const evaluateQuoteApproval = async (
  quoteId: string,
  quoteOverrideData?: any
): Promise<QuoteApprovalEvaluationResult> => {
  let quote: any = null;
  let lineItems: any[] = [];
  let salesRepId: string = "system";
  let salesRep: any = null;

  if (quoteId) {
    quote = await sequelize.models.Quote.findByPk(quoteId, {
      include: [
        {
          model: sequelize.models.QuoteLineItem,
          as: "QuoteLineItems",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        },
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [{ model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role", "managerId", "isAvailable"] }]
        }
      ]
    });
  }

  if (quote) {
    lineItems = quote.QuoteLineItems || [];
    if (quote.deal && quote.deal.ownerId) {
      salesRepId = quote.deal.ownerId;
    }
  }

  // Use override data if creating/editing inline
  if (quoteOverrideData) {
    if (quoteOverrideData.items) {
      lineItems = quoteOverrideData.items;
    }
    if (quoteOverrideData.salesRepId) {
      salesRepId = quoteOverrideData.salesRepId;
    }
    if (quoteOverrideData.user || quoteOverrideData.salesRep) {
      salesRep = quoteOverrideData.user || quoteOverrideData.salesRep;
    }
  }

  // Fetch Sales Rep details if not provided directly
  if (!salesRep && salesRepId && salesRepId !== "system") {
    try {
      salesRep = await sequelize.models.User.findByPk(salesRepId, {
        attributes: ["id", "name", "email", "role", "tier", "dealValueCutoff", "managerId", "isAvailable"]
      });
    } catch (e) {}
  }

  // Edge case: Sales Rep inactive
  const isInactive = salesRep && (salesRep.isAvailable === false || salesRep.status === "Inactive");

  // Load Sales Rep Approval Profile
  let repProfile: any = null;
  if (salesRepId) {
    repProfile = await sequelize.models.SalesApprovalProfile.findOne({
      where: { salesRepId }
    });
  }

  // Load Admin Global Policy (fallback to strictest 0 if not created)
  let adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
    order: [["createdAt", "DESC"]]
  });

  if (!adminPolicy) {
    console.warn("[approvalEngine] AdminApprovalPolicy not found in database. Applying strictest approval rule.");
  }

  const orgCurrency = await getOrgCurrency();
  const policyCurrency = (adminPolicy?.currency || "INR").toUpperCase();

  // Resolve Admin Policy limits to Organization currency
  const maxSalesRepRes = await resolveLimit(adminPolicy?.maximumSalesRepApproval ?? 2500000, policyCurrency, orgCurrency);
  const maxTeamLeadRes = await resolveLimit(adminPolicy?.maximumTeamLeadApproval ?? 10000000, policyCurrency, orgCurrency);
  const repDefaultRes = await resolveLimit(adminPolicy?.repTierCutoffDefault ?? adminPolicy?.repSelfApprovalDefault ?? 1000000, policyCurrency, orgCurrency);
  const tierExecRes = await resolveLimit(adminPolicy?.repTierCutoffExecutive ?? 250000, policyCurrency, orgCurrency);
  const tierAgentRes = await resolveLimit(adminPolicy?.repTierCutoffAgent ?? 50000, policyCurrency, orgCurrency);
  const teamLeadDefaultRes = await resolveLimit(adminPolicy?.teamLeadApprovalDefault ?? 5000000, policyCurrency, orgCurrency);

  const maxRepDiscount = adminPolicy?.maximumRepDiscount != null ? Number(adminPolicy.maximumRepDiscount) : 0.05;
  const maxTeamLeadDiscount = adminPolicy?.maximumTeamLeadDiscount != null ? Number(adminPolicy.maximumTeamLeadDiscount) : 0.10;
  const minAllowedMargin = adminPolicy?.minimumAllowedMargin != null ? Number(adminPolicy.minimumAllowedMargin) : 0.20;

  // Determine Rep base cutoff
  let repResolved = repDefaultRes;
  if (salesRep?.dealValueCutoff !== null && salesRep?.dealValueCutoff !== undefined) {
    // dealValueCutoff on user is in org currency
    repResolved = await resolveLimit(salesRep.dealValueCutoff, orgCurrency, orgCurrency);
  } else if (salesRep?.tier === "executive") {
    repResolved = tierExecRes;
  } else if (salesRep?.tier === "agent") {
    repResolved = tierAgentRes;
  }

  // If rep profile configured, profile limit is in org currency
  if (repProfile?.selfApprovalLimit !== null && repProfile?.selfApprovalLimit !== undefined) {
    repResolved = await resolveLimit(repProfile.selfApprovalLimit, orgCurrency, orgCurrency);
  }

  let repLimit = repResolved.orgAmount;
  let repLimitDisplay = repResolved.display;
  if (maxSalesRepRes.orgAmount > 0 && repLimit > maxSalesRepRes.orgAmount) {
    repLimit = maxSalesRepRes.orgAmount;
    repLimitDisplay = maxSalesRepRes.display;
  }

  const repDiscountLimit = Math.min(
    Number(repProfile?.discountApprovalLimit ?? 0.10),
    maxRepDiscount
  );
  const repMinMargin = Math.max(
    Number(repProfile?.minimumMargin ?? 0.20),
    minAllowedMargin
  );

  const teamLeadId = repProfile?.teamLeadId || salesRep?.managerId || null;

  // Load Team Lead Approval Profile if configured (otherwise fallback to Admin Policy ceiling)
  let teamLeadProfile: any = null;
  if (teamLeadId) {
    teamLeadProfile = await sequelize.models.SalesApprovalProfile.findOne({
      where: { salesRepId: teamLeadId }
    });
  }

  let teamLeadResolved = teamLeadDefaultRes;
  if (teamLeadProfile?.selfApprovalLimit !== null && teamLeadProfile?.selfApprovalLimit !== undefined) {
    teamLeadResolved = await resolveLimit(teamLeadProfile.selfApprovalLimit, orgCurrency, orgCurrency);
  }

  let teamLeadLimit = teamLeadResolved.orgAmount;
  let teamLeadLimitDisplay = teamLeadResolved.display;
  if (maxTeamLeadRes.orgAmount > 0 && teamLeadLimit > maxTeamLeadRes.orgAmount) {
    teamLeadLimit = maxTeamLeadRes.orgAmount;
    teamLeadLimitDisplay = maxTeamLeadRes.display;
  }

  const teamLeadDiscountLimit = Math.min(
    Number(teamLeadProfile?.discountApprovalLimit ?? maxTeamLeadDiscount),
    maxTeamLeadDiscount
  );
  const teamLeadMinMargin = Math.max(
    Number(teamLeadProfile?.minimumMargin ?? minAllowedMargin),
    minAllowedMargin
  );


  // Calculate Quote Metrics
  let quoteValue = quoteOverrideData?.totalAmount ?? Number(quote?.totalAmount ?? 0);

  // Calculate list price total, discount, and cost (margin)
  let totalListPrice = 0;
  let totalCost = 0;
  let hasValidCost = lineItems.length > 0;
  let maxItemDiscountRatio = 0;

  for (const item of lineItems) {
    if (item.isOptional) continue;

    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);

    let listPrice = unitPrice;
    let productCost: number | null = null;

    if (item.product) {
      listPrice = Number(item.product.unitPrice || unitPrice);
      if (item.product.costPrice !== null && item.product.costPrice !== undefined) {
        productCost = Number(item.product.costPrice);
      }
    } else if (item.productId) {
      const pbe: any = await sequelize.models.PriceBookEntry.findByPk(item.productId);
      if (pbe) {
        listPrice = Number(pbe.unitPrice || unitPrice);
        if (pbe.costPrice !== null && pbe.costPrice !== undefined) {
          productCost = Number(pbe.costPrice);
        }
      }
    }

    if (item.costPrice !== undefined && item.costPrice !== null) {
      productCost = Number(item.costPrice);
    }

    totalListPrice += qty * listPrice;

    if (productCost !== null && productCost >= 0) {
      totalCost += qty * productCost;
    } else {
      hasValidCost = false;
    }

    let itemDisc = 0;
    if (item.discount !== undefined && item.discount !== null && !isNaN(Number(item.discount))) {
      itemDisc = Number(item.discount) / 100;
    }
    if (listPrice > 0 && unitPrice > 0 && unitPrice < listPrice) {
      const calcDisc = (listPrice - unitPrice) / listPrice;
      itemDisc = Math.max(itemDisc, calcDisc);
    }
    if (itemDisc > maxItemDiscountRatio) {
      maxItemDiscountRatio = itemDisc;
    }
  }

  if (quoteValue === 0 && lineItems.length > 0) {
    quoteValue = lineItems
      .filter((i: any) => !i.isOptional)
      .reduce((sum: number, i: any) => sum + Number(i.totalPrice || i.quantity * i.unitPrice || 0), 0);
  }

  // Calculate overall discount percentage
  let overallDiscount = 0;
  if (totalListPrice > 0 && quoteValue < totalListPrice) {
    overallDiscount = (totalListPrice - quoteValue) / totalListPrice;
  }
  const discount = Math.max(overallDiscount, maxItemDiscountRatio);

  // Margin Protection (Rule 7: skip if cost data unavailable)
  let margin: number | null = null;
  if (hasValidCost && quoteValue > 0) {
    margin = (quoteValue - totalCost) / quoteValue;
  }

  // Evaluate Hierarchy Rules
  type LevelType = "NONE" | "SALES_REP" | "TEAM_LEAD" | "ADMIN";
  let highestLevel: LevelType = "SALES_REP";
  const triggerReasons: string[] = [];

  const LEVEL_RANK: Record<LevelType, number> = {
    NONE: 0,
    SALES_REP: 1,
    TEAM_LEAD: 2,
    ADMIN: 3
  };

  const updateLevel = (newLevel: LevelType) => {
    if (LEVEL_RANK[newLevel] > LEVEL_RANK[highestLevel]) {
      highestLevel = newLevel;
    }
  };

  const quoteCurrency = quoteOverrideData?.currency || quote?.currency || orgCurrency;
  let convertedQuoteValue = quoteValue;

  if (quoteCurrency.toUpperCase() !== orgCurrency.toUpperCase()) {
    const rateResult = await convertToOrgCurrency(quoteValue, quoteCurrency, orgCurrency);
    if (rateResult === null) {
      updateLevel("ADMIN");
      triggerReasons.push(`Exchange rate for ${quoteCurrency} is missing; ask an admin`);
    } else {
      convertedQuoteValue = rateResult;
    }
  }

  // Check for missing rates in limits
  if (repResolved.missingRate || teamLeadResolved.missingRate) {
    updateLevel("ADMIN");
    triggerReasons.push(`Exchange rate for ${policyCurrency} is missing; ask an admin`);
  }

  // Edge case: Inactive rep
  if (isInactive) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push("Sales Representative is inactive.");
  }

  // Edge case: Rep missing limit profile -> default Team Lead
  if (!repProfile && !isInactive) {
    if (repLimit <= 0 || convertedQuoteValue > repLimit) {
      updateLevel("TEAM_LEAD");
      triggerReasons.push(`Quote value exceeds default sales representative self-approval limit of ${repLimitDisplay}`);
    }
  }

  // 1. Quote Value Rule
  if (teamLeadLimit > 0 && convertedQuoteValue > teamLeadLimit) {
    updateLevel("ADMIN");
    triggerReasons.push(`Quote value of ${formatMoney(quoteValue, quoteCurrency)} exceeds Team Lead approval threshold of ${teamLeadLimitDisplay}`);
  } else if (repLimit > 0 && convertedQuoteValue > repLimit) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push(`Quote value exceeds sales representative approval limit of ${repLimitDisplay}`);
  } else if (repLimit <= 0) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push(`Sales representative self-approval is not configured or disabled`);
  }

  // 2. Discount Limit Rule
  if (discount > teamLeadDiscountLimit) {
    updateLevel("ADMIN");
    triggerReasons.push(`Discount of ${(discount * 100).toFixed(1)}% exceeds Team Lead discount limit of ${(teamLeadDiscountLimit * 100).toFixed(1)}%`);
  } else if (discount > repDiscountLimit) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push(`Discount exceeds Sales Representative authority limit of ${(repDiscountLimit * 100).toFixed(1)}%`);
  }

  // 3. Margin Protection Rule (only if cost data exists)
  if (margin !== null) {
    if (margin < teamLeadMinMargin) {
      updateLevel("ADMIN");
      triggerReasons.push(`Quote margin of ${(margin * 100).toFixed(1)}% is below Team Lead minimum allowed margin of ${(teamLeadMinMargin * 100).toFixed(1)}%`);
    } else if (margin < repMinMargin) {
      updateLevel("TEAM_LEAD");
      triggerReasons.push(`Quote margin of ${(margin * 100).toFixed(1)}% is below Sales Representative minimum margin of ${(repMinMargin * 100).toFixed(1)}%`);
    }
  }

  // Determine required approver
  let requiredApproverId: string | null = null;
  const currentLevelStr = String(highestLevel);

  if (currentLevelStr === "TEAM_LEAD") {
    requiredApproverId = teamLeadId;
    if (!requiredApproverId) {
      // Fallback: If no TL assigned, escalate to Admin
      const adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" }, attributes: ["id", "name", "email", "role"] });
      if (adminUser) requiredApproverId = adminUser.id;
    }
  } else if (currentLevelStr === "ADMIN") {
    const adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" }, attributes: ["id", "name", "email", "role"] });
    if (adminUser) requiredApproverId = adminUser.id;
  }

  const approvalRequired = currentLevelStr === "TEAM_LEAD" || currentLevelStr === "ADMIN";
  const primaryReason = triggerReasons.length > 0 
    ? triggerReasons.join(". ")
    : "Within Sales Representative authority limits";

  return {
    approvalRequired,
    approvalLevel: highestLevel,
    requiredApproverId,
    reason: primaryReason,
    quoteValue,
    repLimit,
    teamLeadLimit,
    repLimitDisplay,
    teamLeadLimitDisplay,
    discount: Number(discount.toFixed(4)),
    margin: margin !== null ? Number(margin.toFixed(4)) : null,
    repDiscountLimit,
    teamLeadDiscountLimit,
    repMinMargin,
    teamLeadMinMargin,
    salesRepId,
    teamLeadId
  };
};


export const createApprovalAuditLog = async (data: {
  quoteId: string;
  salesRepId: string;
  approvalLevel: string;
  requiredLimit?: number | null;
  actualQuoteValue: number;
  discount: number;
  margin?: number | null;
  approverId?: string | null;
  decision: string;
  comment?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason: string;
}, options?: { transaction?: any }) => {
  try {
    await sequelize.models.ApprovalAuditLog.create({
      id: require("crypto").randomUUID(),
      quoteId: data.quoteId,
      salesRepId: data.salesRepId,
      approvalLevel: data.approvalLevel,
      requiredLimit: data.requiredLimit || null,
      actualQuoteValue: data.actualQuoteValue,
      discount: data.discount || 0,
      margin: data.margin ?? null,
      approverId: data.approverId || null,
      decision: data.decision,
      comment: data.comment || null,
      previousStatus: data.previousStatus || null,
      newStatus: data.newStatus || null,
      reason: data.reason
    }, options?.transaction ? { transaction: options.transaction } : undefined);
  } catch (err) {
    console.error("[ApprovalAuditLog] Failed to log audit record:", err);
  }
};

export interface DealApprovalEvaluationResult {
  approvalRequired: boolean;
  approvalLevel: "NONE" | "TEAM_LEAD" | "ADMIN";
  requiredApproverId: string | null;
  reason: string;
  dealValue: number;
  repLimit: number;
  managerLimit: number;
  repLimitDisplay?: string;
  managerLimitDisplay?: string;
  salesRepId: string;
  managerId: string | null;
  exceededBy: number;
}

export const evaluateDealApproval = async (
  dealId: string,
  amountOverride?: number,
  currencyOverride?: string
): Promise<DealApprovalEvaluationResult> => {
  let deal: any = null;
  if (dealId) {
    deal = await sequelize.models.Deal.findByPk(dealId, {
      include: [
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email", "role", "managerId", "dealValueCutoff", "isAvailable"] }
      ]
    });
  }

  const dealValue = amountOverride !== undefined ? Number(amountOverride) : Number(deal?.amount || 0);
  const salesRepId = deal?.ownerId || "system";
  const salesRep = deal?.owner;

  // Rep profile
  let repProfile: any = null;
  if (salesRepId && salesRepId !== "system") {
    repProfile = await sequelize.models.SalesApprovalProfile.findOne({
      where: { salesRepId }
    });
  }

  // Global admin policy
  let adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
    order: [["createdAt", "DESC"]]
  });

  if (!adminPolicy) {
    console.warn("[approvalEngine] AdminApprovalPolicy not found in database for deal approval. Applying strictest rule.");
  }

  const orgCurrency = await getOrgCurrency();
  const policyCurrency = (adminPolicy?.currency || "INR").toUpperCase();
  const dealCurrency = currencyOverride || deal?.currency || orgCurrency;
  let convertedDealValue = dealValue;
  let missingExchangeRate = false;

  if (dealCurrency.toUpperCase() !== orgCurrency.toUpperCase()) {
    const rateResult = await convertToOrgCurrency(dealValue, dealCurrency, orgCurrency);
    if (rateResult === null) {
      missingExchangeRate = true;
    } else {
      convertedDealValue = rateResult;
    }
  }

  // Resolve Policy limits
  const maxSalesRepRes = await resolveLimit(adminPolicy?.maximumSalesRepApproval ?? 2500000, policyCurrency, orgCurrency);
  const maxTeamLeadRes = await resolveLimit(adminPolicy?.maximumTeamLeadApproval ?? 10000000, policyCurrency, orgCurrency);
  const repDefaultRes = await resolveLimit(adminPolicy?.repTierCutoffDefault ?? adminPolicy?.repSelfApprovalDefault ?? 1000000, policyCurrency, orgCurrency);

  let repResolved = repDefaultRes;
  if (salesRep?.dealValueCutoff !== null && salesRep?.dealValueCutoff !== undefined) {
    repResolved = await resolveLimit(salesRep.dealValueCutoff, orgCurrency, orgCurrency);
  }
  if (repProfile?.selfApprovalLimit !== null && repProfile?.selfApprovalLimit !== undefined) {
    repResolved = await resolveLimit(repProfile.selfApprovalLimit, orgCurrency, orgCurrency);
  }

  let repLimit = repResolved.orgAmount;
  let repLimitDisplay = repResolved.display;
  if (maxSalesRepRes.orgAmount > 0 && repLimit > maxSalesRepRes.orgAmount) {
    repLimit = maxSalesRepRes.orgAmount;
    repLimitDisplay = maxSalesRepRes.display;
  }

  const managerLimit = maxTeamLeadRes.orgAmount;
  const managerLimitDisplay = maxTeamLeadRes.display;

  if (repResolved.missingRate || maxTeamLeadRes.missingRate) {
    missingExchangeRate = true;
  }

  const managerId = repProfile?.teamLeadId || salesRep?.managerId || null;

  let approvalRequired = false;
  let approvalLevel: "NONE" | "TEAM_LEAD" | "ADMIN" = "NONE";
  let requiredApproverId: string | null = null;
  let reason = "Deal within representative authority limits";
  let exceededBy = 0;

  if (missingExchangeRate) {
    return {
      approvalRequired: true,
      approvalLevel: "ADMIN",
      requiredApproverId: null,
      reason: `Exchange rate for ${dealCurrency} is missing; ask an admin`,
      dealValue,
      repLimit: 0,
      managerLimit: 0,
      repLimitDisplay,
      managerLimitDisplay,
      salesRepId,
      managerId,
      exceededBy: dealValue
    };
  }

  if (repLimit <= 0 || convertedDealValue > repLimit) {
    approvalRequired = true;
    exceededBy = Math.max(0, dealValue - repLimit);
    if (managerLimit > 0 && convertedDealValue > managerLimit) {
      approvalLevel = "ADMIN";
      reason = `Deal value of ${formatMoney(dealValue, dealCurrency)} exceeds Team Lead authority limit (${managerLimitDisplay}). Admin approval required.`;
    } else {
      approvalLevel = "TEAM_LEAD";
      requiredApproverId = managerId;
      reason = `Deal value of ${formatMoney(dealValue, dealCurrency)} exceeds representative authority limit (${repLimitDisplay}). Manager approval required.`;
    }
  }

  return {
    approvalRequired,
    approvalLevel,
    requiredApproverId,
    reason,
    dealValue,
    repLimit,
    managerLimit,
    repLimitDisplay,
    managerLimitDisplay,
    salesRepId,
    managerId,
    exceededBy
  };
};


