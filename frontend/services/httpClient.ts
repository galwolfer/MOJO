// Shared HTTP client for all API calls
// Provides common headers, error handling, and request methods

import { getApiBase } from "./config";

type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

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
      timeoutId = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
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
  } finally {
    cleanup?.();
  }
}

/**
 * Make a GET request
 */
export async function get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
    method: "GET",
    headers: getHeaders(),
    },
    options
  );
  return handleResponse<T>(res);
}

/**
 * Make a POST request
 */
export async function post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    options
  );
  return handleResponse<T>(res);
}

/**
 * Make a PUT request
 */
export async function put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    options
  );
  return handleResponse<T>(res);
}

/**
 * Make a DELETE request
 */
export async function del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
    options
  );
  return handleResponse<T>(res);
}

/**
 * Make a PATCH request
 */
export async function patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    },
    options
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
};
