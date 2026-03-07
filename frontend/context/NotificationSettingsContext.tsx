/**
 * NotificationSettingsContext
 *
 * Manages all notification preferences, testing, and ui state for the notification settings screen.
 * Separates business logic from the UI component.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useNotifications } from "./NotificationContext";
import { post, get } from "../services/httpClient";
import { OjoType, OjoTypeOption } from "../services/notificationService";

type NotificationSettingsContextType = {
  // ── From useNotifications ────────────────────────────────────────────────
  isInitialized: boolean;
  isLoading: boolean;
  permissionStatus: string | null;
  pushToken: string | null;
  preferences: any;
  isPhysicalDevice: boolean;
  error: string | null;
  testModeActive: boolean;
  initialize: () => Promise<void>;
  updatePreferences: (partial: any) => Promise<boolean>;
  testNotification: () => Promise<boolean>;
  startPeriodicTest: () => Promise<boolean>;
  stopPeriodicTest: () => Promise<boolean>;

  // ── UI State ─────────────────────────────────────────────────────────────
  isSaving: boolean;
  isTesting: boolean;
  isTestingMorningDigest: boolean;
  isTogglingTestMode: boolean;
  isTestingSmartReminder: boolean;
  isTestingDefaultReminder: boolean;
  isTestingOjo: boolean;
  smartReminderResult: any;
  availableOjoTypes: OjoTypeOption[];

  // ── Derived preferences ──────────────────────────────────────────────────
  allEnabled: boolean;
  digestEnabled: boolean;
  digestHour: number;
  digestMinute: number;
  taskRemindersEnabled: boolean;
  smartRemindersEnabled: boolean;
  ojoEnabled: boolean;

  // ── Save helper ──────────────────────────────────────────────────────────
  save: (fn: () => Promise<unknown>) => Promise<void>;

  // ── Handlers ─────────────────────────────────────────────────────────────
  handleToggleNotifications: (enabled: boolean) => Promise<void>;
  handleToggleMorningDigest: (enabled: boolean) => Promise<void>;
  changeDigestTime: (hour: number, minute: number) => Promise<void>;
  handleToggleTaskReminders: (enabled: boolean) => Promise<void>;
  handleToggleSmartReminders: (useSmartReminders: boolean) => Promise<void>;
  handleToggleOjoNotifications: (enabled: boolean) => Promise<void>;
  handleSelectOjoType: (ojoType: OjoType) => Promise<void>;
  handleTestNotification: () => Promise<void>;
  handleTestMorningDigest: () => Promise<void>;
  handleTestSmartReminder: () => Promise<void>;
  handleTestDefaultReminder: () => Promise<void>;
  handleTestSmartCalculation: () => Promise<void>;
  handleTestOjoNotification: (ojoType?: OjoType) => Promise<void>;
  handleToggleTestMode: () => Promise<void>;
};

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

export function NotificationSettingsProvider({ children }: { children: React.ReactNode }) {
  const {
    isInitialized,
    isLoading,
    permissionStatus,
    pushToken,
    preferences,
    isPhysicalDevice,
    error,
    testModeActive,
    initialize,
    updatePreferences,
    testNotification,
    startPeriodicTest,
    stopPeriodicTest,
  } = useNotifications();

  // ── UI State ─────────────────────────────────────────────────────────────

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingMorningDigest, setIsTestingMorningDigest] = useState(false);
  const [isTogglingTestMode, setIsTogglingTestMode] = useState(false);
  const [isTestingSmartReminder, setIsTestingSmartReminder] = useState(false);
  const [isTestingDefaultReminder, setIsTestingDefaultReminder] = useState(false);
  const [smartReminderResult, setSmartReminderResult] = useState<any>(null);
  const [availableOjoTypes, setAvailableOjoTypes] = useState<OjoTypeOption[]>([]);
  const [isTestingOjo, setIsTestingOjo] = useState(false);

  // ── Fetch available ojo types ────────────────────────────────────────────

  useEffect(() => {
    if (!isInitialized) return;
    get<{ success: boolean; availableOjoTypes?: OjoTypeOption[] }>("/notifications/preferences")
      .then((r) => {
        if (r.success && r.availableOjoTypes) setAvailableOjoTypes(r.availableOjoTypes);
      })
      .catch(() => {});
  }, [isInitialized]);

  // ── Derived preferences ──────────────────────────────────────────────────

  const allEnabled = preferences?.enabled ?? false;
  const digestEnabled = preferences?.morningDigest?.enabled ?? true;
  const digestHour = preferences?.morningDigest?.hour ?? 8;
  const digestMinute = preferences?.morningDigest?.minute ?? 0;
  const taskRemindersEnabled = preferences?.taskReminders?.enabled ?? true;
  const smartRemindersEnabled = preferences?.taskReminders?.useSmartReminders ?? true;
  const ojoEnabled = preferences?.ojoNotifications?.enabled ?? false;

  // ── Save helper ──────────────────────────────────────────────────────────

  const save = useCallback(async (fn: () => Promise<unknown>) => {
    setIsSaving(true);
    try {
      await fn();
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleNotifications = useCallback(
    (enabled: boolean) => save(() => updatePreferences({ enabled })),
    [save, updatePreferences],
  );

  const handleToggleMorningDigest = useCallback(
    (enabled: boolean) =>
      save(() =>
        updatePreferences({
          morningDigest: { enabled, hour: digestHour, minute: digestMinute },
        }),
      ),
    [save, updatePreferences, digestHour, digestMinute],
  );

  const changeDigestTime = useCallback(
    (hour: number, minute: number) =>
      save(() =>
        updatePreferences({
          morningDigest: {
            enabled: preferences?.morningDigest?.enabled ?? true,
            hour,
            minute,
          },
        }),
      ),
    [save, updatePreferences, preferences],
  );

  const handleToggleTaskReminders = useCallback(
    (enabled: boolean) =>
      save(() =>
        updatePreferences({
          taskReminders: {
            enabled,
            defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
            useSmartReminders: preferences?.taskReminders?.useSmartReminders ?? true,
          },
        }),
      ),
    [save, updatePreferences, preferences],
  );

  const handleToggleSmartReminders = useCallback(
    (useSmartReminders: boolean) =>
      save(() =>
        updatePreferences({
          taskReminders: {
            enabled: preferences?.taskReminders?.enabled ?? true,
            defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
            useSmartReminders,
          },
        }),
      ),
    [save, updatePreferences, preferences],
  );

  const handleToggleOjoNotifications = useCallback(
    (enabled: boolean) =>
      save(() =>
        updatePreferences({
          ojoNotifications: {
            enabled,
            selectedOjoType: preferences?.ojoNotifications?.selectedOjoType ?? null,
          },
        }),
      ),
    [save, updatePreferences, preferences],
  );

  const handleSelectOjoType = useCallback(
    (ojoType: OjoType) =>
      save(() =>
        updatePreferences({
          ojoNotifications: {
            enabled: true, // selecting a type always enables Ojo personality
            selectedOjoType: ojoType,
          },
        }),
      ),
    [save, updatePreferences],
  );

  const handleTestNotification = useCallback(async () => {
    setIsTesting(true);
    await testNotification();
    setIsTesting(false);
  }, [testNotification]);

  const handleTestMorningDigest = useCallback(async () => {
    setIsTestingMorningDigest(true);
    try {
      await post("/notifications/test/morning-digest", {});
    } catch {
    } finally {
      setIsTestingMorningDigest(false);
    }
  }, []);

  const handleTestSmartReminder = useCallback(async () => {
    setIsTestingSmartReminder(true);
    try {
      await post("/notifications/test/task-reminder", { useSmartReminders: true, useOjo: false });
    } catch {
    } finally {
      setIsTestingSmartReminder(false);
    }
  }, []);

  const handleTestDefaultReminder = useCallback(async () => {
    setIsTestingDefaultReminder(true);
    try {
      await post("/notifications/test/task-reminder", { useSmartReminders: false, useOjo: false });
    } catch {
    } finally {
      setIsTestingDefaultReminder(false);
    }
  }, []);

  const handleTestSmartCalculation = useCallback(async () => {
    try {
      const result = await post("/notifications/test/smart-reminder", {});
      setSmartReminderResult(result);
    } catch {
      setSmartReminderResult({ success: false, error: "Failed to calculate" });
    }
  }, []);

  const handleTestOjoNotification = useCallback(async (ojoType?: OjoType) => {
    setIsTestingOjo(true);
    try {
      await post("/notifications/test/ojo-reminder", { ojoType });
    } catch {
    } finally {
      setIsTestingOjo(false);
    }
  }, []);

  const handleToggleTestMode = useCallback(async () => {
    setIsTogglingTestMode(true);
    if (testModeActive) await stopPeriodicTest();
    else await startPeriodicTest();
    setIsTogglingTestMode(false);
  }, [testModeActive, stopPeriodicTest, startPeriodicTest]);

  // ── Context value ────────────────────────────────────────────────────────

  const value = useMemo<NotificationSettingsContextType>(
    () => ({
      isInitialized,
      isLoading,
      permissionStatus,
      pushToken,
      preferences,
      isPhysicalDevice,
      error,
      testModeActive,
      initialize,
      updatePreferences,
      testNotification,
      startPeriodicTest,
      stopPeriodicTest,
      isSaving,
      isTesting,
      isTestingMorningDigest,
      isTogglingTestMode,
      isTestingSmartReminder,
      isTestingDefaultReminder,
      isTestingOjo,
      smartReminderResult,
      availableOjoTypes,
      allEnabled,
      digestEnabled,
      digestHour,
      digestMinute,
      taskRemindersEnabled,
      smartRemindersEnabled,
      ojoEnabled,
      save,
      handleToggleNotifications,
      handleToggleMorningDigest,
      changeDigestTime,
      handleToggleTaskReminders,
      handleToggleSmartReminders,
      handleToggleOjoNotifications,
      handleSelectOjoType,
      handleTestNotification,
      handleTestMorningDigest,
      handleTestSmartReminder,
      handleTestDefaultReminder,
      handleTestSmartCalculation,
      handleTestOjoNotification,
      handleToggleTestMode,
    }),
    [
      isInitialized,
      isLoading,
      permissionStatus,
      pushToken,
      preferences,
      isPhysicalDevice,
      error,
      testModeActive,
      initialize,
      updatePreferences,
      testNotification,
      startPeriodicTest,
      stopPeriodicTest,
      isSaving,
      isTesting,
      isTestingMorningDigest,
      isTogglingTestMode,
      isTestingSmartReminder,
      isTestingDefaultReminder,
      isTestingOjo,
      smartReminderResult,
      availableOjoTypes,
      allEnabled,
      digestEnabled,
      digestHour,
      digestMinute,
      taskRemindersEnabled,
      smartRemindersEnabled,
      ojoEnabled,
      save,
      handleToggleNotifications,
      handleToggleMorningDigest,
      changeDigestTime,
      handleToggleTaskReminders,
      handleToggleSmartReminders,
      handleToggleOjoNotifications,
      handleSelectOjoType,
      handleTestNotification,
      handleTestMorningDigest,
      handleTestSmartReminder,
      handleTestDefaultReminder,
      handleTestSmartCalculation,
      handleTestOjoNotification,
      handleToggleTestMode,
    ],
  );

  return <NotificationSettingsContext.Provider value={value}>{children}</NotificationSettingsContext.Provider>;
}

export function useNotificationSettings(): NotificationSettingsContextType {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error("useNotificationSettings must be used within NotificationSettingsProvider");
  }
  return context;
}
