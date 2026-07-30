import { Router } from "express";
import {
  sendMessage,
  getConversations,
  getMessages,
  verifyWebhook,
  handleIncomingWebhook,
  getHealth,
  getLogs,
  runTestConnection,
  runTestWebhookSimulation,
  resolveLogEntry,
  clearLogHistory,
} from "../controllers/whatsappController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public Webhooks for Meta WhatsApp Cloud API
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleIncomingWebhook);

// Authenticated CRM Endpoints
router.post("/send", authMiddleware, sendMessage);
router.get("/conversations", authMiddleware, getConversations);
router.get("/messages/:targetId", authMiddleware, getMessages);

// Diagnostics & Error Logging Endpoints
router.get("/health", authMiddleware, getHealth);
router.get("/logs", authMiddleware, getLogs);
router.post("/logs/test-connection", authMiddleware, runTestConnection);
router.post("/logs/test-webhook", authMiddleware, runTestWebhookSimulation);
router.post("/logs/:id/resolve", authMiddleware, resolveLogEntry);
router.delete("/logs", authMiddleware, clearLogHistory);

export default router;
