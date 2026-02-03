/**
 * NotificationSettings Component
 *
 * A settings panel for managing push notification preferences.
 * Matches the styling of other settings screens (ChatSettings, ProfileSettings, etc.)
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, Switch, TouchableOpacity, Text } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { useNotifications } from "../../context/NotificationContext";
import { COLORS, SPACING, FONT_SIZES } from "../../theme";
import { post, get } from "../../services/httpClient";
import { OjoType, OjoTypeOption } from "../../services/notificationService";
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
  const [isTestingSmartReminder, setIsTestingSmartReminder] = useState(false);
  const [isTestingDefaultReminder, setIsTestingDefaultReminder] = useState(false);
  const [smartReminderResult, setSmartReminderResult] = useState<any>(null);
  const [availableOjoTypes, setAvailableOjoTypes] = useState<OjoTypeOption[]>([]);
  const [isTestingOjo, setIsTestingOjo] = useState(false);

  // Fetch available Ojo types when component mounts
  useEffect(() => {
    const fetchOjoTypes = async () => {
      try {
        const result = await get<{ success: boolean; availableOjoTypes?: OjoTypeOption[] }>("/notifications/preferences");
        if (result.success && result.availableOjoTypes) {
          setAvailableOjoTypes(result.availableOjoTypes);
        }
      } catch (error) {
        console.error('Error fetching Ojo types:', error);
      }
    };
    if (isInitialized) {
      fetchOjoTypes();
    }
  }, [isInitialized]);

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

  const handleToggleOjoNotifications = async (enabled: boolean) => {
    setIsSaving(true);
    await updatePreferences({
      ojoNotifications: { 
        enabled,
        selectedOjoType: preferences?.ojoNotifications?.selectedOjoType ?? null,
      },
    });
    setIsSaving(false);
  };

  const handleSelectOjoType = async (ojoType: OjoType) => {
    setIsSaving(true);
    await updatePreferences({
      ojoNotifications: { 
        enabled: preferences?.ojoNotifications?.enabled ?? true,
        selectedOjoType: ojoType,
      },
    });
    setIsSaving(false);
  };

  const handleTestOjoNotification = async (ojoType?: OjoType) => {
    setIsTestingOjo(true);
    try {
      const result = await post("/notifications/test/ojo-reminder", { ojoType });
      console.log('Ojo reminder test triggered:', result);
    } catch (error) {
      console.error('Error testing Ojo notification:', error);
    } finally {
      setIsTestingOjo(false);
    }
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

  const handleTestSmartReminder = async () => {
    setIsTestingSmartReminder(true);
    try {
      // Smart test: uses prediction model for timing, but NO Ojo (fixed notification text)
      const result = await post("/notifications/test/task-reminder", { useSmartReminders: true, useOjo: false });
      console.log('Smart reminder test triggered:', result);
    } catch (error) {
      console.error('Error testing smart reminder:', error);
    } finally {
      setIsTestingSmartReminder(false);
    }
  };

  const handleTestDefaultReminder = async () => {
    setIsTestingDefaultReminder(true);
    try {
      // Default test: NO prediction model, NO Ojo (completely fixed notification)
      const result = await post("/notifications/test/task-reminder", { useSmartReminders: false, useOjo: false });
      console.log('Default reminder test triggered:', result);
    } catch (error) {
      console.error('Error testing default reminder:', error);
    } finally {
      setIsTestingDefaultReminder(false);
    }
  };

  const handleTestSmartCalculation = async () => {
    try {
      const result = await post("/notifications/test/smart-reminder", {});
      console.log('Smart reminder calculation:', result);
      setSmartReminderResult(result);
    } catch (error) {
      console.error('Error testing smart calculation:', error);
      setSmartReminderResult({ success: false, error: "Failed to calculate" });
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
                        <Text style={styles.timeButtonText}>−</Text>
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
                        <Text style={styles.timeButtonText}>+</Text>
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
                        <Text style={styles.timeButtonText}>−</Text>
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
                        <Text style={styles.timeButtonText}>+</Text>
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

              {/* Ojo Notifications */}
              {preferences?.taskReminders?.enabled && (
                <View style={[styles.settingRow, styles.nestedSetting]}>
                  <View style={styles.settingInfo}>
                    <AppText variant="boldText" style={styles.settingLabel}>🤖 Ojo Personality</AppText>
                    <AppText variant="notes" style={styles.settingDescription}>
                      AI-crafted notifications with personality
                    </AppText>
                  </View>
                  <Switch
                    value={preferences?.ojoNotifications?.enabled ?? false}
                    onValueChange={handleToggleOjoNotifications}
                    disabled={isSaving}
                    trackColor={{ false: COLORS.white2, true: COLORS.primary3 }}
                    thumbColor={preferences?.ojoNotifications?.enabled ? COLORS.colorWhite : COLORS.lightGray}
                  />
                </View>
              )}

              {/* Ojo Type Selector - only show when Ojo is enabled and Smart Reminders are OFF */}
              {preferences?.taskReminders?.enabled && 
               preferences?.ojoNotifications?.enabled && 
               !preferences?.taskReminders?.useSmartReminders && 
               availableOjoTypes.length > 0 && (
                <View style={styles.ojoTypeContainer}>
                  <AppText variant="boldText" style={styles.ojoTypeTitle}>Choose Your Ojo</AppText>
                  <AppText variant="notes" style={styles.ojoTypeDescription}>
                    Select the personality for your reminders
                  </AppText>
                  <View style={styles.ojoTypeGrid}>
                    {availableOjoTypes.map((ojo) => (
                      <TouchableOpacity
                        key={ojo.name}
                        style={[
                          styles.ojoTypeCard,
                          preferences?.ojoNotifications?.selectedOjoType === ojo.name && styles.ojoTypeCardSelected,
                        ]}
                        onPress={() => handleSelectOjoType(ojo.name)}
                        disabled={isSaving}
                      >
                        <AppText 
                          variant="boldText" 
                          style={[
                            styles.ojoTypeName,
                            preferences?.ojoNotifications?.selectedOjoType === ojo.name && styles.ojoTypeNameSelected,
                          ]}
                        >
                          {ojo.name === 'mentorjo' && '🧙 '}
                          {ojo.name === 'brojo' && '💪 '}
                          {ojo.name === 'bestojo' && '💖 '}
                          {ojo.name === 'strictojo' && '⚡ '}
                          {ojo.displayName}
                        </AppText>
                        <AppText 
                          variant="notes" 
                          style={[
                            styles.ojoTypePersona,
                            preferences?.ojoNotifications?.selectedOjoType === ojo.name && styles.ojoTypePersonaSelected,
                          ]}
                          numberOfLines={2}
                        >
                          {ojo.persona}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Info about auto-selection when Smart Reminders are ON */}
              {preferences?.taskReminders?.enabled && 
               preferences?.ojoNotifications?.enabled && 
               preferences?.taskReminders?.useSmartReminders && (
                <View style={styles.ojoInfoBox}>
                  <AppText variant="notes" style={styles.ojoInfoText}>
                    ℹ️ With Smart Reminders on, Ojo type is automatically selected based on task difficulty prediction.
                  </AppText>
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

            {/* Task Reminder Tests */}
            {preferences?.taskReminders?.enabled && (
              <View style={styles.testModeSection}>
                <AppText variant="boldText" style={styles.testModeTitle}>⏰ Task Reminder Tests</AppText>
                <AppText variant="notes" style={styles.testModeDescription}>
                  Test task reminders using your current tasks.
                </AppText>
                <View style={styles.buttonRow}>
                  <AppButton
                    title={isTestingSmartReminder ? "..." : "🧠 Smart"}
                    onPress={handleTestSmartReminder}
                    mode="filled"
                    color="primary3"
                    disabled={isTestingSmartReminder}
                    style={styles.testBtn}
                  />
                  <AppButton
                    title={isTestingDefaultReminder ? "..." : "📋 Default"}
                    onPress={handleTestDefaultReminder}
                    mode="light"
                    color="primary3"
                    disabled={isTestingDefaultReminder}
                    style={styles.testBtn}
                  />
                </View>

                {/* Ojo Test - only show when Ojo is enabled */}
                {preferences?.ojoNotifications?.enabled && (
                  <AppButton
                    title={isTestingOjo ? "Sending..." : "🤖 Test Ojo Notification"}
                    onPress={() => handleTestOjoNotification()}
                    mode="filled"
                    color="primary1"
                    disabled={isTestingOjo}
                    style={styles.testModeBtn}
                  />
                )}

                <AppButton
                  title="📊 View Smart Calculation"
                  onPress={handleTestSmartCalculation}
                  mode="light"
                  color="primary4"
                  style={styles.testModeBtn}
                />
                {smartReminderResult && (
                  <View style={styles.calculationResult}>
                    {smartReminderResult.success ? (
                      <>
                        <AppText variant="boldText" style={styles.calculationTitle}>
                          Task: {smartReminderResult.task?.name}
                        </AppText>
                        {smartReminderResult.mlPrediction && (
                          <AppText variant="notes" style={styles.calculationText}>
                            ML Category: {smartReminderResult.mlPrediction.category}/5 - {smartReminderResult.mlPrediction.interpretation}
                          </AppText>
                        )}
                        <AppText variant="notes" style={styles.calculationText}>
                          Smart: {smartReminderResult.comparison?.smart?.timing?.minutesBefore}min before, {smartReminderResult.comparison?.smart?.timing?.remindCount}x reminders ({smartReminderResult.comparison?.smart?.timing?.urgency})
                        </AppText>
                        <AppText variant="notes" style={styles.calculationText}>
                          Default: {smartReminderResult.comparison?.default?.timing?.minutesBefore}min before
                        </AppText>
                      </>
                    ) : (
                      <AppText variant="notes" style={styles.calculationText}>
                        {smartReminderResult.error || "No tasks available for calculation"}
                      </AppText>
                    )}
                  </View>
                )}
              </View>
            )}

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
    marginBottom: SPACING.sm,
    marginVertical: SPACING.md,
    width: "100%",
    direction: "ltr",
  },
  timeInputContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    flexDirection: "column",
  },
  timeButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
  },
  timeButtonText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.colorWhite,
    textAlign: "center",
    lineHeight: FONT_SIZES.lg,
    includeFontPadding: false,
    textAlignVertical: "center",
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
    marginBottom: SPACING.sm,
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
    marginTop: SPACING.sm,
  },
  // Calculation Result
  calculationResult: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.white2,
    borderRadius: moderateScale(8),
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary4,
  },
  calculationTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: SPACING.sm,
  },
  calculationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginBottom: 2,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
  // Debug
  debugText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginBottom: 2,
    fontFamily: "monospace",
  },
  // Ojo Type Selector
  ojoTypeContainer: {
    marginTop: SPACING.md,
    marginLeft: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white3,
    borderRadius: moderateScale(12),
  },
  ojoTypeTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  ojoTypeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginBottom: SPACING.md,
  },
  ojoTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  ojoTypeCard: {
    width: "47%",
    padding: SPACING.sm,
    backgroundColor: COLORS.white2,
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: "transparent",
  },
  ojoTypeCardSelected: {
    borderColor: COLORS.primary3,
    backgroundColor: COLORS.primary3 + "15",
  },
  ojoTypeName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  ojoTypeNameSelected: {
    color: COLORS.primary3,
  },
  ojoTypePersona: {
    fontSize: FONT_SIZES.sm - 1,
    color: COLORS.lightGray,
    lineHeight: (FONT_SIZES.sm - 1) * 1.3,
  },
  ojoTypePersonaSelected: {
    color: COLORS.primary3,
  },
  ojoInfoBox: {
    marginTop: SPACING.sm,
    marginLeft: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: COLORS.primary3 + "15",
    borderRadius: moderateScale(8),
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary3,
  },
  ojoInfoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary3,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
});
