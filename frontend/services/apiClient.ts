// Simple API client for frontend to call server endpoints
export type LoginRequest = { username: string; password: string };
export type RegisterRequest = { username: string; email: string; password: string; displayName?: string };

import { Platform } from "react-native";

// Default machine IP — prefer setting HOST_IP in env for your machine.
const DEFAULT_MACHINE_IP = "192.168.68.109";

// Default API base for web/local development
let API_BASE = "http://localhost:3000/api";
try {
  const envPort = typeof process !== "undefined" && process.env && (process.env.PORT || process.env.REACT_APP_PORT);
  const envApiBase = typeof process !== "undefined" && process.env && process.env.API_BASE;
  if (envApiBase) {
    API_BASE = envApiBase.replace(/\/$/, "");
  } else if (envPort) {
    API_BASE = `http://localhost:${envPort}/api`;
  }
} catch (_) {
  // ignore — fall back to default
}

// On Android devices/emulators, prefer an explicit machine IP so physical
// devices and emulators can reach the server. If Metro provides a scriptURL
// with a host, override with that.
try {
  if (typeof Platform !== "undefined" && Platform.OS === "android") {
    const envHost = typeof process !== "undefined" && process.env && (process.env.HOST_IP || process.env.LOCAL_IP);
    const preferredHost = envHost || DEFAULT_MACHINE_IP;
    const envPort = typeof process !== "undefined" && process.env && (process.env.PORT || process.env.REACT_APP_PORT);
    const portToUse = envPort || "3000";
    API_BASE = `http://${preferredHost}:${portToUse}/api`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { NativeModules } = require("react-native");
      const scriptURL = (NativeModules && NativeModules.SourceCode && NativeModules.SourceCode.scriptURL) || null;
      if (scriptURL && typeof scriptURL === "string") {
        const m = scriptURL.match(/https?:\/\/([^:\/]+)(?::(\d+))?/);
        if (m && m[1]) {
          const hostIp = m[1];
          const scriptPort = m[2];
          const finalPort = envPort || scriptPort || "3000";
          API_BASE = `http://${hostIp}:${finalPort}/api`;
        }
      }
    } catch (_) {
      // ignore — keep preferredHost
    }
  }
} catch (_) {}

// (silent in production) resolved API_BASE is kept internal

export function setApiBase(url: string) {
  API_BASE = url.replace(/\/$/, "");
}

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText || "Request failed");
  return data;
}

export async function login(payload: LoginRequest) {
  const url = `${API_BASE}/auth/login`;
  try {
    // no-op: avoid logging sensitive info in production
  } catch (_) {}
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function register(payload: RegisterRequest) {
  const url = `${API_BASE}/auth/register`;
  try {
    // no-op: avoid logging sensitive info in production
  } catch (_) {}
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export default { setApiBase, login, register };
