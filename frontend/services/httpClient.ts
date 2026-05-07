// Shared HTTP client for all API calls
// Provides common headers, error handling, and request methods

import { getApiBase } from "./config";

type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 12000;

// Auth token storage
let authToken: string | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

/**
 * Set the authentication token for all API requests
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Register a callback that runs when the backend rejects a request with an
 * invalid or expired token.
 */
export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

// Debug helper: return current auth token (used for diagnostics only)
export function getAuthToken(): string | null {
  return authToken;
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
    // Log server error details to device logs for debugging
    // eslint-disable-next-line no-console
    console.warn("[httpClient] Server responded with error", { status: res.status, statusText: res.statusText, body: data });
    const error = new Error(data?.error || data?.message || res.statusText || "Request failed") as Error & { data: any; status: number };
    error.name = "ServerError";
    error.data = data;    // attach full response body so callers can read extra fields
    error.status = res.status;

    if (res.status === 401 && (error.message.includes("Invalid token") || error.message.includes("Token expired"))) {
      authToken = null;
      void unauthorizedHandler?.();
    }

    throw error;
  }

  // eslint-disable-next-line no-console
  console.debug("[httpClient] Response OK", { status: res.status, body: data });

  return data as T;
}

function buildAbortSignal(options?: RequestOptions) {
  const timeoutMs = options?.timeoutMs;
  const externalSignal = options?.signal;

  if (typeof AbortController === "undefined") {
    return { signal: externalSignal, cleanup: undefined as (() => void) | undefined };
  }

  if (!timeoutMs) {
    return { signal: externalSignal, cleanup: undefined as (() => void) | undefined };
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onAbort);
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

async function fetchWithTimeout(url: string, init: RequestInit, options?: RequestOptions) {
  const timeoutMs = options?.timeoutMs;
  if (timeoutMs && typeof AbortController === "undefined") {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<Response>((_, reject) => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "NetworkError";
      timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
    });
    try {
      const res = await Promise.race([fetch(url, init), timeoutPromise]);
      return res as Response;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  const { signal, cleanup } = buildAbortSignal(options);
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    const networkError = new Error(error instanceof Error ? error.message : "Network error");
    networkError.name = "NetworkError";
    throw networkError;
  } finally {
    cleanup?.();
  }
}

/**
 * Make a GET request
 */
export async function get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const requestOptions: RequestOptions = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options?.signal,
  };
  // Debug: log outgoing GET request URL
  // eslint-disable-next-line no-console
  console.log("[httpClient] GET", url);
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: getHeaders(),
    },
    requestOptions
  );
  return handleResponse<T>(res);
}

/**
 * Make a POST request
 */
export async function post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const requestOptions: RequestOptions = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options?.signal,
  };
  // Debug: log outgoing POST request URL and body summary
  // eslint-disable-next-line no-console
  console.log("[httpClient] POST", url, body ? { bodySummary: Object.keys(body || {}).slice(0, 10) } : {});
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    requestOptions
  );
  return handleResponse<T>(res);
}

/**
 * Make a PUT request
 */
export async function put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const requestOptions: RequestOptions = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options?.signal,
  };
  const res = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    requestOptions
  );
  return handleResponse<T>(res);
}

/**
 * Make a DELETE request
 */
export async function del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const requestOptions: RequestOptions = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options?.signal,
  };
  const res = await fetchWithTimeout(
    url,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
    requestOptions
  );
  return handleResponse<T>(res);
}

/**
 * Make a PATCH request
 */
export async function patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const requestOptions: RequestOptions = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options?.signal,
  };
  const res = await fetchWithTimeout(
    url,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    requestOptions
  );
  return handleResponse<T>(res);
}

export default {
  get,
  post,
  put,
  patch,
  del,
  setAuthToken,
  setUnauthorizedHandler,
};
