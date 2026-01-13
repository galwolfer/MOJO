/**
 * File: frontend/hooks/useOjoType.ts
 * Purpose: Hook for managing OjoType selection and API calls
 */
import { useState, useEffect, useCallback } from "react";
import { OjoTypeName } from "../config/ojoTypeConfig";
import { get as httpGet, patch as httpPatch, getAuthToken } from "../services/httpClient";

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

/**
 * Hook to manage OjoType selection
 * Handles fetching user's current OjoType and updating it
 */
export function useOjoType(token?: string): UseOjoTypeReturn {
  const [currentOjoType, setCurrentOjoType] = useState<OjoTypeName | null>(null);
  const [ojoTypeData, setOjoTypeData] = useState<OjoTypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentOjoType = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        // Use shared httpClient so Authorization header is included when set        const token = getAuthToken();
        console.debug("[useOjoType] httpClient.get('/auth/me') - auth token present:", !!token);
        console.debug("[useOjoType] using httpClient.get('/auth/me')");
        const data = await httpGet<any>("/auth/me");
        const ojoType = data.user?.profile?.ojoType;
        if (ojoType) {
          setCurrentOjoType(ojoType.name as OjoTypeName);
          setOjoTypeData(ojoType);
        }
      } catch (err) {
        // Re-throw to be handled by outer catch; add debug info
        console.error("[useOjoType] httpClient.get('/auth/me') failed:", err);
        throw err;
      }
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
  }, [token]);

  const updateOjoType = useCallback(
    async (ojoTypeName: OjoTypeName) => {
      try {
        setLoading(true);
        setError(null);

        try {
          console.debug("[useOjoType] using httpClient.patch('/auth/profile')");
          const data = await httpPatch<any>("/auth/profile", { ojoTypeName });
          const newOjoType = data.profile?.ojoType;
          if (newOjoType) {
            setCurrentOjoType(newOjoType.name as OjoTypeName);
            setOjoTypeData(newOjoType);
          }
        } catch (err) {
          console.error("[useOjoType] httpClient.patch('/auth/profile') failed:", err);
          throw err;
        }

        if (newOjoType) {
          setCurrentOjoType(newOjoType.name as OjoTypeName);
          setOjoTypeData(newOjoType);
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
    [token]
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
