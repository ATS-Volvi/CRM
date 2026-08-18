import { createPayment } from "../controllers/paymentController";
import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

async function runTest() {
  const { Invoice, User } = sequelize.models;

  // Find a random user and an unpaid invoice
  const user: any = await User.findOne({ where: { role: "senior_ae" } });
  const invoice: any = await Invoice.findOne({ where: { paymentStatus: "unpaid" } });

  if (!user || !invoice) {
    console.log("Could not find required test data.");
    return;
  }

  console.log(`[Before] Invoice ID: ${invoice.id}, Total: ${invoice.totalAmount}, Paid: ${invoice.amountPaid}, Status: ${invoice.paymentStatus}`);

  // Create a mock req/res
  const req = {
    user: { role: "senior_ae", userId: user.id },
    params: { invoiceId: invoice.id },
    body: { amount: 50, method: "card", reference: "TEST-E2E-123" }
  } as unknown as Request;

  let responseData: any = null;
  const res: any = {
    statusCode: 200,
    status: function (code: number) { this.statusCode = code; return this; },
    json: function (data: any) { responseData = data; return this; }
  };

  // Trigger controller
  await createPayment(req, res);

  // Fetch from DB directly to prove transaction worked
  const updatedInvoice: any = await Invoice.findByPk(invoice.id);
  console.log(`[After]  Invoice ID: ${updatedInvoice.id}, Total: ${updatedInvoice.totalAmount}, Paid: ${updatedInvoice.amountPaid}, Status: ${updatedInvoice.paymentStatus}`);
  
  // Clean up test data
  const { Payment } = sequelize.models;
  await Payment.destroy({ where: { reference: "TEST-E2E-123" } });
  // We won't revert the invoice just to let the raw PSQL query catch it after.
  process.exit(0);
}

runTest().catch(e => { console.error(e); process.exit(1); });
