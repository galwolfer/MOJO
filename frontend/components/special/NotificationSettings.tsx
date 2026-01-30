/**
 * NotificationSettings Component
 *
 * A settings panel for managing push notification preferences.
 * Matches the styling of other settings screens (ChatSettings, ProfileSettings, etc.)
 */

import React, { useState } from "react";
import { View, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { useNotifications } from "../../context/NotificationContext";
import { COLORS, SPACING, FONT_SIZES } from "../../theme";
import { post } from "../../services/httpClient";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import Box from "../layout/Box";

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
  const [isTestingMorningDigest, setIsTestingMorningDigest] = useState(false);
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

  const handleMorningDigestTimeChange = async (hour: number, minute: number) => {
    setIsSaving(true);
    await updatePreferences({
      morningDigest: { 
        enabled: preferences?.morningDigest?.enabled ?? true,
        hour,
        minute,
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

  const handleTestMorningDigest = async () => {
    setIsTestingMorningDigest(true);
    try {
      const result = await post("/notifications/test/morning-digest", {});
      console.log('Morning digest test triggered:', result);
    } catch (error) {
      console.error('Error testing morning digest:', error);
    } finally {
      setIsTestingMorningDigest(false);
    }
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
      <Box title="Push Notifications" titleColor={COLORS.primary1}>
        <View style={styles.boxContent}>
          {!isPhysicalDevice && (
            <View style={styles.warningBox}>
              <AppText variant="notes" style={styles.warningText}>
                ⚠️ Push notifications only work on physical devices, not simulators.
              </AppText>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <AppText variant="notes" style={styles.errorText}>{error}</AppText>
            </View>
          )}

          <AppText variant="bodyText" style={styles.description}>
            Enable push notifications to receive morning task digests and smart reminders.
          </AppText>

          <AppButton
            title={isLoading ? "Enabling..." : "Enable Notifications"}
            onPress={handleInitialize}
            mode="filled"
            color="primary1"
            disabled={isLoading}
            style={styles.enableButton}
          />
        </View>
      </Box>
    );
  }

  // Permission denied
  if (permissionStatus !== "granted") {
    return (
      <Box title="Push Notifications" titleColor={COLORS.primary1}>
        <View style={styles.boxContent}>
          <View style={styles.warningBox}>
            <AppText variant="notes" style={styles.warningText}>
              Notifications are disabled. Please enable them in your device settings.
            </AppText>
          </View>
        </View>
      </Box>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Main Settings */}
      <Box title="Notification Preferences" titleColor={COLORS.primary1}>
        <View style={styles.boxContent}>
          <AppText variant="bodyText" style={styles.description}>
            Customize how and when you receive notifications from Mojo.
          </AppText>

          {/* Master toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <AppText variant="boldText" style={styles.settingLabel}>All Notifications</AppText>
              <AppText variant="notes" style={styles.settingDescription}>
                Enable or disable all push notifications
              </AppText>
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
                  <AppText variant="boldText" style={styles.settingLabel}>🌅 Morning Digest</AppText>
                  <AppText variant="notes" style={styles.settingDescription}>
                    Daily summary at {String(preferences?.morningDigest?.hour || 8).padStart(2, '0')}:{String(preferences?.morningDigest?.minute || 0).padStart(2, '0')}
                  </AppText>
                </View>
                <Switch
                  value={preferences?.morningDigest?.enabled ?? true}
                  onValueChange={handleToggleMorningDigest}
                  disabled={isSaving}
                  trackColor={{ false: COLORS.white2, true: COLORS.primary1 }}
                  thumbColor={preferences?.morningDigest?.enabled ? COLORS.colorWhite : COLORS.lightGray}
                />
              </View>

              {/* Morning Digest Time Picker */}
              {preferences?.morningDigest?.enabled && (
                <View style={styles.timePickerContainer}>
                  <AppText variant="boldText" style={styles.timePickerLabel}>Set Digest Time</AppText>
                  <View style={styles.timeInputGroup}>
                    {/* Hour Selector */}
                    <View style={styles.timeInputContainer}>
                      <TouchableOpacity 
                        onPress={() => {
                          const newHour = (preferences?.morningDigest?.hour || 8) > 0 
                            ? (preferences?.morningDigest?.hour || 8) - 1 
                            : 23;
                          handleMorningDigestTimeChange(newHour, preferences?.morningDigest?.minute || 0);
                        }}
                        disabled={isSaving}
                        style={[styles.timeButton, isSaving && styles.buttonDisabled]}
                      >
                        <AppText variant="boldText" style={styles.timeButtonText}>−</AppText>
                      </TouchableOpacity>
                      <AppText variant="title2" style={styles.timeDisplay}>
                        {String(preferences?.morningDigest?.hour || 8).padStart(2, '0')}
                      </AppText>
                      <TouchableOpacity 
                        onPress={() => {
                          const newHour = (preferences?.morningDigest?.hour || 8) < 23 
                            ? (preferences?.morningDigest?.hour || 8) + 1 
                            : 0;
                          handleMorningDigestTimeChange(newHour, preferences?.morningDigest?.minute || 0);
                        }}
                        disabled={isSaving}
                        style={[styles.timeButton, isSaving && styles.buttonDisabled]}
                      >
                        <AppText variant="boldText" style={styles.timeButtonText}>+</AppText>
                      </TouchableOpacity>
                    </View>
                    <AppText variant="title2" style={styles.timeSeparator}>:</AppText>
                    {/* Minute Selector */}
                    <View style={styles.timeInputContainer}>
                      <TouchableOpacity 
                        onPress={() => {
                          const newMinute = (preferences?.morningDigest?.minute || 0) > 0 
                            ? (preferences?.morningDigest?.minute || 0) - 1 
                            : 59;
                          handleMorningDigestTimeChange(preferences?.morningDigest?.hour || 8, newMinute);
                        }}
                        disabled={isSaving}
                        style={[styles.timeButton, isSaving && styles.buttonDisabled]}
                      >
                        <AppText variant="boldText" style={styles.timeButtonText}>−</AppText>
                      </TouchableOpacity>
                      <AppText variant="title2" style={styles.timeDisplay}>
                        {String(preferences?.morningDigest?.minute || 0).padStart(2, '0')}
                      </AppText>
                      <TouchableOpacity 
                        onPress={() => {
                          const newMinute = (preferences?.morningDigest?.minute || 0) < 59 
                            ? (preferences?.morningDigest?.minute || 0) + 1 
                            : 0;
                          handleMorningDigestTimeChange(preferences?.morningDigest?.hour || 8, newMinute);
                        }}
                        disabled={isSaving}
                        style={[styles.timeButton, isSaving && styles.buttonDisabled]}
                      >
                        <AppText variant="boldText" style={styles.timeButtonText}>+</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <AppText variant="notes" style={styles.timePickerHint}>Tap +/− to adjust the time</AppText>
                </View>
              )}

              {/* Task Reminders */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <AppText variant="boldText" style={styles.settingLabel}>⏰ Task Reminders</AppText>
                  <AppText variant="notes" style={styles.settingDescription}>
                    Get reminded before task deadlines
                  </AppText>
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
                    <AppText variant="boldText" style={styles.settingLabel}>🧠 Smart Reminders</AppText>
                    <AppText variant="notes" style={styles.settingDescription}>
                      Use AI to optimize reminder timing
                    </AppText>
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
            </>
          )}
        </View>
      </Box>

      {/* Test Section */}
      {preferences?.enabled && (
        <Box title="Test Notifications" titleColor={COLORS.primary5}>
          <View style={styles.boxContent}>
            <AppText variant="bodyText" style={styles.description}>
              Send test notifications to verify your setup is working correctly.
            </AppText>

            <View style={styles.buttonRow}>
              <AppButton
                title={isTesting ? "Sending..." : "Test Push"}
                onPress={handleTestNotification}
                mode="light"
                color="primary1"
                disabled={isTesting}
                style={styles.testBtn}
              />
              <AppButton
                title={isTestingMorningDigest ? "Sending..." : "Test Digest"}
                onPress={handleTestMorningDigest}
                mode="filled"
                color="primary1"
                disabled={isTestingMorningDigest}
                style={styles.testBtn}
              />
            </View>

            {/* Periodic Test Mode */}
            <View style={styles.testModeSection}>
              <View style={styles.testModeHeader}>
                <AppText variant="boldText" style={styles.testModeTitle}>🔄 Periodic Test Mode</AppText>
                {testModeActive && (
                  <View style={styles.activeIndicator}>
                    <AppText variant="notes" style={styles.activeIndicatorText}>ACTIVE</AppText>
                  </View>
                )}
              </View>
              <AppText variant="notes" style={styles.testModeDescription}>
                {testModeActive 
                  ? 'Notifications are being sent every minute. Stop to disable.'
                  : 'Start to receive a test notification every 1 minute.'
                }
              </AppText>
              <AppButton
                title={isTogglingTestMode 
                  ? "..." 
                  : testModeActive 
                    ? "⏹️ Stop Test Mode" 
                    : "▶️ Start Test Mode"
                }
                onPress={handleToggleTestMode}
                mode="filled"
                color={testModeActive ? "primary5" : "primary4"}
                disabled={isTogglingTestMode}
                style={styles.testModeBtn}
              />
            </View>
          </View>
        </Box>
      )}

      {/* Debug info (remove in production) */}
      {__DEV__ && (
        <Box title="Debug Info" titleColor={COLORS.lightGray}>
          <View style={styles.boxContent}>
            <AppText variant="notes" style={styles.debugText}>Token: {pushToken?.substring(0, 40)}...</AppText>
            <AppText variant="notes" style={styles.debugText}>Status: {permissionStatus}</AppText>
            <AppText variant="notes" style={styles.debugText}>Timezone: {preferences?.timezone}</AppText>
          </View>
        </Box>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  boxContent: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  description: {
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.base * 1.1,
    color: COLORS.darkGray,
    marginBottom: SPACING.sm,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white3,
  },
  nestedSetting: {
    marginLeft: SPACING.md,
    paddingLeft: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary1,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
  },
  // Time Picker
  timePickerContainer: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginLeft: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary1,
    alignItems: "center",
  },
  timePickerLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  timeInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
    width: "100%",
    direction: "ltr",
  },
  timeInputContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  timeButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
  },
  timeButtonText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.colorWhite,
  },
  timeDisplay: {
    fontSize: moderateScale(32),
    color: COLORS.black,
    minWidth: moderateScale(50),
    textAlign: "center",
  },
  timeSeparator: {
    fontSize: moderateScale(28),
    color: COLORS.black,
    marginHorizontal: SPACING.sm,
  },
  timePickerHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    textAlign: "center",
  },
  // Alerts
  warningBox: {
    backgroundColor: "#FFF3CD",
    borderRadius: moderateScale(12),
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  warningText: {
    color: "#856404",
  },
  errorBox: {
    backgroundColor: "#F8D7DA",
    borderRadius: moderateScale(12),
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: "#721C24",
  },
  // Buttons
  enableButton: {
    marginTop: SPACING.sm,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  testBtn: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Test Mode
  testModeSection: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white3,
    borderRadius: moderateScale(12),
  },
  testModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  testModeTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  testModeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginBottom: SPACING.sm,
    lineHeight: FONT_SIZES.sm * 1.3,
  },
  activeIndicator: {
    backgroundColor: "#4CAF50",
    borderRadius: moderateScale(12),
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  activeIndicatorText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    color: COLORS.colorWhite,
  },
  testModeBtn: {
    marginTop: SPACING.xs,
  },
  // Debug
  debugText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginBottom: 2,
    fontFamily: "monospace",
  },
});
