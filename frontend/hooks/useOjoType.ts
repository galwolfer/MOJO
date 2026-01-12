/**
 * File: frontend/hooks/useOjoType.ts
 * Purpose: Hook for managing OjoType selection and API calls
 */
import { useState, useEffect, useCallback } from "react";
import { OjoTypeName } from "../config/ojoTypeConfig";

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

      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const data = await response.json();
      const ojoType = data.user?.profile?.ojoType;

      if (ojoType) {
        setCurrentOjoType(ojoType.name as OjoTypeName);
        setOjoTypeData(ojoType);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
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

        const response = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            ojoTypeName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update OjoType");
        }

        const data = await response.json();
        const newOjoType = data.profile?.ojoType;

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
