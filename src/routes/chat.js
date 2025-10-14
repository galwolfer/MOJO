import express from "express";
import { sendMessage, resetSession, getHistory, healthCheck } from "../controllers/chatController.js";

const router = express.Router();

/**
 * Chat Routes
 */

// Message route
router.post("/message", sendMessage);

// Reset session
router.post("/reset", resetSession);

// History retrieval
router.get("/history/:sessionId", getHistory);

// Health check
router.get("/health", healthCheck);

export default router;
