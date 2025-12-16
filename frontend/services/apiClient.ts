// Simple API client for frontend to call server endpoints
export type LoginRequest = { username: string; password: string };
export type RegisterRequest = { username: string; email: string; password: string; displayName?: string };

let API_BASE = "http://localhost:3000/api";

export function setApiBase(url: string) {
  API_BASE = url.replace(/\/$/, "");
}

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText || "Request failed");
  return data;
}

export async function login(payload: LoginRequest) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function register(payload: RegisterRequest) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export default { setApiBase, login, register };
