import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { createNotification } from "./notificationEngine";
import { createOrderFromFinalQuote } from "./supplyFulfillmentService";

export type OpportunityStatus = "OPEN" | "WON" | "LOST";
export type OpportunityHealth = "HEALTHY" | "AT_RISK" | "STALE";

export type OpportunityEventType =
  | "LeadConverted"
  | "OpportunityCreated"
  | "QualificationCompleted"
  | "QuoteCreated"
  | "QuoteApproved"
  | "QuoteSent"
  | "QuoteRevisionCreated"
  | "QuoteRevisionRequested"
  | "CustomerEmailReceived"
  | "CustomerWhatsAppReceived"
  | "CustomerCallCompleted"
  | "CustomerMeetingCompleted"
  | "CustomerPricingRequest"
  | "CustomerScopeChangeRequest"
  | "CustomerTermsChangeRequest"
  | "QuoteAccepted"
  | "PurchaseOrderReceived"
  | "ContractSigned"
  | "CustomerRejected"
  | "OpportunityCancelled"
  | "FollowUpDue"
  | "OpportunityInactive"
  | "OpportunitySlaBreached"
  | "OrderCreated"
  | "MarkWon"
  | "MarkLost";

export interface OpportunityEvent {
  eventId?: string;
  opportunityId: string;
  type: OpportunityEventType;
  actorId?: string;
  timestamp?: Date;
  payload?: Record<string, any>;
}

export interface OpportunityEventResult {
  success: boolean;
  opportunityId: string;
  status: OpportunityStatus;
  healthStatus: OpportunityHealth;
  currentActivity: string;
  nextAction: string;
  nextActionDue: Date | null;
  orderId?: string;
  isIdempotentReplay?: boolean;
  message: string;
}

export type CommercialIntentCategory =
  | "ACCEPTANCE"
  | "PRICING_DISCUSSION"
  | "SCOPE_CHANGE"
  | "TERMS_DISCUSSION"
  | "REVISION_REQUEST"
  | "REJECTION"
  | "POSITIVE_INTEREST"
  | "GENERAL_RESPONSE";

/**
 * Deterministic commercial intent classification from inbound customer communication text
 */
export function classifyCommercialIntent(text: string): CommercialIntentCategory {
  if (!text) return "GENERAL_RESPONSE";
  const lower = text.toLowerCase();

  // 1. Acceptance triggers
  if (
    lower.includes("accept") ||
    lower.includes("agreed") ||
    lower.includes("po attached") ||
    lower.includes("purchase order attached") ||
    lower.includes("proceed with quote") ||
    lower.includes("approved the quote") ||
    lower.includes("please invoice") ||
    lower.includes("go ahead with order")
  ) {
    return "ACCEPTANCE";
  }

  // 2. Rejection triggers
  if (
    lower.includes("reject") ||
    lower.includes("cancel the request") ||
    lower.includes("not proceeding") ||
    lower.includes("chose another vendor") ||
    lower.includes("went with competitor") ||
    lower.includes("decided not to purchase") ||
    lower.includes("no budget approved")
  ) {
    return "REJECTION";
  }

  // 3. Pricing discussion
  if (
    lower.includes("discount") ||
    lower.includes("price") ||
    lower.includes("pricing") ||
    lower.includes("reduce") ||
    lower.includes("cheaper") ||
    lower.includes("expensive") ||
    lower.includes("rate") ||
    lower.includes("budget is only") ||
    /\b\d+%\b/.test(lower)
  ) {
    return "PRICING_DISCUSSION";
  }

  // 4. Scope change
  if (
    lower.includes("scope") ||
    lower.includes("specification") ||
    lower.includes("specs") ||
    lower.includes("add item") ||
    lower.includes("remove item") ||
    lower.includes("quantity") ||
    lower.includes("dimensions") ||
    lower.includes("customization")
  ) {
    return "SCOPE_CHANGE";
  }

  // 5. Terms discussion
  if (
    lower.includes("payment terms") ||
    lower.includes("credit") ||
    lower.includes("net 30") ||
    lower.includes("net 60") ||
    lower.includes("advance") ||
    lower.includes("delivery timeline") ||
    lower.includes("warranty")
  ) {
    return "TERMS_DISCUSSION";
  }

  // 6. Revision request
  if (
    lower.includes("revise") ||
    lower.includes("revision") ||
    lower.includes("resubmit") ||
    lower.includes("update quote") ||
    lower.includes("new version")
  ) {
    return "REVISION_REQUEST";
  }

  // 7. Positive interest
  if (
    lower.includes("looks good") ||
    lower.includes("interested") ||
    lower.includes("schedule call") ||
    lower.includes("reviewing with team") ||
    lower.includes("call me")
  ) {
    return "POSITIVE_INTEREST";
  }

  return "GENERAL_RESPONSE";
}

/**
 * Evaluates opportunity operational health
 */
export function calculateOpportunityHealth(
  lastActivityAt?: Date | null,
  nextActionDue?: Date | null
): { health: OpportunityHealth; reason?: string } {
  const now = Date.now();
  const lastAct = lastActivityAt ? new Date(lastActivityAt).getTime() : now;
  const daysInactive = Math.floor((now - lastAct) / (1000 * 60 * 60 * 24));

  const isOverdue = nextActionDue && new Date(nextActionDue).getTime() < now;

  if (daysInactive >= 21) {
    return { health: "STALE", reason: `No customer activity for ${daysInactive} days.` };
  }
  if (daysInactive >= 14 || isOverdue) {
    return { health: "AT_RISK", reason: isOverdue ? "Next Action is past SLA deadline." : `No customer activity for ${daysInactive} days.` };
  }
  return { health: "HEALTHY" };
}

function toValidUuid(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  return isUuid ? val : null;
}

/**
 * CENTRAL OPPORTUNITY AUTOMATION ENGINE
 * Authoritative single entry point for all Opportunity lifecycle events.
 */
export async function processOpportunityEvent(event: OpportunityEvent): Promise<OpportunityEventResult> {
  const { opportunityId, type, actorId, payload = {} } = event;
  const eventId = event.eventId || `${type}_${opportunityId}_${Date.now()}`;

  const deal = await sequelize.models.Deal.findByPk(opportunityId, {
    include: [
      { model: sequelize.models.Account, as: "account" },
      { model: sequelize.models.User, as: "owner" }
    ]
  });

  if (!deal) {
    throw new Error(`Opportunity not found with ID: ${opportunityId}`);
  }

  const d = deal as any;

  // 1. Idempotency Check
  let processedKeys: string[] = [];
  try {
    processedKeys = d.idempotencyKeys ? JSON.parse(d.idempotencyKeys) : [];
  } catch {
    processedKeys = [];
  }

  if (event.eventId && processedKeys.includes(event.eventId)) {
    return {
      success: true,
      opportunityId,
      status: (d.status || "OPEN") as OpportunityStatus,
      healthStatus: (d.healthStatus || "HEALTHY") as OpportunityHealth,
      currentActivity: d.currentActivity || "Active Commercial Opportunity",
      nextAction: d.nextAction || "Follow up with customer",
      nextActionDue: d.nextActionDue,
      isIdempotentReplay: true,
      message: `Event '${event.eventId}' was already processed idempotently.`
    };
  }

  // 2. Prevent illegal state transitions for terminal statuses
  if (d.status === "WON" && type !== "MarkWon" && type !== "OrderCreated" && type !== "QuoteAccepted") {
    return {
      success: true,
      opportunityId,
      status: "WON",
      healthStatus: "HEALTHY",
      currentActivity: d.currentActivity || "Opportunity Won",
      nextAction: "Order handoff completed",
      nextActionDue: null,
      message: "Opportunity is already marked WON."
    };
  }

  let nextStatus: OpportunityStatus = (d.status || "OPEN") as OpportunityStatus;
  let nextActivity = d.currentActivity || "Active Commercial Opportunity";
  let nextAction = d.nextAction || "Follow up with customer";
  let nextActionDue: Date | null = d.nextActionDue || new Date(Date.now() + 24 * 3600 * 1000);
  let createdOrderId: string | undefined = undefined;
  let wonAt: Date | null = d.wonAt;
  let winningQuoteId: string | null = d.winningQuoteId;
  let wonReason: string | null = d.wonReason;
  let lostAt: Date | null = d.lostAt;
  let lostBy: string | null = d.lostBy;
  let lossReason: string | null = d.lossReason;
  let lossNotes: string | null = d.lossNotes;
  let lastCustomerActivityAt: Date | null = d.lastCustomerActivityAt;

  // 3. Process Specific Event Types
  switch (type) {
    case "LeadConverted":
    case "OpportunityCreated": {
      nextStatus = "OPEN";
      nextActivity = "Opportunity created from converted Lead";
      nextAction = "Contact customer / confirm requirements";
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      lastCustomerActivityAt = d.lastCustomerActivityAt || null;

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `Opportunity created: ${d.name} (Value: ₹${Number(d.amount || 0).toLocaleString()})`,
        mentioned_user_ids: "[]",
        pinned: true,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });

      if (d.ownerId) {
        await createNotification({
          userId: d.ownerId,
          type: "OPPORTUNITY_CREATED",
          title: "New Commercial Opportunity",
          message: `New Opportunity '${d.name}' assigned to you.`
        });
      }
      break;
    }

    case "QuoteCreated": {
      nextStatus = "OPEN";
      const qNumber = payload.quoteNumber || payload.quoteId || "Draft";
      const version = payload.version || 1;
      nextActivity = `Quote #${qNumber} (v${version}) prepared`;
      nextAction = "Complete / submit quotation for review";
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `Commercial Quote #${qNumber} (v${version}) prepared for ₹${Number(payload.totalAmount || d.amount || 0).toLocaleString()}`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });
      break;
    }

    case "QuoteApproved": {
      nextStatus = "OPEN";
      const qNumber = payload.quoteNumber || "Quote";
      nextActivity = `Quotation #${qNumber} approved`;
      nextAction = "Send quotation to customer";
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `Quotation #${qNumber} approved by ${payload.approverRole || "Team Lead"}. Ready to dispatch.`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });

      if (d.ownerId) {
        await createNotification({
          userId: d.ownerId,
          type: "QUOTE_APPROVED",
          title: "Quote Approved",
          message: `Quotation #${qNumber} approved. Ready to send to customer.`
        });
      }
      break;
    }

    case "QuoteSent": {
      nextStatus = "OPEN";
      const qNumber = payload.quoteNumber || "Quote";
      lastCustomerActivityAt = new Date();
      nextActivity = `Quotation #${qNumber} sent to customer`;
      nextAction = "Follow up on quotation";
      // 3 business days (72 hours)
      nextActionDue = new Date(Date.now() + 72 * 3600 * 1000);

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "email",
        outcome: `Official Quotation #${qNumber} sent to client. Follow-up scheduled in 3 business days.`,
        mentioned_user_ids: "[]",
        pinned: true,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "outbound"
      });
      break;
    }

    case "CustomerEmailReceived":
    case "CustomerWhatsAppReceived":
    case "CustomerCallCompleted":
    case "CustomerMeetingCompleted": {
      lastCustomerActivityAt = new Date();
      const text = payload.text || payload.content || payload.notes || "";
      const intent = payload.intent || classifyCommercialIntent(text);

      if (intent === "ACCEPTANCE") {
        nextActivity = "Customer indicated acceptance of quotation";
        nextAction = "Verify acceptance terms & confirm Order";
        nextActionDue = new Date(Date.now() + 4 * 3600 * 1000);
      } else if (intent === "PRICING_DISCUSSION") {
        nextActivity = "Customer requested pricing revision / discount";
        nextAction = "Respond to pricing request";
        nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      } else if (intent === "SCOPE_CHANGE" || intent === "REVISION_REQUEST") {
        nextActivity = "Customer requested scope or quotation changes";
        nextAction = "Prepare revised quotation";
        nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      } else if (intent === "REJECTION") {
        nextActivity = "Customer indicated rejection signal";
        nextAction = "Review loss recommendation with team";
        nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);

        if (d.ownerId) {
          await createNotification({
            userId: d.ownerId,
            type: "OPPORTUNITY_AT_RISK",
            title: "Loss Signal Detected",
            message: `Customer communication on '${d.name}' indicated rejection. Review recommended.`
          });
        }
      } else {
        nextActivity = "Customer responded to quotation";
        nextAction = "Review message & continue commercial conversation";
        nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      }

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: type.includes("WhatsApp") ? "whatsapp_sms" : type.includes("Call") ? "call" : type.includes("Meeting") ? "meeting" : "email",
        outcome: `Inbound Customer Response [${intent}]: ${text.slice(0, 200)}`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "inbound"
      });
      break;
    }

    case "CustomerPricingRequest": {
      lastCustomerActivityAt = new Date();
      nextActivity = `Customer requested pricing discussion (${payload.requestedDiscount || "discount"})`;
      nextAction = "Respond to pricing request";
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      break;
    }

    case "CustomerScopeChangeRequest": {
      lastCustomerActivityAt = new Date();
      nextActivity = `Customer requested scope change: ${payload.scopeDetails || "revised specs"}`;
      nextAction = "Prepare revised quotation";
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);
      break;
    }

    case "QuoteRevisionCreated":
    case "QuoteRevisionRequested": {
      nextStatus = "OPEN";
      const ver = payload.version || 2;
      nextActivity = `Quotation revision requested (preparing v${ver})`;
      nextAction = `Submit revised quotation (v${ver})`;
      nextActionDue = new Date(Date.now() + 24 * 3600 * 1000);

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `Quotation revision initialized for v${ver}. Reason: ${payload.reason || "Customer feedback"}`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });
      break;
    }

    case "QuoteAccepted":
    case "PurchaseOrderReceived":
    case "ContractSigned":
    case "MarkWon": {
      // ── PRIMARY AUTOMATIC WON TRIGGER ──
      nextStatus = "WON";
      wonAt = new Date();
      winningQuoteId = payload.quoteId || d.winningQuoteId;
      wonReason = payload.wonReason || (type === "PurchaseOrderReceived" ? "PURCHASE_ORDER" : type === "ContractSigned" ? "CONTRACT_SIGNED" : "QUOTE_ACCEPTED");
      nextActivity = type === "PurchaseOrderReceived" 
        ? `Purchase Order ${payload.poNumber || ""} received` 
        : `Customer accepted final quotation`;
      nextAction = "Order handoff / supply fulfilment";
      nextActionDue = null;

      // Log Won Activity
      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `🎉 Opportunity marked WON! Reason: ${wonReason}. Winning Quote: ${winningQuoteId || "N/A"}`,
        mentioned_user_ids: "[]",
        pinned: true,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });

      // Automatically trigger order creation from final quote idempotently
      if (winningQuoteId) {
        try {
          const orderRes = await createOrderFromFinalQuote(winningQuoteId, toValidUuid(actorId) || toValidUuid(d.ownerId) || undefined, {
            notes: `Auto-generated from Won Opportunity ${d.name}`
          });
          const ord = orderRes.order as any;
          createdOrderId = ord?.id;

          await sequelize.models.Activity.create({
            id: crypto.randomUUID(),
            leadId: d.leadId || null,
            customerId: d.accountId || null,
            type: "note",
            outcome: `Sales Order #${ord?.orderNumber || ord?.id?.slice(0, 8) || "SO-CONFIRMED"} created for supply fulfillment.`,
            mentioned_user_ids: "[]",
            pinned: true,
            createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
            direction: "internal"
          });
        } catch (err: any) {
          console.warn("Order creation notice:", err.message);
        }
      }

      // Notify Sales Rep and Team Leads
      if (d.ownerId) {
        await createNotification({
          userId: d.ownerId,
          type: "OPPORTUNITY_WON",
          title: "🎉 Opportunity Won!",
          message: `Congratulations! Opportunity '${d.name}' was marked WON.`
        });
      }

      const managers = await sequelize.models.User.findAll({
        where: { role: ["manager", "admin", "director"] }
      });
      for (const mgr of managers) {
        await createNotification({
          userId: (mgr as any).id,
          type: "OPPORTUNITY_WON",
          title: "Opportunity Closed Won",
          message: `Opportunity '${d.name}' (₹${Number(d.amount || 0).toLocaleString()}) won by ${d.owner?.name || "Rep"}.`
        });
      }
      break;
    }

    case "MarkLost": {
      if (!payload.lossReason) {
        throw new Error("Loss Reason is mandatory when marking an Opportunity as Lost.");
      }
      nextStatus = "LOST";
      lostAt = new Date();
      lostBy = toValidUuid(actorId);
      lossReason = payload.lossReason;
      lossNotes = payload.lossNotes || null;
      nextActivity = `Opportunity marked LOST: ${lossReason}`;
      nextAction = "Closed Lost - Record lessons learned";
      nextActionDue = null;

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: d.leadId || null,
        customerId: d.accountId || null,
        type: "note",
        outcome: `Opportunity marked LOST. Reason: ${lossReason}. Notes: ${lossNotes || "None"}`,
        mentioned_user_ids: "[]",
        pinned: true,
        createdById: toValidUuid(actorId) || toValidUuid(d.ownerId) || null,
        direction: "internal"
      });

      if (d.ownerId) {
        await createNotification({
          userId: d.ownerId,
          type: "OPPORTUNITY_LOST",
          title: "Opportunity Closed Lost",
          message: `Opportunity '${d.name}' marked Lost (${lossReason}).`
        });
      }
      break;
    }

    default: {
      nextActivity = payload.activity || d.currentActivity || "Active Commercial Opportunity";
      break;
    }
  }

  // Calculate health
  const healthEvaluation = calculateOpportunityHealth(lastCustomerActivityAt, nextActionDue);

  // Store idempotency key
  if (event.eventId) {
    processedKeys.push(event.eventId);
  }

  // Update Deal model
  await d.update({
    status: nextStatus,
    healthStatus: healthEvaluation.health,
    currentActivity: nextActivity,
    nextAction,
    nextActionDue,
    wonAt,
    winningQuoteId,
    wonReason,
    lostAt,
    lostBy,
    lossReason,
    lossNotes,
    lastCustomerActivityAt,
    idempotencyKeys: JSON.stringify(processedKeys)
  });

  return {
    success: true,
    opportunityId,
    status: nextStatus,
    healthStatus: healthEvaluation.health,
    currentActivity: nextActivity,
    nextAction,
    nextActionDue,
    orderId: createdOrderId,
    message: `Processed event '${type}' for Opportunity '${d.name}'. Status: ${nextStatus}.`
  };
}
