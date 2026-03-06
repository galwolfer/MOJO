/**
 * Push Notification Service for Frontend
 *
 * Handles:
 * - Requesting notification permissions
 * - Getting Expo Push Token
 * - Registering token with backend
 * - Handling incoming notifications
 * - Managing notification preferences
 */

import { Platform } from "react-native";
import { post, get, put, del, patch } from "./httpClient";

// Types
export type OjoType = "mentorjo" | "brojo" | "bestojo" | "strictojo" | "chat";

export type OjoTypeOption = {
  name: OjoType;
  displayName: string;
  persona: string;
  tones: string[];
};

export type NotificationPreferences = {
  enabled: boolean;
  morningDigest: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  taskReminders: {
    enabled: boolean;
    defaultReminderMinutes: number;
    useSmartReminders: boolean;
  };
  ojoNotifications?: {
    enabled: boolean;
    selectedOjoType: OjoType | null;
  };
  timezone: string;
  expoPushToken?: string | null;
  platform?: string | null;
  lastMorningDigest?: string | null;
  lastTaskReminder?: string | null;
};

export type NotificationData = {
  type: "morning_digest" | "task_reminder" | "test" | string;
  taskId?: string;
  taskIds?: string[];
  taskCount?: number;
  highPriorityCount?: number;
  urgency?: "low" | "normal" | "high" | "critical";
  [key: string]: any;
};

export type PushNotification = {
  title?: string;
  body?: string;
  data?: NotificationData;
};

// Lazy load expo-notifications and expo-device to avoid issues when not installed
let Notifications: any = null;
let Device: any = null;

async function loadNotificationModules() {
  if (Notifications && Device) return { Notifications, Device };

  try {
    Notifications = await import("expo-notifications");
    Device = await import("expo-device");
    return { Notifications, Device };
  } catch (error) {
    console.warn("Notification modules not available:", error);
    return { Notifications: null, Device: null };
  }
}

/**
 * Check if we're running on a physical device
 * Push notifications only work on physical devices
 */
export async function isPhysicalDevice(): Promise<boolean> {
  const { Device } = await loadNotificationModules();
  if (!Device) return false;
  return Device.isDevice;
}

/**
 * Request notification permissions from the user
 * @returns Permission status
 */
export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
  status: string;
}> {
  const { Notifications, Device } = await loadNotificationModules();

  if (!Notifications || !Device) {
    return { granted: false, status: "unavailable" };
  }

  // Check if we're on a physical device
  if (!Device.isDevice) {
    console.warn("Push notifications only work on physical devices");
    return { granted: false, status: "emulator" };
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return {
      granted: finalStatus === "granted",
      status: finalStatus,
    };
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return { granted: false, status: "error" };
  }
}

/**
 * Get the Expo Push Token for this device
 * @param projectId - Expo project ID (from app.json extra.eas.projectId)
 * @returns Expo Push Token or null
 */
export async function getExpoPushToken(projectId?: string): Promise<string | null> {
  const { Notifications, Device } = await loadNotificationModules();

  if (!Notifications || !Device) {
    console.warn("Notification modules not available");
    return null;
  }

  if (!Device.isDevice) {
    console.warn("Push tokens only available on physical devices");
    return null;
  }

  try {
    // Get the token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    return tokenData.data;
  } catch (error: any) {
    // Check if this is a Firebase configuration error
    const errorMessage = error?.message || '';
    if (errorMessage.includes('FirebaseApp is not initialized') || 
        errorMessage.includes('FCM') || 
        errorMessage.includes('Firebase')) {
      console.warn(
        '⚠️ Firebase/FCM is not configured. Push notifications will not work.\n' +
        'To enable push notifications:\n' +
        '1. Create a Firebase project at https://console.firebase.google.com\n' +
        '2. Add an Android app with package name: com.mojo.Mojo\n' +
        '3. Download google-services.json to frontend/services/secrets/google-services.json\n' +
        '4. Rebuild the app with: npx expo prebuild --clean && npx expo run:android'
      );
      return null;
    }
    console.error("Error getting Expo push token:", error);
    return null;
  }
}

/**
 * Register push token with the backend
 * @param token - Expo Push Token
 * @returns Success status
 */
export async function registerPushToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = Platform.OS as "ios" | "android" | "web";

    const response = await post<{ success: boolean; message?: string; error?: string }>(
      "/notifications/register",
      { token, platform }
    );

    return { success: response.success };
  } catch (error: any) {
    console.error("Error registering push token:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Unregister push token (disable notifications)
 * @returns Success status
 */
export async function unregisterPushToken(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await post<{ success: boolean; message?: string; error?: string }>(
      "/notifications/unregister",
      {}
    );

    return { success: response.success };
  } catch (error: any) {
    console.error("Error unregistering push token:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification preferences from backend
 * @returns Notification preferences
 */
export async function getNotificationPreferences(): Promise<{
  success: boolean;
  preferences?: NotificationPreferences;
  error?: string;
}> {
  try {
    const response = await get<{
      success: boolean;
      preferences: NotificationPreferences;
    }>("/notifications/preferences");

    return { success: true, preferences: response.preferences };
  } catch (error: any) {
    console.error("Error getting notification preferences:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update notification preferences on backend
 * @param preferences - Partial preferences to update
 * @returns Updated preferences
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<{
  success: boolean;
  preferences?: NotificationPreferences;
  error?: string;
}> {
  try {
    const response = await put<{
      success: boolean;
      preferences: NotificationPreferences;
    }>("/notifications/preferences", preferences);

    return { success: true, preferences: response.preferences };
  } catch (error: any) {
    console.error("Error updating notification preferences:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test notification to verify setup
 * @returns Success status
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await post<{ success: boolean; message?: string; error?: string }>(
      "/notifications/test",
      {}
    );

    return { success: response.success };
  } catch (error: any) {
    console.error("Error sending test notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Start periodic test notifications (every 1 minute)
 * @returns Success status
 */
export async function startPeriodicTestNotifications(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await post<{ success: boolean; message?: string; error?: string }>(
      "/notifications/test/start",
      {}
    );

    return { success: response.success, message: response.message };
  } catch (error: any) {
    console.error("Error starting periodic test:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop periodic test notifications
 * @returns Success status
 */
export async function stopPeriodicTestNotifications(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await post<{ success: boolean; message?: string; error?: string }>(
      "/notifications/test/stop",
      {}
    );

    return { success: response.success, message: response.message };
  } catch (error: any) {
    console.error("Error stopping periodic test:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if periodic test mode is active
 * @returns Test mode status
 */
export async function getTestModeStatus(): Promise<{ success: boolean; testModeActive?: boolean; error?: string }> {
  try {
    const response = await get<{ success: boolean; testModeActive: boolean }>(
      "/notifications/test/status"
    );

    return { success: true, testModeActive: response.testModeActive };
  } catch (error: any) {
    console.error("Error getting test mode status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Set up notification channels for Android
 * Required for Android 8+ to display notifications
 */
export async function setupNotificationChannels(): Promise<void> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications || Platform.OS !== "android") return;

  try {
    // Morning digest channel
    await Notifications.setNotificationChannelAsync("morning-digest", {
      name: "Morning Task Digest",
      description: "Daily morning summary of your tasks",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B6B",
      sound: "default",
    });

    // Task reminders channel
    await Notifications.setNotificationChannelAsync("task-reminders", {
      name: "Task Reminders",
      description: "Reminders for upcoming tasks",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4ECDC4",
      sound: "default",
    });

    // Default channel
    await Notifications.setNotificationChannelAsync("default", {
      name: "General Notifications",
      description: "General app notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });

    console.log("Notification channels set up successfully");
  } catch (error) {
    console.error("Error setting up notification channels:", error);
  }
}

/**
 * Configure notification handler for when app is in foreground
 * @param handler - Function to handle incoming notifications
 */
export async function setNotificationHandler(
  handler?: (notification: PushNotification) => void
): Promise<void> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return;

  // Set default notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Add listener for received notifications (foreground)
 * @param callback - Function called when notification is received
 * @returns Subscription object to remove listener
 */
export async function addNotificationReceivedListener(
  callback: (notification: any) => void
): Promise<{ remove: () => void } | null> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return null;

  const subscription = Notifications.addNotificationReceivedListener(callback);
  return subscription;
}

/**
 * Add listener for notification responses (user tapped notification)
 * @param callback - Function called when user interacts with notification
 * @returns Subscription object to remove listener
 */
export async function addNotificationResponseListener(
  callback: (response: any) => void
): Promise<{ remove: () => void } | null> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return null;

  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return subscription;
}

/**
 * Get the last notification response (if app was opened from notification)
 * @returns Last notification response or null
 */
export async function getLastNotificationResponse(): Promise<any | null> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return null;

  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    console.error("Error getting last notification response:", error);
    return null;
  }
}

/**
 * Schedule a local notification (for testing or immediate alerts)
 * @param content - Notification content
 * @param trigger - When to show the notification
 * @returns Notification identifier
 */
export async function scheduleLocalNotification(
  content: { title: string; body: string; data?: any },
  trigger?: { seconds?: number } | null
): Promise<string | null> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data || {},
        sound: true,
      },
      trigger: trigger || null, // null = immediate
    });

    return identifier;
  } catch (error) {
    console.error("Error scheduling local notification:", error);
    return null;
  }
}

/**
 * Cancel all scheduled local notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  const { Notifications } = await loadNotificationModules();

  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling notifications:", error);
  }
}

/**
 * Get device's timezone
 * @returns IANA timezone string
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Initialize push notifications
 * Complete setup including permissions, token registration, and channels
 *
 * @param projectId - Expo project ID
 * @returns Setup result
 */
export async function initializePushNotifications(projectId?: string): Promise<{
  success: boolean;
  token?: string | null;
  permissionStatus: string;
  error?: string;
}> {
  try {
    // Set up Android notification channels
    await setupNotificationChannels();

    // Set notification handler
    await setNotificationHandler();

    // Request permissions
    const { granted, status } = await requestNotificationPermissions();

    if (!granted) {
      return {
        success: false,
        permissionStatus: status,
        error: "Notification permission not granted",
      };
    }

    // Get push token
    const token = await getExpoPushToken(projectId);

    if (!token) {
      return {
        success: false,
        permissionStatus: status,
        error: "Could not get push token",
      };
    }

    // Register token with backend
    const registerResult = await registerPushToken(token);

    if (!registerResult.success) {
      return {
        success: false,
        token,
        permissionStatus: status,
        error: registerResult.error || "Failed to register token",
      };
    }

    // Update timezone preference
    const timezone = getDeviceTimezone();
    await updateNotificationPreferences({ timezone });

    return {
      success: true,
      token,
      permissionStatus: status,
    };
  } catch (error: any) {
    console.error("Error initializing push notifications:", error);
    return {
      success: false,
      permissionStatus: "error",
      error: error.message,
    };
  }
}

// ─── In-App Notification Inbox ─────────────────────────────────────────

export type InAppNotification = {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  ojoType: OjoType | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fetch in-app notifications for the current user.
 * Supports cursor-based pagination via `before` (ISO date).
 */
export async function getInboxNotifications(options?: {
  limit?: number;
  before?: string;
  unreadOnly?: boolean;
}): Promise<{ success: boolean; notifications: InAppNotification[]; unreadCount: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.before) params.set("before", options.before);
    if (options?.unreadOnly) params.set("unreadOnly", "true");

    const qs = params.toString();
    const response = await get<{
      success: boolean;
      notifications: InAppNotification[];
      unreadCount: number;
    }>(`/notifications/inbox${qs ? `?${qs}` : ""}`);

    return {
      success: true,
      notifications: response.notifications ?? [],
      unreadCount: response.unreadCount ?? 0,
    };
  } catch (error: any) {
    console.error("Error fetching inbox notifications:", error);
    return { success: false, notifications: [], unreadCount: 0 };
  }
}

/**
 * Get the unread notification count (lightweight endpoint).
 */
export async function getUnreadCount(): Promise<{ success: boolean; unreadCount: number }> {
  try {
    const response = await get<{ success: boolean; unreadCount: number }>(
      "/notifications/inbox/unread-count",
    );
    return { success: true, unreadCount: response.unreadCount ?? 0 };
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    return { success: false, unreadCount: 0 };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<{ success: boolean }> {
  try {
    await patch<{ success: boolean }>(`/notifications/inbox/${notificationId}/read`, {});
    return { success: true };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return { success: false };
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  try {
    await patch<{ success: boolean }>("/notifications/inbox/read-all", {});
    return { success: true };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return { success: false };
  }
}

/**
 * Delete a single in-app notification.
 */
export async function deleteNotification(
  notificationId: string,
): Promise<{ success: boolean }> {
  try {
    await del<{ success: boolean }>(`/notifications/inbox/${notificationId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    return { success: false };
  }
}
