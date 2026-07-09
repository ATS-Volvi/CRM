import { Router } from "express";
import { sendMessage, verifyWebhook, handleIncomingWebhook } from "../controllers/whatsappController";

const router = Router();

router.post("/send", sendMessage);
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleIncomingWebhook);

export default router;
