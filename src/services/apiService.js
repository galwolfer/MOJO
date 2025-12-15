// src/services/apiService.js
// Consolidated thin HTTP wrappers for backend API endpoints

import { apiRequest, apiClient } from "../utils/apiClient.js";

// --- AUTH API ---
export async function registerUserApi({ username, email, password, priorities }) {
  try {
    const { ok, data } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    return {
      success: true,
      user: { ...data.user, _id: data.user.id || data.user._id },
      token: data.token,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function loginUserApi({ username, password }) {
  try {
    const { ok, data } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Login failed' };
    }

    return {
      success: true,
      user: { ...data.user, _id: data.user.id || data.user._id },
      token: data.token,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateUserProfileApi({ priorities }) {
  try {
    const { ok, data } = await apiRequest('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify({ priorities }),
    });

    if (!ok) {
      return { success: false, error: data.error || 'Profile update failed' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// --- CHAT API ---
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
      messageCount: data.messageCount,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function resetChatSession({ sessionId }) {
  try {
    const { ok, data } = await apiClient.post('/api/chat/reset', { sessionId });

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset session' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

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
      history: data.history,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function checkChatHealth() {
  try {
    const { ok, data } = await apiClient.get('/api/chat/health');

    if (!ok || !data.success) {
      return { success: false, error: data.error || 'Chat service unhealthy' };
    }

    return { success: true, status: data.status, timestamp: data.timestamp };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  registerUserApi,
  loginUserApi,
  updateUserProfileApi,
  sendChatMessage,
  resetChatSession,
  getChatHistory,
  checkChatHealth,
};
