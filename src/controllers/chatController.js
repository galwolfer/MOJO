import { AgentController } from "../agent/agentController.js";
import { config } from "../config/env.js";

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
