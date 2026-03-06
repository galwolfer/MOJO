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
import { Platform } from "react-native";
import {
  initializePushNotifications,
  getNotificationPreferences,
  updateNotificationPreferences as updatePreferencesApi,
  sendTestNotification,
  startPeriodicTestNotifications as startPeriodicTestApi,
  stopPeriodicTestNotifications as stopPeriodicTestApi,
  getTestModeStatus,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  isPhysicalDevice,
  NotificationPreferences,
  NotificationData,
  getUnreadCount,
  getInboxNotifications,
} from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { type OjoNotificationBannerData } from "../components/special/OjoNotificationBanner";

// Expo project ID from app.json
const EXPO_PROJECT_ID = "875a7d38-e45f-45b2-9bee-a15823df2f34";

type NotificationContextType = {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  permissionStatus: string | null;
  pushToken: string | null;
  preferences: NotificationPreferences | null;
  isPhysicalDevice: boolean;
  error: string | null;
  testModeActive: boolean;
  unreadCount: number;

  // Banner
  bannerData: OjoNotificationBannerData | null;
  dismissBanner: () => void;

  // Actions
  initialize: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  testNotification: () => Promise<boolean>;
  startPeriodicTest: () => Promise<boolean>;
  stopPeriodicTest: () => Promise<boolean>;
  refreshPreferences: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;

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
  const [testModeActive, setTestModeActive] = useState(false);
  const [bannerData, setBannerData] = useState<OjoNotificationBannerData | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs for listeners
  const notificationReceivedListener = useRef<{ remove: () => void } | null>(null);
  const notificationResponseListener = useRef<{ remove: () => void } | null>(null);

  /** Tracks the newest notification id we've already seen, so the web poller can detect new ones. */
  const lastSeenNotificationIdRef = useRef<string | null>(null);

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

  // Check test mode status when initialized
  useEffect(() => {
    if (isInitialized && user && token) {
      checkTestModeStatus();
    }
  }, [isInitialized, user, token]);

  const checkTestModeStatus = async () => {
    const result = await getTestModeStatus();
    if (result.success && result.testModeActive !== undefined) {
      setTestModeActive(result.testModeActive);
    }
  };

  // Set up notification listeners
  useEffect(() => {
    const setupListeners = async () => {
      // Listen for notifications received while app is foregrounded
      notificationReceivedListener.current = await addNotificationReceivedListener(
        (notification: any) => {
          console.log("Notification received in foreground:", notification);
          const content = notification?.request?.content;
          const data = content?.data;

          // Bump unread count for the in-app inbox
          setUnreadCount((prev) => prev + 1);

          // Show in-app banner for ALL foreground notifications
          setBannerData({
            ojoType: data?.ojoType || null,
            title: content?.title || "Notification",
            body: content?.body || "",
          });
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
    
    // Don't try to initialize if user is not authenticated
    if (!user || !token) {
      console.log('Skipping notification init - user not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await initializePushNotifications(EXPO_PROJECT_ID);

      setPermissionStatus(result.permissionStatus);
      setPushToken(result.token || null);
      setIsInitialized(true);

      if (!result.success) {
        // Don't show Firebase config errors as errors to user - just log them
        if (result.error?.includes('Firebase') || result.error?.includes('FCM')) {
          console.warn('Push notifications unavailable:', result.error);
        } else {
          setError(result.error || "Failed to initialize notifications");
        }
      } else if (result.token) {
        // Only fetch preferences if we have a valid token
        await refreshPreferences();
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error initializing notifications:", err);
      // Still mark as initialized so the inbox / unread polling works (esp. on web)
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, user, token]);

  /**
   * Refresh notification preferences from server
   */
  const refreshPreferences = useCallback(async () => {
    if (!user || !token) {
      console.log('Skipping preferences refresh - user not authenticated');
      return;
    }
    try {
      const result = await getNotificationPreferences();
      if (result.success && result.preferences) {
        setPreferences(result.preferences);
      }
    } catch (err) {
      console.error("Error refreshing preferences:", err);
    }
  }, [user, token]);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>): Promise<boolean> => {
      if (!user || !token) {
        console.log('Skipping preferences update - user not authenticated');
        return false;
      }
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
    [user, token]
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
   * Start periodic test notifications (every 1 minute)
   */
  const startPeriodicTest = useCallback(async (): Promise<boolean> => {
    try {
      const result = await startPeriodicTestApi();
      if (result.success) {
        setTestModeActive(true);
      }
      return result.success;
    } catch (err) {
      console.error("Error starting periodic test:", err);
      return false;
    }
  }, []);

  /**
   * Stop periodic test notifications
   */
  const stopPeriodicTest = useCallback(async (): Promise<boolean> => {
    try {
      const result = await stopPeriodicTestApi();
      if (result.success) {
        setTestModeActive(false);
      }
      return result.success;
    } catch (err) {
      console.error("Error stopping periodic test:", err);
      return false;
    }
  }, []);

  /**
   * Clear last notification state
   */
  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  /**
   * Refresh unread notification count from the server
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!user || !token) return;
    try {
      const result = await getUnreadCount();
      if (result.success) {
        setUnreadCount(result.unreadCount);
      }
    } catch (err) {
      console.error("Error refreshing unread count:", err);
    }
  }, [user, token]);

  // Poll unread count once on init, then periodically (covers web where push listeners don't fire)
  useEffect(() => {
    if (!user || !token) return;

    // Initial fetch
    refreshUnreadCount();

    // Periodic refresh every 30 seconds so the badge stays current on web
    const interval = setInterval(refreshUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [user, token, refreshUnreadCount]);

  // ── Web-specific polling: detect new notifications and show the banner ──
  useEffect(() => {
    if (Platform.OS !== "web" || !user || !token) return;

    let cancelled = false;

    const pollForNewNotifications = async () => {
      try {
        const result = await getInboxNotifications({ limit: 1 });
        if (cancelled || !result.success || result.notifications.length === 0) return;

        const newest = result.notifications[0];

        // On the very first poll just seed the ref — don't show a stale banner.
        if (lastSeenNotificationIdRef.current === null) {
          lastSeenNotificationIdRef.current = newest._id;
          return;
        }

        // If the newest notification id changed, a new notification arrived.
        if (newest._id !== lastSeenNotificationIdRef.current) {
          lastSeenNotificationIdRef.current = newest._id;
          setUnreadCount((prev) => Math.max(prev, 1));
          const validOjoTypes = ["mentorjo", "brojo", "bestojo", "strictojo"];
          const ojoType = newest.ojoType && validOjoTypes.includes(newest.ojoType)
            ? (newest.ojoType as OjoNotificationBannerData["ojoType"])
            : null;
          setBannerData({
            ojoType,
            title: newest.title || "Notification",
            body: newest.body || "",
          });
          // Also refresh the real count from server
          refreshUnreadCount();
        }
      } catch {
        // Silently ignore polling failures
      }
    };

    // Seed immediately, then poll every 15s
    pollForNewNotifications();
    const interval = setInterval(pollForNewNotifications, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, token]);

  const value: NotificationContextType = {
    isInitialized,
    isLoading,
    permissionStatus,
    pushToken,
    preferences,
    isPhysicalDevice: isPhysicalDeviceState,
    error,
    testModeActive,
    unreadCount,
    bannerData,
    dismissBanner: () => setBannerData(null),
    initialize,
    updatePreferences,
    testNotification,
    startPeriodicTest,
    stopPeriodicTest,
    refreshPreferences,
    refreshUnreadCount,
    lastNotification,
    clearLastNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
