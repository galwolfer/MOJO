/*
 * File: src/routes/chat.js
 * Purpose: Chat-related routes (message, reset, history, sessions)
 */

import express from "express";
import {
  sendMessage,
  resetSession,
  getHistory,
  healthCheck,
  getSessions,
  getUserSessionsDoc,
} from "../controllers/chatController.js";
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

// Sessions list (protected)
router.get("/sessions", requireAuth, getSessions);

// Quick sessions list from User.sessions (protected)
router.get("/user-sessions", requireAuth, getUserSessionsDoc);

// Health check (public)
router.get("/health", healthCheck);

export default router;
