// Shared HTTP client for all API calls
// Provides common headers, error handling, and request methods

import { getApiBase } from "./config";

// Auth token storage
let authToken: string | null = null;

/**
 * Set the authentication token for all API requests
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Get headers for API requests
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return headers;
}

/**
 * Handle API response and extract data
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || data?.message || res.statusText || "Request failed");
  }

  return data as T;
}

/**
 * Make a GET request
 */
export async function get<T>(endpoint: string): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });
  return handleResponse<T>(res);
}

/**
 * Make a POST request
 */
export async function post<T>(endpoint: string, body?: any): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

/**
 * Make a PUT request
 */
export async function put<T>(endpoint: string, body?: any): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

/**
 * Make a DELETE request
 */
export async function del<T>(endpoint: string): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return handleResponse<T>(res);
}

/**
 * Make a PATCH request
 */
export async function patch<T>(endpoint: string, body?: any): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export default {
  get,
  post,
  put,
  patch,
  del,
  setAuthToken,
};
