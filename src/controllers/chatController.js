/*
 * File: src/controllers/chatController.js
 * Purpose: Chat endpoints integrating the AgentController for messages and sessions
 */

import { AgentController } from "../agent/agentController.js";
import { config } from "../config/env.js";
import { User, Session } from "../models/index.js";

// Create an instance of the agent
const agent = new AgentController(config.geminiApiKey);

/**
 * Chat Controller - API Endpoints
 */

/**
 * Send a message to the agent
 * POST /api/chat/message
 */
export async function sendMessage(req, res, next) {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.userId; // From auth middleware

    // Ensure a message is provided
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Automatically create a sessionId if not provided
    const session = sessionId || `session_${Date.now()}`;

    // Process the message
    const result = await agent.processMessage(session, message, userId);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Reset a session
 * POST /api/chat/reset
 */
export async function resetSession(req, res, next) {
  try {
    const { sessionId } = req.body;
    const userId = req.user.userId; // From auth middleware

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const result = agent.resetSession(sessionId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat history
 * GET /api/chat/history/:sessionId
 */
export async function getHistory(req, res, next) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId; // From auth middleware

    const { limit, offset } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    // If pagination query params are provided, return a page from the end of the session.
    // This keeps responses small for large sessions.
    if (typeof limit !== "undefined" || typeof offset !== "undefined") {
      const page = await agent.getSessionHistoryPage(sessionId, userId, limit, offset);
      return res.json({
        success: true,
        ...page,
      });
    }

    // Backward-compatible full history (not recommended for large sessions)
    const history = await agent.getSessionHistory(sessionId, userId);

    return res.json({
      success: true,
      sessionId,
      messageCount: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List chat sessions for the current user
 * GET /api/chat/sessions?limit=10&cursor=ISO_DATE&includeMessages=10
 */
export async function getSessions(req, res, next) {
  try {
    const userId = req.user.userId;
    const { limit, cursor, includeMessages } = req.query;

    const page = await agent.listUserSessions(userId, limit, cursor, includeMessages);
    return res.json({
      success: true,
      ...page,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Quick get sessions from User.sessions (lightweight summary)
 * GET /api/chat/user-sessions
 */
export async function getUserSessionsDoc(req, res, next) {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select("sessions");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const includeMessagesRaw = req.query?.includeMessages;
    const includeMessages = Math.max(0, Math.min(50, Number(includeMessagesRaw) || 10));

    const sessionSummaries = Array.isArray(user.sessions) ? user.sessions : [];
    const sessionIds = sessionSummaries.map((s) => s.sessionId).filter(Boolean);

    if (includeMessages === 0 || sessionIds.length === 0) {
      return res.json({ success: true, sessions: sessionSummaries });
    }

    // Fetch the last N messages for these sessions from the Session collection
    const sessionDocs = await Session.find({ userId, sessionId: { $in: sessionIds } })
      .select({ sessionId: 1, lastActiveAt: 1, createdAt: 1, messageCount: 1, messages: 1 })
      .lean();

    const byId = new Map();
    for (const s of sessionDocs) {
      const msgs = Array.isArray(s.messages) ? s.messages : [];
      const tail = includeMessages ? msgs.slice(-includeMessages) : [];
      byId.set(s.sessionId, {
        sessionId: s.sessionId,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        messageCount: typeof s.messageCount === "number" && s.messageCount > 0 ? s.messageCount : msgs.length,
        messages: tail.map((m) => ({
          role: m.role,
          content: m.content,
          functionCall: m.functionCall,
          name: m.name,
          timestamp: m.timestamp,
        })),
      });
    }

    // Merge summaries with fetched messages, preserving the user's summary order
    const merged = sessionSummaries.map((summary) => {
      const full = byId.get(summary.sessionId);
      if (!full) return summary;
      return {
        sessionId: summary.sessionId,
        lastActiveAt: summary.lastActiveAt || full.lastActiveAt,
        createdAt: summary.createdAt || full.createdAt,
        messageCount: summary.messageCount || full.messageCount,
        preview: summary.preview || "",
        messages: full.messages,
      };
    });

    return res.json({ success: true, sessions: merged });
  } catch (err) {
    next(err);
  }
}

/**
 * Health check
 * GET /api/chat/health
 */
export async function healthCheck(req, res) {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
