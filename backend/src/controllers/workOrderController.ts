import { Request, Response } from "express";
import {
  WorkOrder,
  WorkOrderLineItem,
  ServiceResource,
  ServiceAppointment,
  Account,
  Contact,
  User,
  Asset,
  Deal,
  SupportTicket,
  Lead,
  PriceBookEntry,
  ApprovalRequest,
  DiscountPolicy,
  sequelize
} from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

/**
 * Helper to resolve read-only primary phone number and source label for a Work Order
 */
async function enrichWorkOrderPhone(workOrderRecord: any) {
  if (!workOrderRecord) return null;
  const json = workOrderRecord.toJSON ? workOrderRecord.toJSON() : { ...workOrderRecord };

  let primaryPhone: string | null = null;
  let phoneSource: string | null = null;

  // 1. Check contact phone
  if (json.contact && json.contact.phone && json.contact.phone.trim() !== "") {
    primaryPhone = json.contact.phone.trim();
    phoneSource = "via Contact";
  }
  // 2. Check account phone
  else if (json.account && json.account.phone && json.account.phone.trim() !== "") {
    primaryPhone = json.account.phone.trim();
    phoneSource = "via Account";
  }
  // 3. Fallback: query linked Lead for the account
  else if (json.accountId) {
    try {
      const linkedLead = await Lead.findOne({
        where: {
          [Op.or]: [
            { accountId: json.accountId },
            { convertedAccountId: json.accountId }
          ],
          phone: { [Op.ne]: null }
        },
        order: [["createdAt", "DESC"]]
      });
      if (linkedLead && (linkedLead as any).phone && (linkedLead as any).phone.trim() !== "") {
        primaryPhone = (linkedLead as any).phone.trim();
        phoneSource = "via Lead";
      }
    } catch (err) {
      console.warn("Error looking up linked lead for phone:", err);
    }
  }

  json.primaryPhone = primaryPhone;
  json.phoneSource = phoneSource;
  return json;
}

/**
 * GET /api/v1/work-orders
 * List work orders with optional status, priority, and accountId filters.
 */
export const getWorkOrders = async (req: Request, res: Response) => {
  try {
    const { status, priority, accountId, search } = req.query;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (priority && priority !== "ALL") {
      where.priority = priority;
    }
    if (accountId) {
      where.accountId = accountId;
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { subject: { [Op.like]: q } },
        { workOrderNumber: { [Op.like]: q } },
        { description: { [Op.like]: q } }
      ];
    }

    const workOrders = await WorkOrder.findAll({
      where,
      include: [
        { model: Account, as: "account", attributes: ["id", "name", "email", "phone"] },
        { model: Contact, as: "contact", attributes: ["id", "firstName", "lastName", "email", "phone"] },
        { model: User, as: "owner", attributes: ["id", "name", "email"] },
        { model: Asset, as: "asset", attributes: ["id", "name", "serialNumber"] },
        {
          model: WorkOrderLineItem,
          as: "lineItems",
          include: [{ model: PriceBookEntry, as: "priceBookEntry" }]
        },
        { model: ServiceAppointment, as: "serviceAppointments" }
      ],
      order: [["createdAt", "DESC"]]
    });

    const enriched = await Promise.all(workOrders.map((wo) => enrichWorkOrderPhone(wo)));
    return res.status(200).json(enriched);
  } catch (error: any) {
    console.error("Error fetching work orders:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/v1/work-orders
 * Create a new work order.
 */
export const createWorkOrder = async (req: Request, res: Response) => {
  try {
    const {
      subject,
      description,
      status = "New",
      priority = "Medium",
      accountId,
      contactId,
      dealId,
      assetId,
      supportTicketId,
      startDate,
      endDate,
      duration,
      durationInHours,
      street,
      city,
      state,
      postalCode,
      country,
      alternatePhone,
      lineItems
    } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const count = await WorkOrder.count();
    const workOrderNumber = `WO-${String(count + 1).padStart(5, "0")}`;
    const id = crypto.randomUUID();

    let subtotal = 0;
    let grandTotal = 0;

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      lineItems.forEach((li: any) => {
        const qty = parseFloat(li.quantity) || 1;
        const price = parseFloat(li.unitPrice) || 0;
        subtotal += qty * price;
      });
      grandTotal = subtotal;
    }

    const workOrder = await WorkOrder.create({
      id,
      workOrderNumber,
      subject,
      description: description || null,
      status,
      priority,
      accountId: accountId || null,
      contactId: contactId || null,
      dealId: dealId || null,
      assetId: assetId || null,
      supportTicketId: supportTicketId || null,
      ownerId: (req as any).user?.id || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      duration: duration || null,
      durationInHours: durationInHours || null,
      subtotal,
      totalPrice: subtotal,
      tax: 0,
      grandTotal,
      street: street || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      country: country || null,
      alternatePhone: alternatePhone || null
    });

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        await WorkOrderLineItem.create({
          id: crypto.randomUUID(),
          workOrderId: id,
          lineItemNumber: `${workOrderNumber}-${i + 1}`,
          status: item.status || "New",
          description: item.description || null,
          assetId: item.assetId || null,
          priceBookEntryId: item.priceBookEntryId || null,
          quantity: qty,
          unitPrice: price,
          totalPrice: qty * price
        });
      }
    }

    const createdRecord = await WorkOrder.findByPk(id, {
      include: [
        { model: Account, as: "account" },
        { model: Contact, as: "contact" },
        { model: User, as: "owner" },
        { model: WorkOrderLineItem, as: "lineItems" },
        { model: ServiceAppointment, as: "serviceAppointments" }
      ]
    });

    const enriched = await enrichWorkOrderPhone(createdRecord);
    return res.status(201).json(enriched);
  } catch (error: any) {
    console.error("Error creating work order:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/v1/work-orders/:id
 * Retrieve work order details including line items and service appointments.
 */
export const getWorkOrderById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const workOrder = await WorkOrder.findByPk(id, {
      include: [
        { model: Account, as: "account" },
        { model: Contact, as: "contact" },
        { model: User, as: "owner", attributes: ["id", "name", "email"] },
        { model: Asset, as: "asset" },
        { model: Deal, as: "deal" },
        { model: SupportTicket, as: "supportTicket" },
        {
          model: WorkOrderLineItem,
          as: "lineItems",
          include: [{ model: PriceBookEntry, as: "priceBookEntry" }]
        },
        {
          model: ServiceAppointment,
          as: "serviceAppointments",
          include: [{ model: ServiceResource, as: "serviceResource" }]
        }
      ]
    });

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const enriched = await enrichWorkOrderPhone(workOrder);
    return res.status(200).json(enriched);
  } catch (error: any) {
    console.error("Error fetching work order detail:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * PUT /api/v1/work-orders/:id
 * Update status, priority, or fields on a work order.
 */
export const updateWorkOrder = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const {
      status,
      priority,
      subject,
      description,
      accountId,
      contactId,
      assetId,
      startDate,
      endDate,
      street,
      city,
      state,
      postalCode,
      country,
      alternatePhone
    } = req.body;

    if (status !== undefined) workOrder.set("status", status);
    if (priority !== undefined) workOrder.set("priority", priority);
    if (subject !== undefined) workOrder.set("subject", subject);
    if (description !== undefined) workOrder.set("description", description);
    if (accountId !== undefined) workOrder.set("accountId", accountId || null);
    if (contactId !== undefined) workOrder.set("contactId", contactId || null);
    if (assetId !== undefined) workOrder.set("assetId", assetId || null);
    if (startDate !== undefined) workOrder.set("startDate", startDate ? new Date(startDate) : null);
    if (endDate !== undefined) workOrder.set("endDate", endDate ? new Date(endDate) : null);
    if (street !== undefined) workOrder.set("street", street);
    if (city !== undefined) workOrder.set("city", city);
    if (state !== undefined) workOrder.set("state", state);
    if (postalCode !== undefined) workOrder.set("postalCode", postalCode);
    if (country !== undefined) workOrder.set("country", country);
    if (alternatePhone !== undefined) workOrder.set("alternatePhone", alternatePhone || null);

    await workOrder.save();

    const updated = await WorkOrder.findByPk(id, {
      include: [
        { model: Account, as: "account" },
        { model: Contact, as: "contact" },
        { model: User, as: "owner" },
        { model: WorkOrderLineItem, as: "lineItems" },
        {
          model: ServiceAppointment,
          as: "serviceAppointments",
          include: [{ model: ServiceResource, as: "serviceResource" }]
        }
      ]
    });

    const enriched = await enrichWorkOrderPhone(updated);
    return res.status(200).json(enriched);
  } catch (error: any) {
    console.error("Error updating work order:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Helper to format appointment record with checkedInAt and checkedOutAt aliases
 */
function formatAppointment(appRecord: any) {
  if (!appRecord) return null;
  const json = appRecord.toJSON ? appRecord.toJSON() : { ...appRecord };
  return {
    ...json,
    checkedInAt: json.actualStartTime || null,
    checkedOutAt: json.actualEndTime || null
  };
}

/**
 * GET /api/v1/work-orders/:id/appointments
 * List appointments for a work order.
 */
export const getWorkOrderAppointments = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const appointments = await ServiceAppointment.findAll({
      where: { workOrderId: id },
      include: [
        { model: ServiceResource, as: "serviceResource" },
        { model: Contact, as: "contact" }
      ],
      order: [["scheduledStartTime", "ASC"], ["createdAt", "DESC"]]
    });

    return res.status(200).json(appointments.map(formatAppointment));
  } catch (error: any) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/v1/work-orders/:id/appointments
 * Schedule a new appointment for a work order.
 */
export const createWorkOrderAppointment = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const {
      serviceResourceId,
      contactId,
      status = "New",
      scheduledStartTime,
      scheduledEndTime,
      earliestStartTime,
      dueDate,
      duration,
      durationInHours,
      subject,
      description,
      street,
      city,
      state,
      postalCode,
      country
    } = req.body;

    const count = await ServiceAppointment.count();
    const appointmentNumber = `SA-${String(count + 1).padStart(5, "0")}`;
    const appointmentId = crypto.randomUUID();

    const appointment = await ServiceAppointment.create({
      id: appointmentId,
      appointmentNumber,
      parentRecordId: id,
      workOrderId: id,
      serviceResourceId: serviceResourceId || null,
      contactId: contactId || (workOrder as any).contactId || null,
      accountId: (workOrder as any).accountId || null,
      status,
      scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null,
      scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
      earliestStartTime: earliestStartTime ? new Date(earliestStartTime) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      duration: duration || null,
      durationInHours: durationInHours || null,
      subject: subject || (workOrder as any).subject || "Field Service Appointment",
      description: description || null,
      street: street || (workOrder as any).street || null,
      city: city || (workOrder as any).city || null,
      state: state || (workOrder as any).state || null,
      postalCode: postalCode || (workOrder as any).postalCode || null,
      country: country || (workOrder as any).country || null
    });

    const created = await ServiceAppointment.findByPk(appointmentId, {
      include: [
        { model: ServiceResource, as: "serviceResource" },
        { model: Contact, as: "contact" }
      ]
    });

    return res.status(201).json(formatAppointment(created || appointment));
  } catch (error: any) {
    console.error("Error creating service appointment:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * PUT /api/v1/work-orders/:id/appointments/:appointmentId
 * Update service appointment, including Check In and Check Out actions
 */
export const updateWorkOrderAppointment = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const appointmentId = String(req.params.appointmentId);
    const appointment = await ServiceAppointment.findOne({
      where: { id: appointmentId, workOrderId: id }
    });

    if (!appointment) {
      return res.status(404).json({ message: "Service Appointment not found" });
    }

    const {
      status,
      checkedInAt,
      checkedOutAt,
      actualStartTime,
      actualEndTime,
      serviceResourceId,
      description,
      subject,
      action
    } = req.body;

    const now = new Date();

    // Check In handling
    if (checkedInAt || actualStartTime) {
      appointment.actualStartTime = checkedInAt ? new Date(checkedInAt) : new Date(actualStartTime);
      if (!status || status === "Scheduled" || status === "Dispatched" || status === "New") {
        appointment.status = "In Progress";
      }
    } else if (action === "check-in") {
      appointment.actualStartTime = now;
      appointment.status = "In Progress";
    }

    // Check Out handling
    if (checkedOutAt || actualEndTime) {
      appointment.actualEndTime = checkedOutAt ? new Date(checkedOutAt) : new Date(actualEndTime);
      if (!status || status === "In Progress") {
        appointment.status = "Completed";
      }
    } else if (action === "check-out") {
      appointment.actualEndTime = now;
      appointment.status = "Completed";
    }

    // Compute duration if both start and end exist
    if (appointment.actualStartTime && appointment.actualEndTime) {
      const diffMs = new Date(appointment.actualEndTime).getTime() - new Date(appointment.actualStartTime).getTime();
      const diffMins = Math.max(0, Math.round(diffMs / 60000));
      appointment.actualDuration = diffMins;
      appointment.durationInHours = Number((diffMins / 60).toFixed(2));
    }

    if (status) {
      appointment.status = status;
    }
    if (serviceResourceId !== undefined) {
      appointment.serviceResourceId = serviceResourceId || null;
    }
    if (description !== undefined) {
      appointment.description = description;
    }
    if (subject !== undefined) {
      appointment.subject = subject;
    }

    await appointment.save();

    const reloaded = await ServiceAppointment.findByPk(appointmentId, {
      include: [
        { model: ServiceResource, as: "serviceResource" },
        { model: Contact, as: "contact" }
      ]
    });

    return res.status(200).json(formatAppointment(reloaded || appointment));
  } catch (error: any) {
    console.error("Error updating service appointment:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/v1/work-orders/:id/line-items
 * Add a line item to an existing work order and update totals.
 */
export const createWorkOrderLineItem = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const { description, quantity = 1, unitPrice = 0, status = "New", assetId, priceBookEntryId } = req.body;

    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unitPrice) || 0;
    const totalPrice = qty * price;

    let pbe: any = null;
    let approvalRequired = false;
    let approvalMessage = "";

    if (priceBookEntryId) {
      pbe = await PriceBookEntry.findByPk(priceBookEntryId);
    }

    if (pbe) {
      // Find configured rep discount policy
      let repDiscountLimit = 0.10;
      if (sequelize.models.DiscountPolicy) {
        const policy: any = await sequelize.models.DiscountPolicy.findOne({
          where: { role: "Sales Rep", isActive: true }
        });
        if (policy) repDiscountLimit = Number(policy.maxDiscountPercent) / 100;
      }

      // Check minPrice floor
      const catalogFloor = pbe.minPrice !== null && pbe.minPrice !== undefined
        ? Number(pbe.minPrice)
        : Math.round(Number(pbe.unitPrice) * (1 - repDiscountLimit));

      if (price < catalogFloor) {
        approvalRequired = true;
        approvalMessage = `Work Order ${(workOrder as any).workOrderNumber || "WO"} line item "${pbe.name}" unit price (₹${price.toLocaleString()}) is below catalog floor price of ₹${catalogFloor.toLocaleString()} (SKU: ${pbe.sku}). Manager approval required.`;

        // Invalidate any previous Pending Approval requests for this WO
        await ApprovalRequest.update(
          { status: "Invalidated" },
          { where: { targetId: id, type: "WorkOrder", status: "Pending" } }
        );

        // Create new ApprovalRequest
        await ApprovalRequest.create({
          id: crypto.randomUUID(),
          type: "WorkOrder",
          targetId: id,
          status: "Pending",
          requestedById: (req as any).user?.id || (workOrder as any).ownerId || null,
          comments: approvalMessage
        });
      }
    }

    const existingCount = await WorkOrderLineItem.count({ where: { workOrderId: id } });
    const lineItemNumber = `${(workOrder as any).workOrderNumber || "WO"}-${existingCount + 1}`;
    const lineItemId = crypto.randomUUID();

    const lineItem = await WorkOrderLineItem.create({
      id: lineItemId,
      workOrderId: id,
      lineItemNumber,
      status: approvalRequired ? "Pending Approval" : status,
      description: description || pbe?.name || null,
      assetId: assetId || null,
      priceBookEntryId: pbe ? pbe.id : null,
      quantity: qty,
      unitPrice: price,
      totalPrice
    });

    // Recalculate totals on parent work order
    const allItems = await WorkOrderLineItem.findAll({ where: { workOrderId: id } });
    const newSubtotal = allItems.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);

    await workOrder.update({
      subtotal: newSubtotal,
      totalPrice: newSubtotal,
      grandTotal: newSubtotal,
      ...(approvalRequired ? { status: "Pending Approval" } : {})
    });

    const itemWithEntry = await WorkOrderLineItem.findByPk(lineItemId, {
      include: [{ model: PriceBookEntry, as: "priceBookEntry" }]
    });

    return res.status(201).json({
      ...(itemWithEntry ? itemWithEntry.toJSON() : lineItem.toJSON()),
      approvalRequired,
      approvalMessage: approvalRequired ? approvalMessage : undefined
    });
  } catch (error: any) {
    console.error("Error adding work order line item:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * DELETE /api/v1/work-orders/:id/line-items/:lineItemId
 * Delete a line item from a work order and update totals.
 */
export const deleteWorkOrderLineItem = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const lineItemId = String(req.params.lineItemId);

    const workOrder = await WorkOrder.findByPk(id);
    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const item = await WorkOrderLineItem.findOne({
      where: { id: lineItemId, workOrderId: id }
    });

    if (!item) {
      return res.status(404).json({ message: "Line item not found" });
    }

    await item.destroy();

    // Recalculate totals
    const allItems = await WorkOrderLineItem.findAll({ where: { workOrderId: id } });
    const newSubtotal = allItems.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);

    await workOrder.update({
      subtotal: newSubtotal,
      totalPrice: newSubtotal,
      grandTotal: newSubtotal
    });

    return res.status(200).json({ message: "Line item deleted successfully", grandTotal: newSubtotal });
  } catch (error: any) {
    console.error("Error deleting work order line item:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

