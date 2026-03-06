/**
 * StatsContext
 *
 * Provides global stats state management and event notifications for real-time gamification updates.
 * Components can subscribe to stats changes and the context will refresh stats when tasks/subtasks are completed.
 */

import React, { createContext, useContext, useCallback, useRef, useMemo, useState, useEffect } from "react";
import { getUserStats, UserStats } from "../services/userService";
import { useAuth } from "./AuthContext";
import { useTaskContext } from "./TaskContext";

type StatsUpdateListener = (stats: UserStats) => void;

interface StatsContextValue {
  /**
   * Current user stats (tasks, points, streak)
   */
  stats: UserStats;

  /**
   * Whether stats are currently loading
   */
  isLoading: boolean;

  /**
   * Refresh stats from the server
   * Call this after completing tasks or subtasks
   */
  refreshStats: () => Promise<void>;

  /**
   * Notify that stats have changed (triggers a refresh)
   * This can be called from anywhere when gamification might have changed
   */
  notifyStatsChange: (gamificationData?: { points?: number; currentStreak?: number }) => void;

  /**
   * Subscribe to stats update notifications.
   * Returns an unsubscribe function.
   */
  subscribeToStatsUpdates: (listener: StatsUpdateListener) => () => void;

  /**
   * Get the timestamp of the last stats update.
   * Useful for forcing re-renders or cache invalidation.
   */
  lastUpdateTimestamp: number;
}

const defaultStats: UserStats = { tasks: 0, points: 0, streak: 0 };

const StatsContext = createContext<StatsContextValue | undefined>(undefined);

/**
 * StatsProvider - Wrap your app with this to enable global stats management
 */
export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const listenersRef = useRef<Set<StatsUpdateListener>>(new Set());
  const lastUpdateRef = useRef<number>(Date.now());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef(user);
  
  // Keep userRef in sync
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch stats from server
  const refreshStats = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!userRef.current) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const newStats = await getUserStats();
      setStats(newStats);
      lastUpdateRef.current = Date.now();

      // Notify all listeners
      listenersRef.current.forEach((listener) => {
        try {
          listener(newStats);
        } catch (error) {
          console.warn("StatsContext: Error in listener:", error);
        }
      });
    } catch (error) {
      console.warn("StatsContext: Failed to refresh stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Notify that stats have changed - triggers a debounced refresh
  const notifyStatsChange = useCallback(
    (gamificationData?: { points?: number; currentStreak?: number; completedTasks?: number }) => {
      console.log("[StatsContext] notifyStatsChange called with:", gamificationData);
      
      // If gamification data is provided, optimistically update stats immediately
      if (gamificationData) {
        setStats((prev) => {
          const newStats = {
            ...prev,
            points: gamificationData.points ?? prev.points,
            streak: gamificationData.currentStreak ?? prev.streak,
            tasks: gamificationData.completedTasks ?? prev.tasks,
          };
          console.log("[StatsContext] Updating stats from", prev, "to", newStats);
          return newStats;
        });
      }

      // Debounce the refresh to avoid multiple rapid calls
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshStats();
      }, 300);
    },
    [refreshStats],
  );

  const subscribeToStatsUpdates = useCallback((listener: StatsUpdateListener) => {
    listenersRef.current.add(listener);
    // Return unsubscribe function
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // Fetch stats when user changes (login/logout)
  useEffect(() => {
    if (user) {
      refreshStats();
    } else {
      // Reset stats on logout
      setStats(defaultStats);
      setIsLoading(false);
    }
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [user]); // Only depend on user, refreshStats is stable now

  // Auto-refresh stats whenever ANY task update occurs (from any screen)
  // This ensures stats always stay in sync even when individual screens
  // don't explicitly call notifyStatsChange after task completion.
  const { subscribeToTaskUpdates } = useTaskContext();
  useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(() => {
      console.log("[StatsContext] Task update detected, scheduling stats refresh");
      // Debounce the refresh to avoid multiple rapid calls
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshStats();
      }, 500);
    });
    return unsubscribe;
  }, [subscribeToTaskUpdates, refreshStats]);

  const value = useMemo(
    () => ({
      stats,
      isLoading,
      refreshStats,
      notifyStatsChange,
      subscribeToStatsUpdates,
      get lastUpdateTimestamp() {
        return lastUpdateRef.current;
      },
    }),
    [stats, isLoading, refreshStats, notifyStatsChange, subscribeToStatsUpdates],
  );

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}

/**
 * Hook to access stats context
 * Throws an error if used outside StatsProvider
 */
export function useStatsContext(): StatsContextValue {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error("useStatsContext must be used within a StatsProvider");
  }
  return context;
}

/**
 * Hook to access stats context optionally
 * Returns a no-op implementation if used outside StatsProvider
 */
export function useOptionalStatsContext(): StatsContextValue {
  const context = useContext(StatsContext);
  // Return a no-op implementation if context is not available
  if (!context) {
    return {
      stats: { tasks: 0, points: 0, streak: 0 },
      isLoading: false,
      refreshStats: async () => {},
      notifyStatsChange: () => {},
      subscribeToStatsUpdates: () => () => {},
      lastUpdateTimestamp: Date.now(),
    };
  }
  return context;
}

/**
 * Hook to get current stats (convenience hook)
 */
export function useStats(): UserStats {
  const { stats } = useStatsContext();
  return stats;
}

/**
 * Hook to subscribe to stats updates with automatic cleanup
 */
export function useStatsUpdateSubscription(onUpdate: StatsUpdateListener) {
  const { subscribeToStatsUpdates } = useStatsContext();

  useEffect(() => {
    const unsubscribe = subscribeToStatsUpdates(onUpdate);
    return unsubscribe;
  }, [subscribeToStatsUpdates, onUpdate]);
}

export default StatsContext;
