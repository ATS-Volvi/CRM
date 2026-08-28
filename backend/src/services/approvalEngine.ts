import { sequelize } from "@nexus-crm/database";

export interface QuoteApprovalEvaluationResult {
  approvalRequired: boolean;
  approvalLevel: "NONE" | "SALES_REP" | "TEAM_LEAD" | "ADMIN";
  requiredApproverId: string | null;
  reason: string;
  quoteValue: number;
  repLimit: number;
  teamLeadLimit: number;
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
  }

  // Fetch Sales Rep details
  let salesRep: any = null;
  if (salesRepId && salesRepId !== "system") {
    salesRep = await sequelize.models.User.findByPk(salesRepId, {
      attributes: ["id", "name", "email", "role", "tier", "dealValueCutoff", "managerId", "isAvailable"]
    });
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

  // Load Admin Global Policy (fallback to defaults if not created)
  let adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
    order: [["createdAt", "DESC"]]
  });

  const maxSalesRepApproval = Number(adminPolicy?.maximumSalesRepApproval ?? 2500000);
  const maxTeamLeadApproval = Number(adminPolicy?.maximumTeamLeadApproval ?? 10000000);
  const maxRepDiscount = Number(adminPolicy?.maximumRepDiscount ?? 0.10);
  const maxTeamLeadDiscount = Number(adminPolicy?.maximumTeamLeadDiscount ?? 0.20);
  const minAllowedMargin = Number(adminPolicy?.minimumAllowedMargin ?? 0.15);

  const repDefaultCutoff = salesRep?.dealValueCutoff !== null && salesRep?.dealValueCutoff !== undefined
    ? Number(salesRep.dealValueCutoff)
    : (salesRep?.tier === "executive" ? 250000 : salesRep?.tier === "agent" ? 50000 : 1000000);

  // Authority limits for Rep (capped by Admin Policy)
  const repLimit = Math.min(
    Number(repProfile?.selfApprovalLimit ?? repDefaultCutoff),
    maxSalesRepApproval
  );
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

  const teamLeadLimit = Math.min(
    Number(teamLeadProfile?.selfApprovalLimit ?? maxTeamLeadApproval),
    maxTeamLeadApproval
  );
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

  // Edge case: Inactive rep
  if (isInactive) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push("Sales Representative is inactive.");
  }

  // Edge case: Rep missing limit profile -> default Team Lead
  if (!repProfile && !isInactive) {
    if (quoteValue > repLimit) {
      updateLevel("TEAM_LEAD");
      triggerReasons.push(`Quote value exceeds default sales representative self-approval limit of ₹${repLimit.toLocaleString()}`);
    }
  }

  // 1. Quote Value Rule
  if (quoteValue > teamLeadLimit) {
    updateLevel("ADMIN");
    triggerReasons.push(`Quote value of ₹${quoteValue.toLocaleString()} exceeds Team Lead approval threshold of ₹${teamLeadLimit.toLocaleString()}`);
  } else if (quoteValue > repLimit) {
    updateLevel("TEAM_LEAD");
    triggerReasons.push(`Quote value exceeds sales representative approval limit of ₹${repLimit.toLocaleString()}`);
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
}) => {
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
    });
  } catch (err) {
    console.error("[ApprovalAuditLog] Failed to log audit record:", err);
  }
};
