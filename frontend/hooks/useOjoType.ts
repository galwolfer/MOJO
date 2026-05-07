/**
 * File: frontend/hooks/useOjoType.ts
 * Purpose: Hook for managing OjoType selection and API calls
 */
import { useState, useEffect, useCallback } from "react";
import { OjoTypeName } from "../config/ojoTypeConfig";
import { get as httpGet, patch as httpPatch } from "../services/httpClient";
import { useAuth } from "../context/AuthContext";

export interface OjoTypeData {
  _id: string;
  name: OjoTypeName;
  displayName: string;
  persona: string;
  tone: string[];
  icon: string;
  description: string;
  isDefault: boolean;
}

interface UseOjoTypeReturn {
  currentOjoType: OjoTypeName | null;
  ojoTypeData: OjoTypeData | null;
  loading: boolean;
  error: string | null;
  updateOjoType: (ojoTypeName: OjoTypeName) => Promise<void>;
  refetch: () => Promise<void>;
}

let sharedInFlightFetch: Promise<void> | null = null;

/**
 * Hook to manage OjoType selection
 * Handles fetching user's current OjoType and updating it
 */
export function useOjoType(token?: string): UseOjoTypeReturn {
  const [currentOjoType, setCurrentOjoType] = useState<OjoTypeName | null>(null);
  const [ojoTypeData, setOjoTypeData] = useState<OjoTypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();

  const fetchCurrentOjoType = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if ((auth as any)?.isLoading) {
        return;
      }

      if (!token && !(auth as any)?.token) {
        setCurrentOjoType(null);
        setOjoTypeData(null);
        return;
      }

      // If AuthContext already has user profile with OjoType, use it immediately
      if ((auth as any)?.user?.profile?.ojoType) {
        const ojoType = (auth as any).user.profile.ojoType;
        setCurrentOjoType(ojoType.name as OjoTypeName);
        setOjoTypeData(ojoType);
        return;
      }

      // Dedupe concurrent fetches
      if (sharedInFlightFetch) return await sharedInFlightFetch;
      sharedInFlightFetch = (async () => {
        try {
          const data = await httpGet<any>("/auth/me");
          const ojoType = data.user?.profile?.ojoType;
          if (ojoType) {
            setCurrentOjoType(ojoType.name as OjoTypeName);
            setOjoTypeData(ojoType);
          }
        } finally {
          sharedInFlightFetch = null;
        }
      })();

      await sharedInFlightFetch;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // If the server indicates no token/unauthorized, treat as unauthenticated and suppress noisy errors
      if (err && err instanceof Error && (err.name === "ServerError" || err.name === "Error")) {
        const msg = (err as Error).message || "";
        if (
          msg.includes("No token provided") ||
          msg.includes("Invalid token") ||
          msg.includes("Token expired") ||
          msg.includes("401")
        ) {
          console.debug("[useOjoType] Unauthenticated - /auth/me returned:", msg);
          setError(null);
          setCurrentOjoType(null);
          setOjoTypeData(null);
          setLoading(false);
          return;
        }
      }

      setError(errorMessage);
      console.error("Failed to fetch OjoType:", err);
    } finally {
      setLoading(false);
    }
  }, [auth, token]);

  const updateOjoType = useCallback(
    async (ojoTypeName: OjoTypeName) => {
      try {
        setLoading(true);
        setError(null);

        let newOjoType: any = undefined;
        try {
          console.debug("[useOjoType] using httpClient.patch('/auth/profile')");
          const data = await httpPatch<any>("/auth/profile", { ojoTypeName });
          newOjoType = data.profile?.ojoType;
          if (newOjoType) {
            setCurrentOjoType(newOjoType.name as OjoTypeName);
            setOjoTypeData(newOjoType);
          }
        } catch (err) {
          console.error("[useOjoType] httpClient.patch('/auth/profile') failed:", err);
          throw err;
        }

        // If auth context exists and has a user, update it so other parts of the app
        // see the new OjoType immediately.
        if (newOjoType && auth && (auth as any).user) {
          try {
            // Clone existing user and attach updated profile.ojoType
            const updatedUser = {
              ...(auth as any).user,
              profile: { ...(((auth as any).user as any).profile || {}), ojoType: newOjoType },
            };
            // Keep the same token (auth.token) when calling signIn
            if ((auth as any).signIn && (auth as any).token) {
              await (auth as any).signIn((auth as any).token, updatedUser);
            }
          } catch (err) {
            // Non-fatal if signIn fails — we still update local state below
            console.warn("[useOjoType] failed to update AuthContext user:", err);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Failed to update OjoType:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [auth]
  );

  // Fetch OjoType on mount or when token changes
  useEffect(() => {
    fetchCurrentOjoType();
  }, [fetchCurrentOjoType]);

  return {
    currentOjoType,
    ojoTypeData,
    loading,
    error,
    updateOjoType,
    refetch: fetchCurrentOjoType,
  };
}
