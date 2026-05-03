/*
 * File: src/controllers/chatController.js
 * Purpose: Chat endpoints integrating the AgentController for messages and sessions
 */

import { AgentController } from "../agent/agentController.js";
import { config } from "../config/env.js";
import { User, Session } from "../models/index.js";

const agent = new AgentController(config.geminiApiKey);

function sanitizeMessageForClient(message) {
  const sanitized = { ...message };
  if (typeof sanitized.content === "string") {
    sanitized.content = agent._sanitizeResponse(sanitized.content);
  }
  delete sanitized.functionCall;
  delete sanitized.toolCalls;
  delete sanitized.function_call;
  delete sanitized.tool_calls;
  return sanitized;
}

function sanitizeHistoryForClient(history) {
  if (!Array.isArray(history)) return [];
  return history.map((msg) => sanitizeMessageForClient(msg));
}

function sanitizeSessionsForClient(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((session) => {
    if (!session.messages) return session;
    return {
      ...session,
      messages: sanitizeHistoryForClient(session.messages),
    };
  });
}

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

    const response = {
      ...result,
      response: typeof result.response === "string" ? agent._sanitizeResponse(result.response) : result.response,
    };
    res.json(response);
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
        history: sanitizeHistoryForClient(page.history),
      });
    }

    // Backward-compatible full history (not recommended for large sessions)
    const history = await agent.getSessionHistory(sessionId, userId);

    return res.json({
      success: true,
      sessionId,
      messageCount: history.length,
      history: sanitizeHistoryForClient(history),
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
      sessions: sanitizeSessionsForClient(page.sessions),
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
        messages: sanitizeHistoryForClient(
          tail.map((m) => ({
            role: m.role,
            content: m.content,
            functionCall: m.functionCall,
            name: m.name,
            // include OjoType metadata if present
            ojoTypeName: m.ojoTypeName,
            ojoTypeDisplayName: m.ojoTypeDisplayName,
            timestamp: m.timestamp,
          }))
        ),
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
