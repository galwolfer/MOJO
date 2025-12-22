// Authentication API service for frontend
// Handles user authentication (login, register)

import { post, setAuthToken } from "./httpClient";
import { setApiBase, getApiBase } from "./config";

export { setApiBase, getApiBase, DEFAULT_MACHINE_IP } from "./config";
export { setAuthToken };

// Types
export type LoginRequest = { username: string; password: string };
export type RegisterRequest = { username: string; email: string; password: string; displayName?: string };

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

export default { setApiBase, setAuthToken, login, register };
