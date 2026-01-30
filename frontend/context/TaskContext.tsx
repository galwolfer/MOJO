/**
 * TaskContext
 *
 * Provides global task state management and event notifications for real-time updates.
 * Components can subscribe to task changes and trigger refreshes when tasks are modified.
 */

import React, { createContext, useContext, useCallback, useRef, useMemo } from "react";

type TaskUpdatePayload = { taskId?: string } | undefined;

type TaskUpdateListener = (payload?: TaskUpdatePayload) => void;

interface TaskContextValue {
  /**
   * Notify all listeners that tasks have been updated.
   * Call this after completing, creating, updating, or deleting a task.
   * Optional payload allows scoping updates to a specific task (avoids unnecessary refreshes).
   */
  notifyTaskUpdate: (payload?: TaskUpdatePayload, delayMs?: number) => void;

  /**
   * Subscribe to task update notifications.
   * Returns an unsubscribe function.
   */
  subscribeToTaskUpdates: (listener: TaskUpdateListener) => () => void;

  /**
   * Get the timestamp of the last task update.
   * Useful for forcing re-renders or cache invalidation.
   */
  lastUpdateTimestamp: number;
}

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

/**
 * TaskProvider - Wrap your app with this to enable task update notifications
 */
export function TaskProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<TaskUpdateListener>>(new Set());
  const lastUpdateRef = useRef<number>(Date.now());

  const notifyTaskUpdate = useCallback((payload?: TaskUpdatePayload, delayMs?: number) => {
    lastUpdateRef.current = Date.now();

    const notify = () => {
      listenersRef.current.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.warn("TaskContext: Error in listener:", error);
        }
      });
    };

    if (typeof delayMs === "number" && delayMs > 0) {
      setTimeout(() => notify(), delayMs);
    } else {
      notify();
    }
  }, []);

  const subscribeToTaskUpdates = useCallback((listener: TaskUpdateListener) => {
    listenersRef.current.add(listener);
    // Return unsubscribe function
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      notifyTaskUpdate,
      subscribeToTaskUpdates,
      get lastUpdateTimestamp() {
        return lastUpdateRef.current;
      },
    }),
    [notifyTaskUpdate, subscribeToTaskUpdates],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

/**
 * Hook to access task context
 */
export function useTaskContext(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskProvider");
  }
  return context;
}

/**
 * Hook to subscribe to task updates with automatic cleanup
 */
export function useTaskUpdateSubscription(onUpdate: TaskUpdateListener) {
  const { subscribeToTaskUpdates } = useTaskContext();

  React.useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(onUpdate);
    return unsubscribe;
  }, [subscribeToTaskUpdates, onUpdate]);
}

export default TaskContext;
