/**
 * NotificationContext
 *
 * Provides push notification state and functions throughout the app:
 * - Permission status
 * - Push token
 * - Notification preferences
 * - Handlers for incoming notifications
 */

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  initializePushNotifications,
  getNotificationPreferences,
  updateNotificationPreferences as updatePreferencesApi,
  sendTestNotification,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  isPhysicalDevice,
  NotificationPreferences,
  NotificationData,
} from "../services/notificationService";
import { useAuth } from "./AuthContext";

// Expo project ID from app.json
const EXPO_PROJECT_ID = "963e0c4f-be40-488b-8dee-75114924e74d";

type NotificationContextType = {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  permissionStatus: string | null;
  pushToken: string | null;
  preferences: NotificationPreferences | null;
  isPhysicalDevice: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  testNotification: () => Promise<boolean>;
  refreshPreferences: () => Promise<void>;

  // Last notification (if app opened from notification)
  lastNotification: NotificationData | null;
  clearLastNotification: () => void;
};

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useAuth();

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isPhysicalDeviceState, setIsPhysicalDeviceState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<NotificationData | null>(null);

  // Refs for listeners
  const notificationReceivedListener = useRef<{ remove: () => void } | null>(null);
  const notificationResponseListener = useRef<{ remove: () => void } | null>(null);

  // Check if running on physical device
  useEffect(() => {
    isPhysicalDevice().then(setIsPhysicalDeviceState);
  }, []);

  // Initialize notifications when user logs in
  useEffect(() => {
    if (user && token && !isInitialized) {
      initialize();
    }
  }, [user, token]);

  // Set up notification listeners
  useEffect(() => {
    const setupListeners = async () => {
      // Listen for notifications received while app is foregrounded
      notificationReceivedListener.current = await addNotificationReceivedListener(
        (notification: any) => {
          console.log("Notification received in foreground:", notification);
          // You can handle foreground notifications here
          // e.g., show an in-app banner, update task list, etc.
        }
      );

      // Listen for user interactions with notifications
      notificationResponseListener.current = await addNotificationResponseListener(
        (response: any) => {
          console.log("User tapped notification:", response);
          const data = response?.notification?.request?.content?.data as NotificationData;
          if (data) {
            setLastNotification(data);
            handleNotificationTap(data);
          }
        }
      );

      // Check if app was opened from a notification
      const lastResponse = await getLastNotificationResponse();
      if (lastResponse) {
        const data = lastResponse?.notification?.request?.content?.data as NotificationData;
        if (data) {
          setLastNotification(data);
        }
      }
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      notificationReceivedListener.current?.remove();
      notificationResponseListener.current?.remove();
    };
  }, []);

  /**
   * Handle notification tap - navigate or perform action based on notification type
   */
  const handleNotificationTap = useCallback((data: NotificationData) => {
    switch (data.type) {
      case "morning_digest":
        // Navigate to today's tasks or calendar view
        // This would integrate with your navigation context
        console.log("Morning digest tapped, taskIds:", data.taskIds);
        break;

      case "task_reminder":
        // Navigate to specific task
        console.log("Task reminder tapped, taskId:", data.taskId);
        break;

      case "test":
        // Test notification - no action needed
        console.log("Test notification tapped");
        break;

      default:
        console.log("Unknown notification type:", data.type);
    }
  }, []);

  /**
   * Initialize push notifications
   */
  const initialize = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await initializePushNotifications(EXPO_PROJECT_ID);

      setPermissionStatus(result.permissionStatus);
      setPushToken(result.token || null);
      setIsInitialized(true);

      if (!result.success) {
        setError(result.error || "Failed to initialize notifications");
      } else {
        // Fetch preferences after successful initialization
        await refreshPreferences();
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error initializing notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  /**
   * Refresh notification preferences from server
   */
  const refreshPreferences = useCallback(async () => {
    try {
      const result = await getNotificationPreferences();
      if (result.success && result.preferences) {
        setPreferences(result.preferences);
      }
    } catch (err) {
      console.error("Error refreshing preferences:", err);
    }
  }, []);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>): Promise<boolean> => {
      try {
        const result = await updatePreferencesApi(prefs);
        if (result.success && result.preferences) {
          setPreferences(result.preferences);
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error updating preferences:", err);
        return false;
      }
    },
    []
  );

  /**
   * Send a test notification
   */
  const testNotification = useCallback(async (): Promise<boolean> => {
    try {
      const result = await sendTestNotification();
      return result.success;
    } catch (err) {
      console.error("Error sending test notification:", err);
      return false;
    }
  }, []);

  /**
   * Clear last notification state
   */
  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  const value: NotificationContextType = {
    isInitialized,
    isLoading,
    permissionStatus,
    pushToken,
    preferences,
    isPhysicalDevice: isPhysicalDeviceState,
    error,
    initialize,
    updatePreferences,
    testNotification,
    refreshPreferences,
    lastNotification,
    clearLastNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export default NotificationContext;
