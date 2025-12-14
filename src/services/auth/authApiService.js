// src/services/auth/authApiService.js
// Client-side authentication service for making API calls to the backend

import { apiRequest } from "../../utils/apiClient.js";

/**
 * Register a new user via API
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.email
 * @param {string} params.password
 * @param {object} [params.priorities]
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
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
      token: data.token
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Login user via API
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.password
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
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
      token: data.token
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile via API
 * @param {object} params
 * @param {object} params.priorities
 * @returns {Promise<{success: boolean, error?: string}>}
 */
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