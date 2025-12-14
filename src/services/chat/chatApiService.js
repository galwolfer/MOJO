// src/services/chat/chatApiService.js
// Client-side chat service for making API calls to the chat backend

import { apiClient } from "../../utils/apiClient.js";

/**
 * Send a message to the chat agent
 * @param {object} params
 * @param {string} params.message - The message to send
 * @param {string} [params.sessionId] - Optional session ID, auto-generated if not provided
 * @returns {Promise<{success: boolean, response?: string, sessionId?: string, messageCount?: number, error?: string}>}
 */
export async function sendChatMessage({ message, sessionId }) {
  try {
    const { ok, data } = await apiClient.post('/api/chat/message', { message, sessionId });

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send message' };
    }

    return {
      success: true,
      response: data.response,
      sessionId: data.sessionId,
      messageCount: data.messageCount
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Reset a chat session
 * @param {object} params
 * @param {string} params.sessionId - Session ID to reset
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function resetChatSession({ sessionId }) {
  try {
    const { ok, data } = await apiClient.post('/api/chat/reset', { sessionId });

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset session' };
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get chat history for a session
 * @param {object} params
 * @param {string} params.sessionId - Session ID to get history for
 * @returns {Promise<{success: boolean, sessionId?: string, messageCount?: number, history?: Array, error?: string}>}
 */
export async function getChatHistory({ sessionId }) {
  try {
    const { ok, data } = await apiClient.get(`/api/chat/history/${sessionId}`);

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Failed to get history' };
    }

    return {
      success: true,
      sessionId: data.sessionId,
      messageCount: data.messageCount,
      history: data.history
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check chat service health
 * @returns {Promise<{success: boolean, status?: string, timestamp?: string, error?: string}>}
 */
export async function checkChatHealth() {
  try {
    const { ok, data } = await apiClient.get('/api/chat/health');

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Chat service unhealthy' };
    }

    return {
      success: true,
      status: data.status,
      timestamp: data.timestamp
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
