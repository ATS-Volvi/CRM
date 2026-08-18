import { createSupportTicket } from "../controllers/supportTicketController";
import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

async function runTest() {
  const { Account, Asset, User } = sequelize.models;

  // Find a random user, account, and asset
  const user: any = await User.findOne({ where: { role: "senior_ae" } });
  const account: any = await Account.findOne();
  const asset: any = await Asset.findOne();

  if (!user || !account || !asset) {
    console.log("Could not find required test data.");
    return;
  }

  // Create a mock req/res
  const req = {
    user: { role: "senior_ae", userId: user.id },
    body: { accountId: account.id, assetId: asset.id, category: "issue", description: "E2E Test Ticket" }
  } as unknown as Request;

  let responseData: any = null;
  const res: any = {
    statusCode: 200,
    status: function (code: number) { this.statusCode = code; return this; },
    json: function (data: any) { responseData = data; return this; }
  };

  // Trigger controller
  await createSupportTicket(req, res);

  console.log(`[Response] Ticket ID: ${responseData.id}, Status: ${responseData.status}`);
  console.log(`[Response] Linked Account ID: ${responseData.accountId}, Asset ID: ${responseData.assetId}`);

  process.exit(0);
}

runTest().catch(e => { console.error(e); process.exit(1); });
