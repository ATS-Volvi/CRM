import { Router } from "express";
import { sendMessage, getConversations, getMessages, verifyWebhook, handleIncomingWebhook } from "../controllers/whatsappController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public Webhooks for Meta WhatsApp Cloud API
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleIncomingWebhook);

// Authenticated CRM Endpoints
router.post("/send", authMiddleware, sendMessage);
router.get("/conversations", authMiddleware, getConversations);
router.get("/messages/:targetId", authMiddleware, getMessages);

export default router;
