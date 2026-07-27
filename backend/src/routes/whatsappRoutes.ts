import { Router } from "express";
import { sendMessage, verifyWebhook, handleIncomingWebhook } from "../controllers/whatsappController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/send", authMiddleware, sendMessage);
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleIncomingWebhook);

export default router;
