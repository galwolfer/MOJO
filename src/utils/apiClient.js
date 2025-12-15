// src/utils/apiClient.js
// HTTP API client for making requests to the backend server.

import { env } from "../config/env.js";

const API_BASE_URL = `http://localhost:${env.PORT || 3000}`;

/**
 * Create an API client instance with optional default token.
 * @param {string|null} defaultToken - Default JWT token for requests
 * @returns {object} API client with request method
 */
export function createApiClient(defaultToken = null) {
  let token = defaultToken;

  return {
    /**
     * Set the authentication token.
     * @param {string|null} newToken - JWT token
     */
    setToken(newToken) {
      token = newToken;
    },

    /**
     * Get the current token.
     * @returns {string|null}
     */
    getToken() {
      return token;
    },

    /**
     * Clear the authentication token.
     */
    clearToken() {
      token = null;
    },

    /**
     * Make an HTTP request to the backend API.
     * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
     * @param {object} options - Fetch options
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async request(endpoint, options = {}) {
      const url = `${API_BASE_URL}${endpoint}`;
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      // Add auth token if available
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        return { ok: false, status: 0, data: { error: error.message } };
      }
    },

    /**
     * Make a GET request.
     * @param {string} endpoint - API endpoint
     * @param {object} options - Additional options
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: "GET" });
    },

    /**
     * Make a POST request.
     * @param {string} endpoint - API endpoint
     * @param {object} body - Request body
     * @param {object} options - Additional options
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async post(endpoint, body, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    /**
     * Make a PUT request.
     * @param {string} endpoint - API endpoint
     * @param {object} body - Request body
     * @param {object} options - Additional options
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async put(endpoint, body, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: "PUT",
        body: JSON.stringify(body),
      });
    },

    /**
     * Make a DELETE request.
     * @param {string} endpoint - API endpoint
     * @param {object} options - Additional options
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: "DELETE" });
    },
  };
}

// Default singleton client for simple usage
export const apiClient = createApiClient();

/**
 * Simple request function using the default client.
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<{ok: boolean, status: number, data: object}>}
 */
export async function apiRequest(endpoint, options = {}) {
  return apiClient.request(endpoint, options);
}
