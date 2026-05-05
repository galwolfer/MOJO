/*
 * File: src/routes/chat.js
 * Purpose: Chat-related routes (message, reset, history, sessions)
 */

import express from "express";
import { generalLimiter, strictLimiter, aiSuggestionsLimiter } from "../middlewares/rateLimiter.js";
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
router.post("/message", aiSuggestionsLimiter, requireAuth, sendMessage);

// Reset session (protected)
router.post("/reset", strictLimiter, requireAuth, resetSession);

// History retrieval (protected)
router.get("/history/:sessionId", generalLimiter, requireAuth, getHistory);

// Sessions list (protected)
router.get("/sessions", generalLimiter, requireAuth, getSessions);

// Quick sessions list from User.sessions (protected)
router.get("/user-sessions", generalLimiter, requireAuth, getUserSessionsDoc);

// Health check (public)
router.get("/health", generalLimiter, healthCheck);

export default router;
