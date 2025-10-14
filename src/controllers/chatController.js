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
    const { message, sessionId, userId } = req.body;

    // Ensure a message is provided
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Automatically create a sessionId if not provided
    const session = sessionId || `session_${Date.now()}`;
    const user = userId || "anonymous";

    // Process the message
    const result = await agent.processMessage(session, message, user);

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

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const result = agent.resetSession(sessionId);
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

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const history = agent.getSessionHistory(sessionId);

    res.json({
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
