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
  gender?: string;
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
    profileImage?: string | null;
  };
};

// Raw API response type (what backend actually returns)
type RawAuthResponse = {
  success: boolean;
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    profile?: {
      name?: string;
      profileImage?: string | null;
    };
  };
};

/**
 * Transform raw API user to frontend User type
 */
function transformUser(raw: RawAuthResponse["user"]): AuthResponse["user"] {
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    displayName: raw.profile?.name || undefined,
    profileImage: raw.profile?.profileImage || null,
  };
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const raw = await post<RawAuthResponse>("/auth/login", payload);
  return {
    success: raw.success,
    token: raw.token,
    user: transformUser(raw.user),
  };
}

/**
 * Register new user
 * POST /api/auth/register
 */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const raw = await post<RawAuthResponse>("/auth/register", payload);
  return {
    success: raw.success,
    token: raw.token,
    user: transformUser(raw.user),
  };
}

/**
 * Update user category priorities
 * POST /api/auth/category-priorities
 */
export async function updateCategoryPriorities(payload: CategoryPrioritiesRequest): Promise<any> {
  return post<any>("/auth/category-priorities", payload);
}

/**
 * Get user preferences (priorities, ojoType, and appSettings)
 * GET /api/auth/preferences
 */
export async function getUserPreferences(): Promise<{
  priorities: Record<string, number>;
  ojoType: { name: string; displayName: string } | null;
  appSettings: Record<string, any>;
}> {
  const { get } = await import("./httpClient");
  return get<{
    priorities: Record<string, number>;
    ojoType: { name: string; displayName: string } | null;
    appSettings: Record<string, any>;
  }>("/auth/preferences");
}

/**
 * Update user profile
 * PATCH /api/auth/profile
 */
export async function updateProfile(payload: {
  name?: string;
  profileImage?: string;
  email?: string;
  username?: string;
  settings?: Record<string, any>;
}): Promise<any> {
  const { patch } = await import("./httpClient");
  return patch<any>("/auth/profile", payload);
}

/**
 * Update user app settings
 * PATCH /api/auth/profile
 */
export async function updateAppSettings(settings: Record<string, any>): Promise<any> {
  const { patch } = await import("./httpClient");
  return patch<any>("/auth/profile", { settings });
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

/**
 * Delete user account
 * DELETE /api/auth/account
 */
export async function deleteAccount(): Promise<any> {
  const { del } = await import("./httpClient");
  return del<any>("/auth/account");
}

export default {
  setApiBase,
  setAuthToken,
  login,
  register,
  updateCategoryPriorities,
  getUserPreferences,
  uploadProfileImage,
  updateProfile,
  updateAppSettings,
  deleteAccount,
};
