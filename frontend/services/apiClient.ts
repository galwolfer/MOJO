// Authentication API service for frontend
// Handles user authentication (login, register)

import { post, setAuthToken } from "./httpClient";
import { setApiBase, getApiBase } from "./config";

export { setApiBase, getApiBase, DEFAULT_MACHINE_IP } from "./config";
export { setAuthToken };

// Types
export type LoginRequest = { username: string; password: string };
export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  profileImage?: string | null;
};
export type CategoryPrioritiesRequest = { priorities: Record<string, number> };

export type AuthResponse = {
  success: boolean;
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    displayName?: string;
  };
};

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return post<AuthResponse>("/auth/login", payload);
}

/**
 * Register new user
 * POST /api/auth/register
 */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  return post<AuthResponse>("/auth/register", payload);
}

/**
 * Update user category priorities
 * POST /api/auth/category-priorities
 */
export async function updateCategoryPriorities(payload: CategoryPrioritiesRequest): Promise<any> {
  return post<any>("/auth/category-priorities", payload);
}

/**
 * Upload profile image file (multipart/form-data)
 * Expects the server to return { success: true, url }
 */
export async function uploadProfileImage(fileOrUri: string | File): Promise<{ success: boolean; url?: string }> {
  const apiBase = getApiBase();
  const url = `${apiBase}/auth/upload-avatar`;

  const form = new FormData();

  if (typeof fileOrUri === "string") {
    // Extract filename from URI
    const nameMatch = fileOrUri.match(/[^\/]+$/);
    const filename = nameMatch ? nameMatch[0] : `avatar-${Date.now()}.jpg`;

    // Type: assume jpeg for now
    const file: any = {
      uri: fileOrUri,
      name: filename,
      type: "image/jpeg",
    };

    form.append("avatar", file as any);
  } else {
    // Browser File object
    form.append("avatar", fileOrUri as any);
  }

  const res = await fetch(url, {
    method: "POST",
    body: form,
    // Note: do NOT set Content-Type; fetch will set proper multipart boundary
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || data?.message || res.statusText || "Upload failed");
  }

  return data as { success: boolean; url?: string };
}

export default { setApiBase, setAuthToken, login, register, updateCategoryPriorities, uploadProfileImage };
