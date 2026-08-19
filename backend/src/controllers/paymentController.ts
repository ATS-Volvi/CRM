import { Request, Response } from "express";
import crypto from "crypto";
import { sequelize } from "@nexus-crm/database";
import { Transaction } from "sequelize";

// Admin, manager, senior_ae, director check
const checkAccess = (role: string) => ["admin", "manager", "senior_ae", "director"].includes(role?.toLowerCase());

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = (req as any).user?.role || "";
    if (!checkAccess(userRole)) {
      res.status(403).json({ error: "Access denied. Only admin, manager, or senior_ae can record payments." });
      return;
    }

    const invoiceId = req.params.invoiceId;
    const { amount, paymentDate, method, reference } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: "Payment amount must be a positive number." });
      return;
    }

    const { Invoice, Payment, User } = sequelize.models;

    const invoice: any = await Invoice.findByPk(String(invoiceId));
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // Run within transaction to ensure Invoice aggregates are updated
    await sequelize.transaction(async (t: Transaction) => {
      await Payment.create(
        {
          id: crypto.randomUUID(),
          invoiceId,
          amount: Number(amount),
          paymentDate: paymentDate || new Date(),
          method: method || "bank_transfer",
          reference: reference || null,
          recordedBy: userId || null,
        },
        { transaction: t }
      );

      // Re-calculate total amount paid for this invoice
      const payments: any[] = await Payment.findAll({ where: { invoiceId }, transaction: t });
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      const invoiceTotal = Number(invoice.totalAmount);
      let status = "unpaid";
      if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
        status = "paid";
      } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
        status = "overdue";
      } else if (totalPaid > 0) {
        status = "partial";
      }

      await invoice.update(
        {
          amountPaid: totalPaid,
          paymentStatus: status,
        },
        { transaction: t }
      );
    });

    const updatedInvoice = await Invoice.findByPk(String(invoiceId), {
      include: [
        {
          model: Payment,
          as: "payments",
          include: [{ model: User, as: "recordedByUser", attributes: ["id", "name", "email"] }]
        }
      ]
    });

    res.status(201).json(updatedInvoice);
  } catch (error: any) {
    console.error("[createPayment]", error);
    res.status(500).json({ error: "Failed to record payment" });
  }
};

export const getPaymentsForInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Invoice, Payment, User } = sequelize.models;
    const invoiceId = req.params.invoiceId;

    const invoice = await Invoice.findByPk(String(invoiceId), {
      include: [
        {
          model: Payment,
          as: "payments",
          include: [{ model: User, as: "recordedByUser", attributes: ["id", "name", "email"] }]
        }
      ]
    });

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    res.json(invoice);
  } catch (error: any) {
    console.error("[getPaymentsForInvoice]", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};
