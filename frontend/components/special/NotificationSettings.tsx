/**
 * NotificationSettings Component
 *
 * A settings panel for managing push notification preferences.
 * Displays toggles for different notification types and timing preferences.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNotifications } from "../../context/NotificationContext";
import { COLORS } from "../../theme";

type NotificationSettingsProps = {
  style?: any;
};

export default function NotificationSettings({ style }: NotificationSettingsProps) {
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

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTogglingTestMode, setIsTogglingTestMode] = useState(false);

  const handleToggleNotifications = async (enabled: boolean) => {
    setIsSaving(true);
    await updatePreferences({ enabled });
    setIsSaving(false);
  };

  const handleToggleMorningDigest = async (enabled: boolean) => {
    setIsSaving(true);
    await updatePreferences({
      morningDigest: { 
        enabled,
        hour: preferences?.morningDigest?.hour ?? 8,
        minute: preferences?.morningDigest?.minute ?? 0,
      },
    });
    setIsSaving(false);
  };

  const handleToggleTaskReminders = async (enabled: boolean) => {
    setIsSaving(true);
    await updatePreferences({
      taskReminders: { 
        enabled,
        defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
        useSmartReminders: preferences?.taskReminders?.useSmartReminders ?? true,
      },
    });
    setIsSaving(false);
  };

  const handleToggleSmartReminders = async (useSmartReminders: boolean) => {
    setIsSaving(true);
    await updatePreferences({
      taskReminders: { 
        enabled: preferences?.taskReminders?.enabled ?? true,
        defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
        useSmartReminders,
      },
    });
    setIsSaving(false);
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    await testNotification();
    setIsTesting(false);
  };

  const handleToggleTestMode = async () => {
    setIsTogglingTestMode(true);
    if (testModeActive) {
      await stopPeriodicTest();
    } else {
      await startPeriodicTest();
    }
    setIsTogglingTestMode(false);
  };

  const handleInitialize = async () => {
    await initialize();
  };

  // Not initialized - show setup button
  if (!isInitialized) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>🔔 Push Notifications</Text>

        {!isPhysicalDevice && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Push notifications only work on physical devices, not simulators.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleInitialize}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.colorWhite} />
          ) : (
            <Text style={styles.buttonText}>Enable Notifications</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Permission denied
  if (permissionStatus !== "granted") {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>🔔 Push Notifications</Text>
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Notifications are disabled. Please enable them in your device settings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>🔔 Push Notifications</Text>

      {/* Master toggle */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>All Notifications</Text>
          <Text style={styles.settingDescription}>Enable or disable all push notifications</Text>
        </View>
        <Switch
          value={preferences?.enabled ?? false}
          onValueChange={handleToggleNotifications}
          disabled={isSaving}
          trackColor={{ false: COLORS.white2, true: COLORS.primary1 }}
          thumbColor={preferences?.enabled ? COLORS.colorWhite : COLORS.lightGray}
        />
      </View>

      {preferences?.enabled && (
        <>
          {/* Morning Digest */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🌅 Morning Digest</Text>
              <Text style={styles.settingDescription}>
                Daily summary of tasks at {preferences?.morningDigest?.hour || 8}:00 AM
              </Text>
            </View>
            <Switch
              value={preferences?.morningDigest?.enabled ?? true}
              onValueChange={handleToggleMorningDigest}
              disabled={isSaving}
              trackColor={{ false: COLORS.white2, true: COLORS.primary1 }}
              thumbColor={preferences?.morningDigest?.enabled ? COLORS.colorWhite : COLORS.lightGray}
            />
          </View>

          {/* Task Reminders */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>⏰ Task Reminders</Text>
              <Text style={styles.settingDescription}>Get reminded before task deadlines</Text>
            </View>
            <Switch
              value={preferences?.taskReminders?.enabled ?? true}
              onValueChange={handleToggleTaskReminders}
              disabled={isSaving}
              trackColor={{ false: COLORS.white2, true: COLORS.primary1 }}
              thumbColor={preferences?.taskReminders?.enabled ? COLORS.colorWhite : COLORS.lightGray}
            />
          </View>

          {/* Smart Reminders */}
          {preferences?.taskReminders?.enabled && (
            <View style={[styles.settingRow, styles.nestedSetting]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>🧠 Smart Reminders</Text>
                <Text style={styles.settingDescription}>
                  Use AI to optimize reminder timing based on your behavior
                </Text>
              </View>
              <Switch
                value={preferences?.taskReminders?.useSmartReminders ?? true}
                onValueChange={handleToggleSmartReminders}
                disabled={isSaving}
                trackColor={{ false: COLORS.white2, true: COLORS.primary1 }}
                thumbColor={preferences?.taskReminders?.useSmartReminders ? COLORS.colorWhite : COLORS.lightGray}
              />
            </View>
          )}

          {/* Test Notification */}
          <View style={styles.testSection}>
            <TouchableOpacity
              style={[styles.testButton, isTesting && styles.buttonDisabled]}
              onPress={handleTestNotification}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator color={COLORS.primary1} />
              ) : (
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Periodic Test Mode */}
          <View style={styles.testModeSection}>
            <View style={styles.testModeHeader}>
              <Text style={styles.testModeTitle}>🔄 Periodic Test Mode</Text>
              {testModeActive && (
                <View style={styles.activeIndicator}>
                  <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.testModeDescription}>
              {testModeActive 
                ? 'Notifications are being sent every minute. Stop to disable.'
                : 'Start to receive a test notification every 1 minute.'
              }
            </Text>
            <TouchableOpacity
              style={[
                styles.testModeButton, 
                testModeActive ? styles.testModeButtonStop : styles.testModeButtonStart,
                isTogglingTestMode && styles.buttonDisabled
              ]}
              onPress={handleToggleTestMode}
              disabled={isTogglingTestMode}
            >
              {isTogglingTestMode ? (
                <ActivityIndicator color={COLORS.colorWhite} />
              ) : (
                <Text style={styles.testModeButtonText}>
                  {testModeActive ? '⏹️ Stop Test Mode' : '▶️ Start Test Mode'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Debug info (remove in production) */}
      {__DEV__ && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugText}>Token: {pushToken?.substring(0, 40)}...</Text>
          <Text style={styles.debugText}>Status: {permissionStatus}</Text>
          <Text style={styles.debugText}>Timezone: {preferences?.timezone}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white3,
  },
  nestedSetting: {
    marginLeft: 20,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.black,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.lightGray,
  },
  warningBox: {
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: "#856404",
  },
  errorBox: {
    backgroundColor: "#F8D7DA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#721C24",
  },
  button: {
    backgroundColor: COLORS.primary1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  testSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.white3,
  },
  testButton: {
    borderWidth: 1,
    borderColor: COLORS.primary1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary1,
  },
  debugSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: COLORS.white3,
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.lightGray,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: COLORS.lightGray,
    marginBottom: 2,
    fontFamily: "monospace",
  },
  testModeSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  testModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  testModeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F57C00",
  },
  testModeDescription: {
    fontSize: 13,
    color: "#795548",
    marginBottom: 12,
    lineHeight: 18,
  },
  activeIndicator: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeIndicatorText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.colorWhite,
  },
  testModeButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  testModeButtonStart: {
    backgroundColor: "#FF9800",
  },
  testModeButtonStop: {
    backgroundColor: "#F44336",
  },
  testModeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
});
