import express from "express";
import { sendMessage, resetSession, getHistory, healthCheck } from "../controllers/chatController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Chat Routes
 * All routes require authentication
 */

// Message route (protected)
router.post("/message", requireAuth, sendMessage);

// Reset session (protected)
router.post("/reset", requireAuth, resetSession);

// History retrieval (protected)
router.get("/history/:sessionId", requireAuth, getHistory);

// Health check (public)
router.get("/health", healthCheck);

export default router;
