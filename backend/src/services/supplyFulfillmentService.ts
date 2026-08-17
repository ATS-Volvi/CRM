import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { createNotification } from "./notificationService";

export const FULFILLMENT_STAGES = [
  "PENDING",
  "PLANNING",
  "PROCUREMENT",
  "IN_PRODUCTION",
  "READY",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED"
] as const;

export const VALID_TRANSITIONS: Record<string, string[]> = {
  "PENDING": ["PLANNING", "ON_HOLD", "CANCELLED"],
  "PLANNING": ["PROCUREMENT", "IN_PRODUCTION", "ON_HOLD", "CANCELLED"],
  "PROCUREMENT": ["IN_PRODUCTION", "READY", "ON_HOLD", "CANCELLED"],
  "IN_PRODUCTION": ["READY", "ON_HOLD", "CANCELLED"],
  "READY": ["DISPATCHED", "ON_HOLD", "CANCELLED"],
  "DISPATCHED": ["DELIVERED", "ON_HOLD", "CANCELLED"],
  "DELIVERED": ["COMPLETED", "ON_HOLD"],
  "ON_HOLD": ["PENDING", "PLANNING", "PROCUREMENT", "IN_PRODUCTION", "READY", "DISPATCHED", "CANCELLED"],
  "CANCELLED": [],
  "COMPLETED": []
};

/**
 * Transactional, Idempotent Order Creation from Final Agreed Quote
 */
export async function createOrderFromFinalQuote(
  quoteId: string,
  userId?: string,
  options?: {
    deliveryAddress?: string;
    requestedDeliveryDate?: Date;
    notes?: string;
  }
) {
  return await sequelize.transaction(async (t) => {
    // 1. Idempotency Check: Return existing order if already created from this quote
    const existingOrder = await sequelize.models.PurchaseOrder.findOne({
      where: { quoteId },
      include: [
        {
          model: sequelize.models.Fulfillment,
          as: "fulfillment",
          include: [{ model: sequelize.models.FulfillmentItem, as: "items" }]
        },
        {
          model: sequelize.models.Quote,
          as: "quote",
          include: [
            {
              model: sequelize.models.Deal,
              as: "deal",
              include: [{ model: sequelize.models.Account, as: "account" }]
            }
          ]
        }
      ],
      transaction: t
    });

    if (existingOrder) {
      return {
        order: existingOrder,
        orderNumber: (existingOrder as any).poNumber,
        quote: (existingOrder as any).quote,
        accountId: (existingOrder as any).quote?.deal?.accountId || (existingOrder as any).quote?.deal?.customerId,
        opportunityId: (existingOrder as any).quote?.dealId,
        fulfillment: (existingOrder as any).fulfillment,
        isExisting: true
      };
    }

    // 2. Fetch Quote with relations
    const quote = await sequelize.models.Quote.findByPk(quoteId, {
      include: [
        { model: sequelize.models.QuoteLineItem, as: "QuoteLineItems" },
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            { model: sequelize.models.Account, as: "account" },
            { model: sequelize.models.User, as: "owner" }
          ]
        }
      ],
      transaction: t
    });

    if (!quote) throw new Error("Quote not found.");
    const q = quote as any;

    // 3. Validation Rules
    if (!q.dealId) throw new Error("Quote is not associated with an Opportunity.");
    if (q.status === "Superseded") throw new Error("Cannot create order from a superseded quote revision.");
    if (q.status === "Cancelled" || q.status === "Rejected") throw new Error(`Cannot create order from a ${q.status.toLowerCase()} quote.`);

    const isApproved = q.status === "Approved" || q.status === "Accepted" || q.isFinalAgreed === true;
    if (!isApproved) {
      throw new Error(`Quote is in status '${q.status}', but must be approved or accepted before creating an order.`);
    }

    const accountId = q.deal?.accountId || q.deal?.customerId;
    if (!accountId) {
      throw new Error("Opportunity must belong to an Account before creating an order.");
    }

    // 4. Generate unique Order Number (ORD-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const count = await sequelize.models.PurchaseOrder.count({ transaction: t });
    const entropy = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${year}-${String(count + 1).padStart(5, "0")}-${entropy}`;

    const orderId = crypto.randomUUID();
    const salesOwnerId = q.deal?.ownerId || userId || null;

    // 5. Create Order (PurchaseOrder)
    const order = await sequelize.models.PurchaseOrder.create(
      {
        id: orderId,
        quoteId: q.id,
        amount: q.totalAmount,
        status: "Confirmed",
        poNumber: orderNumber,
        generatedDate: new Date(),
        salesOwnerId: salesOwnerId,
        notes: options?.notes || null,
        deliveryAddress: options?.deliveryAddress || null,
        requestedDeliveryDate: options?.requestedDeliveryDate || null
      },
      { transaction: t }
    );

    // 6. Create Primary Fulfillment Record (Status: PENDING)
    const fulfillmentId = crypto.randomUUID();
    const fulfillment = await sequelize.models.Fulfillment.create(
      {
        id: fulfillmentId,
        orderId: orderId,
        status: "PENDING",
        priority: "MEDIUM",
        assignedTeam: "Operations / Supply",
        assignedUserId: null,
        deliveryAddress: options?.deliveryAddress || null,
        requestedDeliveryDate: options?.requestedDeliveryDate || null,
        notes: options?.notes || null
      },
      { transaction: t }
    );

    // 7. Create FulfillmentItems from QuoteLineItems
    const lineItems = q.QuoteLineItems || [];
    const fulfillmentItems = [];

    for (const item of lineItems) {
      const pEntry = item.productId
        ? await sequelize.models.PriceBookEntry.findByPk(item.productId, { transaction: t })
        : null;

      const fItem = await sequelize.models.FulfillmentItem.create(
        {
          id: crypto.randomUUID(),
          fulfillmentId: fulfillmentId,
          quoteLineItemId: item.id,
          productServiceId: item.productId || null,
          description: item.customDescription || (pEntry as any)?.name || "Line Item",
          quantityPlanned: Number(item.quantity) || 1,
          quantityAllocated: 0,
          quantityInProduction: 0,
          quantityReady: 0,
          quantityDispatched: 0,
          quantityDelivered: 0,
          status: "PENDING"
        },
        { transaction: t }
      );
      fulfillmentItems.push(fItem);
    }

    // 8. Universal Activity Audit Logging
    await sequelize.models.Activity.create(
      {
        id: crypto.randomUUID(),
        leadId: null,
        customerId: accountId,
        type: "note",
        outcome: `Order ${orderNumber} created from Quote ${q.quoteNumber || q.id} v${q.version} (Amount: ₹${Number(q.totalAmount).toLocaleString()}). Fulfillment PENDING created.`,
        mentioned_user_ids: "[]",
        pinned: true,
        createdById: userId || salesOwnerId || null,
        direction: "internal"
      },
      { transaction: t }
    );

    // 9. Dispatch Role-Based Notifications
    // Notify Supply Team / Admin
    const adminUser = await sequelize.models.User.findOne({ where: { role: "admin" }, transaction: t });
    if (adminUser) {
      createNotification(
        (adminUser as any).id,
        "ORDER_FULFILLMENT_READY",
        `New Order Ready for Fulfillment: ${orderNumber}`,
        `Order ${orderNumber} (₹${Number(q.totalAmount).toLocaleString()}) has been confirmed and is awaiting supply fulfillment planning.`,
        `/supply/queue`
      ).catch(e => console.error("Supply notification error:", e));
    }

    // Notify Sales Owner
    if (salesOwnerId) {
      createNotification(
        salesOwnerId,
        "ORDER_CREATED",
        `Order Confirmed: ${orderNumber}`,
        `Your opportunity ${q.deal?.name || ""} has been converted to confirmed Order ${orderNumber}. Supply team has been notified.`,
        `/orders/${orderId}`
      ).catch(e => console.error("Sales rep notification error:", e));
    }

    return {
      order,
      orderNumber,
      quote: q,
      accountId,
      opportunityId: q.dealId,
      fulfillment,
      fulfillmentItems,
      isExisting: false
    };
  });
}

/**
 * Update Fulfillment Status with Validation and Asset Generation
 */
export async function updateFulfillmentStatus(
  fulfillmentId: string,
  newStatus: string,
  updates?: {
    assignedUserId?: string;
    plannedStartDate?: Date;
    plannedCompletionDate?: Date;
    actualStartDate?: Date;
    actualCompletionDate?: Date;
    dispatchReference?: string;
    carrier?: string;
    actualDeliveryDate?: Date;
    notes?: string;
    reason?: string;
  },
  userId?: string
) {
  return await sequelize.transaction(async (t) => {
    const fulfillment = await sequelize.models.Fulfillment.findByPk(fulfillmentId, {
      include: [
        { model: sequelize.models.FulfillmentItem, as: "items" },
        {
          model: sequelize.models.PurchaseOrder,
          as: "order",
          include: [
            {
              model: sequelize.models.Quote,
              as: "quote",
              include: [
                {
                  model: sequelize.models.Deal,
                  as: "deal",
                  include: [{ model: sequelize.models.Account, as: "account" }]
                }
              ]
            }
          ]
        }
      ],
      transaction: t
    });

    if (!fulfillment) throw new Error("Fulfillment record not found.");
    const f = fulfillment as any;
    const currentStatus = f.status;

    // Validate Transition
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus) && currentStatus !== newStatus) {
      throw new Error(`Invalid stage transition: cannot move fulfillment from '${currentStatus}' directly to '${newStatus}'. Allowed: ${allowed.join(", ")}`);
    }

    // Stage Specific Validation
    if (newStatus === "DISPATCHED" && !updates?.dispatchReference && !f.dispatchReference) {
      throw new Error("Dispatch reference / tracking number is required to move to DISPATCHED.");
    }

    const payload: any = {
      status: newStatus,
      updatedAt: new Date()
    };

    if (updates?.assignedUserId) payload.assignedUserId = updates.assignedUserId;
    if (updates?.plannedStartDate) payload.plannedStartDate = updates.plannedStartDate;
    if (updates?.plannedCompletionDate) payload.plannedCompletionDate = updates.plannedCompletionDate;
    if (updates?.actualStartDate) payload.actualStartDate = updates.actualStartDate;
    if (updates?.actualCompletionDate) payload.actualCompletionDate = updates.actualCompletionDate;
    if (updates?.dispatchReference) payload.dispatchReference = updates.dispatchReference;
    if (updates?.carrier) payload.carrier = updates.carrier;
    if (updates?.notes) payload.notes = updates.notes;

    if (newStatus === "IN_PRODUCTION" && !f.actualStartDate) {
      payload.actualStartDate = updates?.actualStartDate || new Date();
    }
    if (newStatus === "DISPATCHED" && !f.actualStartDate) {
      payload.actualStartDate = new Date();
    }
    if ((newStatus === "DELIVERED" || newStatus === "COMPLETED") && !f.actualDeliveryDate) {
      payload.actualDeliveryDate = updates?.actualDeliveryDate || new Date();
      payload.actualCompletionDate = updates?.actualCompletionDate || new Date();
    }

    await f.update(payload, { transaction: t });

    // Update corresponding PurchaseOrder status
    let orderStatus = "In Fulfillment";
    if (newStatus === "DELIVERED") orderStatus = "Delivered";
    if (newStatus === "COMPLETED") orderStatus = "Completed";
    if (newStatus === "ON_HOLD") orderStatus = "On Hold";
    if (newStatus === "CANCELLED") orderStatus = "Cancelled";

    if (f.order) {
      await f.order.update({ status: orderStatus }, { transaction: t });
    }

    // ── Asset Generation on DELIVERED or COMPLETED ────────────
    const createdAssets = [];
    if (newStatus === "DELIVERED" || newStatus === "COMPLETED") {
      const items = f.items || [];
      const accountId = f.order?.quote?.deal?.accountId || f.order?.quote?.deal?.customerId;
      const orderId = f.orderId;

      for (const item of items) {
        // Check if item qualifies for Asset tracking
        let isTracked = true;
        let pEntry: any = null;

        if (item.productServiceId) {
          pEntry = await sequelize.models.PriceBookEntry.findByPk(item.productServiceId, { transaction: t });
          if (pEntry && pEntry.isAssetTracked === false) {
            isTracked = false;
          }
        }

        if (!isTracked) {
          continue; // Non-asset tracked item (service, charge, training)
        }

        const qty = Number(item.quantityPlanned) || 1;

        // Idempotency: Count existing assets for this order & item
        const existingAssetsCount = await sequelize.models.Asset.count({
          where: {
            orderId: orderId,
            orderItemId: item.id
          },
          transaction: t
        });

        const assetsToCreate = qty - existingAssetsCount;
        const year = new Date().getFullYear();

        for (let i = 0; i < assetsToCreate; i++) {
          const indexNum = existingAssetsCount + i + 1;
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const assetNumber = `AST-${year}-${String(randomSuffix)}-${indexNum}`;
          const serialNumber = `SN-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

          const newAsset = await sequelize.models.Asset.create(
            {
              id: crypto.randomUUID(),
              name: item.description || pEntry?.name || "Equipment Asset",
              type: pEntry?.category || "Equipment",
              serialNumber: serialNumber,
              assetNumber: assetNumber,
              modelNumber: pEntry?.sku || null,
              description: item.description || null,
              status: "Active",
              condition: "Good",
              customerId: accountId,
              dealId: f.order?.quote?.dealId || null,
              orderId: orderId,
              orderItemId: item.id,
              productServiceId: item.productServiceId || null,
              location: f.deliveryAddress || "Customer Site",
              installationDate: payload.actualDeliveryDate || new Date(),
              commissionDate: payload.actualDeliveryDate || new Date(),
              warrantyStart: payload.actualDeliveryDate || new Date(),
              warrantyEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year warranty
              purchaseDate: f.order?.generatedDate || new Date(),
              deployedAt: payload.actualDeliveryDate || new Date(),
              notes: `Generated automatically upon fulfillment ${newStatus} of Order ${f.order?.poNumber || orderId}`
            },
            { transaction: t }
          );

          createdAssets.push(newAsset);
        }
      }
    }

    // Universal Activity Logging
    const accountId = f.order?.quote?.deal?.accountId || f.order?.quote?.deal?.customerId;
    await sequelize.models.Activity.create(
      {
        id: crypto.randomUUID(),
        leadId: null,
        customerId: accountId,
        type: "note",
        outcome: `Fulfillment status changed: ${currentStatus} → ${newStatus} for Order ${f.order?.poNumber || f.orderId}${updates?.reason ? ` (Reason: ${updates.reason})` : ""}${createdAssets.length > 0 ? `. Generated ${createdAssets.length} customer assets.` : ""}`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: userId || f.order?.salesOwnerId || f.assignedUserId || null,
        direction: "internal"
      },
      { transaction: t }
    );

    // Dispatch Notifications
    const salesOwnerId = f.order?.salesOwnerId || f.order?.quote?.deal?.ownerId;
    if (salesOwnerId) {
      createNotification(
        salesOwnerId,
        "FULFILLMENT_STATUS_CHANGED",
        `Order Fulfillment Updated: ${newStatus}`,
        `Order ${f.order?.poNumber || f.orderId} fulfillment status is now ${newStatus}.`,
        `/orders/${f.orderId}`
      ).catch(e => console.error("Sales rep notification error:", e));
    }

    return {
      fulfillment: f,
      previousStatus: currentStatus,
      newStatus,
      createdAssets
    };
  });
}

/**
 * Partial Delivery / Fulfillment Item Quantity Update
 */
export async function updateFulfillmentItem(
  itemId: string,
  updates: {
    quantityPlanned?: number;
    quantityAllocated?: number;
    quantityInProduction?: number;
    quantityReady?: number;
    quantityDispatched?: number;
    quantityDelivered?: number;
    status?: string;
  },
  userId?: string
) {
  return await sequelize.transaction(async (t) => {
    const item = await sequelize.models.FulfillmentItem.findByPk(itemId, {
      include: [
        {
          model: sequelize.models.Fulfillment,
          as: "fulfillment",
          include: [{ model: sequelize.models.FulfillmentItem, as: "items" }]
        }
      ],
      transaction: t
    });

    if (!item) throw new Error("Fulfillment item not found.");
    const fItem = item as any;

    await fItem.update(updates, { transaction: t });

    // Check parent fulfillment partial delivery status
    const allItems = fItem.fulfillment?.items || [];
    let totalPlanned = 0;
    let totalDelivered = 0;

    for (const it of allItems) {
      const itQty = it.id === itemId ? (updates.quantityPlanned ?? it.quantityPlanned) : it.quantityPlanned;
      const itDel = it.id === itemId ? (updates.quantityDelivered ?? it.quantityDelivered) : it.quantityDelivered;
      totalPlanned += Number(itQty) || 0;
      totalDelivered += Number(itDel) || 0;
    }

    if (totalDelivered > 0 && totalDelivered < totalPlanned) {
      await fItem.fulfillment.update({ status: "DISPATCHED" }, { transaction: t });
      await sequelize.models.PurchaseOrder.update(
        { status: "Partially Fulfilled" },
        { where: { id: fItem.fulfillment.orderId }, transaction: t }
      );
    } else if (totalDelivered >= totalPlanned && totalPlanned > 0) {
      await fItem.fulfillment.update({ status: "DELIVERED", actualDeliveryDate: new Date() }, { transaction: t });
      await sequelize.models.PurchaseOrder.update(
        { status: "Delivered" },
        { where: { id: fItem.fulfillment.orderId }, transaction: t }
      );
    }

    return fItem;
  });
}
