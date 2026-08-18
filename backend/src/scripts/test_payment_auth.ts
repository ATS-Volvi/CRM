import { createPayment } from "../controllers/paymentController";
import { Request, Response } from "express";

async function runTest() {
  const req = {
    user: { role: "sales_rep", userId: "test-user-id" },
    params: { invoiceId: "test-invoice-id" },
    body: { amount: 100 }
  } as unknown as Request;

  const res: any = {
    statusCode: 200,
    data: null,
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      this.data = data;
      return this;
    }
  };

  await createPayment(req, res);
  
  console.log(`Response Status: ${res.statusCode}`);
  console.log(`Response Data:`, res.data);
}

runTest().catch(console.error);
