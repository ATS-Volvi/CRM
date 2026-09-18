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
  SupportTicket
} from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

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
        { model: WorkOrderLineItem, as: "lineItems" },
        { model: ServiceAppointment, as: "serviceAppointments" }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.status(200).json(workOrders);
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
      country: country || null
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

    return res.status(201).json(createdRecord);
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
        { model: WorkOrderLineItem, as: "lineItems" },
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

    return res.status(200).json(workOrder);
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
      country
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

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error("Error updating work order:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

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

    return res.status(200).json(appointments);
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

    return res.status(201).json(created);
  } catch (error: any) {
    console.error("Error creating service appointment:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
