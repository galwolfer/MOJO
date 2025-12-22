// Shared API configuration
// This module handles API base URL resolution for all services

import { Platform } from "react-native";

// Default machine IP — prefer setting DEFAULT_MACHINE_IP in your .env file
// This allows overriding the IP used on Android devices/emulators.
export const DEFAULT_MACHINE_IP =
  (typeof process !== "undefined" && process.env && process.env.DEFAULT_MACHINE_IP) || "192.168.68.106";

// Initialize API base URL
let API_BASE = "http://localhost:3000/api";

// Initialize API base from environment or defaults
function initializeApiBase(): string {
  let base = "http://localhost:3000/api";

  try {
    const envPort = typeof process !== "undefined" && process.env && (process.env.PORT || process.env.REACT_APP_PORT);
    const envApiBase = typeof process !== "undefined" && process.env && process.env.API_BASE;

    if (envApiBase) {
      base = envApiBase.replace(/\/$/, "");
    } else if (envPort) {
      base = `http://localhost:${envPort}/api`;
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
      base = `http://${preferredHost}:${portToUse}/api`;

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
            base = `http://${hostIp}:${finalPort}/api`;
          }
        }
      } catch (_) {
        // ignore — keep preferredHost
      }
    }
  } catch (_) {}

  return base;
}

// Initialize on module load
API_BASE = initializeApiBase();

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
