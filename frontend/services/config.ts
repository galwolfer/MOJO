// Shared API configuration
// This module handles API base URL resolution for all services

import { Platform } from "react-native";

// Helper: strip surrounding single/double quotes which may appear in .env values
function stripQuotes(v?: string | null): string | undefined {
  if (v === null || typeof v === "undefined") return undefined;
  return String(v).replace(/^['"]|['"]$/g, "");
}

// Default machine IP — prefer setting DEFAULT_MACHINE_IP in your .env file
// This allows overriding the IP used on Android devices/emulators.
export const DEFAULT_MACHINE_IP =
  (typeof process !== "undefined" && process.env && stripQuotes(process.env.EXPO_PUBLIC_DEFAULT_MACHINE_IP)) ||
  // Default fallback — set this in .env (EXPO_PUBLIC_DEFAULT_MACHINE_IP) to your machine IP.
  // Note: the previous default had an invalid last octet ("404"). Use loopback by default
  // to avoid accidental invalid IPs; for Android devices set EXPO_PUBLIC_DEFAULT_MACHINE_IP to your host IP.
  "192.168.11.19";

console.log("DEFAULT_MACHINE_IP:", DEFAULT_MACHINE_IP);

// Initialize API base URL
let API_BASE = "http://localhost:3000/api";

function extractHost(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  // Accept either full URLs (http://x.y.z:port) or host:port values.
  const withoutProto = trimmed.replace(/^https?:\/\//i, "");
  const hostPort = withoutProto.split("/")[0] || "";
  const host = hostPort.split(":")[0] || "";

  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function getBaseHost(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname || null;
  } catch (_) {
    return null;
  }
}

// Initialize API base from environment or defaults
function initializeApiBase(): string {
  let base = "http://localhost:3000/api";

  try {
    const envPort =
      typeof process !== "undefined" &&
      process.env &&
      (stripQuotes(process.env.PORT) ||
        stripQuotes(process.env.REACT_APP_PORT) ||
        stripQuotes(process.env.EXPO_PUBLIC_API_PORT));
    const envApiBase =
      typeof process !== "undefined" &&
      process.env &&
      (stripQuotes(process.env.API_BASE) || stripQuotes(process.env.EXPO_PUBLIC_API_BASE));

    if (envApiBase) {
      base = envApiBase.replace(/\/$/, "");
    } else if (envPort) {
      base = `http://localhost:${envPort}/api`;
    }
  } catch (_) {
    // ignore — fall back to default
  }

  // Prefer Expo runtime config if available (Constants.manifest.extra)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require("expo-constants");
    const extras = (Constants && (Constants.manifest && Constants.manifest.extra)) || (Constants && Constants.expoConfig && Constants.expoConfig.extra) || null;
    const expoApiBase = extras && (extras.EXPO_PUBLIC_API_BASE || extras.API_BASE);
    if (expoApiBase && typeof expoApiBase === "string") {
      base = expoApiBase.replace(/\/$/, "");
    }
  } catch (_) {
    // not running in Expo environment or expo-constants not installed — continue
  }

  // On native devices/emulators, avoid localhost and prefer a reachable host.
  // We infer host from Expo runtime metadata (hostUri/debuggerHost) first,
  // then fall back to configured machine IP.
  try {
    if (typeof Platform !== "undefined" && Platform.OS !== "web") {
      const currentHost = getBaseHost(base);
      const shouldRewriteLocalhostBase = !currentHost || currentHost === "localhost" || currentHost === "127.0.0.1";
      if (!shouldRewriteLocalhostBase) {
        return base;
      }

      const envHost = typeof process !== "undefined" && process.env && (process.env.HOST_IP || process.env.LOCAL_IP);
      const envPort = typeof process !== "undefined" && process.env && (process.env.PORT || process.env.REACT_APP_PORT);
      const portToUse = envPort || "3000";

      let inferredHost: string | null = null;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Constants = require("expo-constants");
        const hostUri =
          (Constants && Constants.expoConfig && Constants.expoConfig.hostUri) ||
          (Constants && Constants.manifest2 && Constants.manifest2.extra && Constants.manifest2.extra.expoClient && Constants.manifest2.extra.expoClient.hostUri) ||
          (Constants && Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.hostUri)) ||
          null;
        inferredHost = extractHost(hostUri);
      } catch (_) {
        // ignore expo constants parsing failures
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { NativeModules } = require("react-native");
        const scriptURL = (NativeModules && NativeModules.SourceCode && NativeModules.SourceCode.scriptURL) || null;
        const scriptHost = extractHost(scriptURL);
        // Only use scriptURL as a fallback when Expo hostUri was not available.
        if (!inferredHost && scriptHost) {
          inferredHost = scriptHost;
        }
      } catch (_) {
        // ignore scriptURL parsing failures
      }

      const preferredHost = inferredHost || envHost || DEFAULT_MACHINE_IP;
      base = `http://${preferredHost}:${portToUse}/api`;
    }
  } catch (_) {}

  return base;
}

// Initialize on module load
API_BASE = initializeApiBase();

// Debug: log resolved API base for easier debugging in Metro/Expo logs
try {
  // eslint-disable-next-line no-console
  console.log("Resolved API_BASE:", API_BASE);
} catch (_) {}

/**
 * Log environment and resolved API configuration to help debugging
 */

/**
 * Get the current API base URL
 */
export function getApiBase(): string {
  return API_BASE;
}

/**
 * Set a custom API base URL
 * @param url - The new base URL (without trailing slash)
 */
export function setApiBase(url: string): void {
  API_BASE = url.replace(/\/$/, "");
}
