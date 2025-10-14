import express from "express";
import { sendMessage, resetSession, getHistory, healthCheck } from "../controllers/chatController.js";

const router = express.Router();

/**
 * Chat Routes
 */

// שליחת הודעה
router.post("/message", sendMessage);

// איפוס סשן
router.post("/reset", resetSession);

// קבלת היסטוריה
router.get("/history/:sessionId", getHistory);

// בדיקת בריאות
router.get("/health", healthCheck);

export default router;
