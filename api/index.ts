import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "../backend/server";
import { Database, sequelize } from "@nexus-crm/database";

const app = createServer();
let isInitialized = false;

async function initializeApp() {
  if (!isInitialized) {
    try {
      await Database.createConnection();
      if (sequelize.models.WhatsAppLog) {
        await sequelize.models.WhatsAppLog.sync().catch(err => console.error("Failed to sync WhatsAppLog model:", err));
      }
      const { seedDefaultMessageTemplates } = require("../backend/src/services/communicationService");
      await seedDefaultMessageTemplates().catch(() => {});
      isInitialized = true;
      console.log("[Vercel Serverless] Backend initialized and connected to database.");
    } catch (err) {
      console.error("[Vercel Serverless] Failed to initialize database:", err);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  return (app as any)(req, res);
}
