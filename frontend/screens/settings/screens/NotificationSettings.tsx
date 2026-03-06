/**
 * NotificationSettingsScreen
 *
 * Unified settings screen for push notification preferences.
 * Handles the full lifecycle: not-initialized → setup, permission denied, and main config.
 * Uses SettingsSubScreen for consistent header/scroll layout across all settings screens.
 * Business logic delegated to NotificationSettingsContext.
 */
import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { TimePicker } from "../../../components/inputs/TimePicker";
import { useNotificationSettings } from "../../../context/NotificationSettingsContext";
import { useColors } from "../../../context/ThemeContext";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { OjoType } from "../../../services/notificationService";
import { getOjoType, OjoTypeName } from "../../../config/ojoTypeConfig";
import { ICONS } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/icons/Checkbox";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import ErrorText from "../../../components/common/ErrorText";
import List, { type ListCellProps } from "../../../components/layout/List";
import ListItem, { makeListCell } from "../../../components/layout/ListItem";
import SettingsSubScreen from "./components/SettingsSubScreen";

type Props = { onBack: () => void };

// ── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen({ onBack }: Props) {
  const colors = useColors();
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
  } = useNotificationSettings();

  // ── Icons ─────────────────────────────────────────────────────────────────

  const DayIcon = ICONS.day;
  const ClockIcon = ICONS.clock;
  const PuzzleIcon = ICONS.puzzle;
  const OjoIcon = ICONS.ojo;
  const RepeatIcon = ICONS.repeat;
  const NotificationIcon = ICONS.notifications;

  // Digest time handler for TimePicker (converts "HH:MM" → changeDigestTime)
  const handleDigestTimeChange = useCallback(
    (value: string) => {
      const [h, m] = value.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) changeDigestTime(h, m);
    },
    [changeDigestTime],
  );

  // ── Not initialized ───────────────────────────────────────────────────────

  if (!isInitialized) {
    return (
      <SettingsSubScreen
        title="Notifications"
        iconName="notifications"
        scrollKey="notification-settings"
        onBack={onBack}
      >
        <Box title="Push Notifications" titleColor={COLORS.primary1}>
          <View style={styles.boxContent}>
            {!isPhysicalDevice && (
              <View style={[styles.infoBox, { backgroundColor: COLORS.primary5 + "25" }]}>
                <NotificationIcon size={ICON_SIZES.sm} color={COLORS.darkP5} />
                <AppText variant="notes" style={{ color: COLORS.darkP5, flex: 1 }}>
                  Push notifications only work on physical devices, not simulators.
                </AppText>
              </View>
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <AppText variant="bodyText" style={{ color: colors.gray2 }}>
              Enable push notifications to receive morning task digests and smart reminders.
            </AppText>
            <AppButton
              title={isLoading ? "Enabling..." : "Enable Notifications"}
              onPress={initialize}
              mode="filled"
              color="primary3"
              disabled={isLoading}
            />
          </View>
        </Box>
      </SettingsSubScreen>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────

  if (permissionStatus !== "granted") {
    return (
      <SettingsSubScreen
        title="Notifications"
        iconName="notifications"
        scrollKey="notification-settings"
        onBack={onBack}
      >
        <Box title="Push Notifications" titleColor={COLORS.primary1}>
          <View style={styles.boxContent}>
            <View style={[styles.infoBox, { backgroundColor: COLORS.primary5 + "25" }]}>
              <AppText variant="notes" style={{ color: COLORS.darkP5 }}>
                Notifications are disabled. Please enable them in your device settings.
              </AppText>
            </View>
          </View>
        </Box>
      </SettingsSubScreen>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  // Child disabled states — each level gates on its parent being active
  const childDisabled = !allEnabled || isSaving;
  const digestTimeDisabled = !allEnabled || !digestEnabled || isSaving;
  const taskChildDisabled = !allEnabled || !taskRemindersEnabled || isSaving;

  const settingItems: ListCellProps[] = useMemo(
    () => [
      // ── All Notifications ──────────────────────────────────────────────────
      makeListCell("all-notifications", {
        title: "All Notifications",
        subtitle: "Enable or disable all push notifications",
        logo: <NotificationIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
        disabled: isSaving,
        onPress: isSaving ? undefined : () => handleToggleNotifications(!allEnabled),
        rightElement: (
          <Checkbox
            checked={allEnabled}
            onChange={isSaving ? undefined : handleToggleNotifications}
            size={ICON_SIZES.sm}
          />
        ),
      }),

      // ── Morning Digest + Time Picker ─────────────────────────────────────
      {
        id: "morning-digest",
        disabled: childDisabled,
        content: (
          <View>
            <ListItem
              title="Morning Digest"
              subtitle={`Daily summary at ${String(digestHour).padStart(2, "0")}:${String(digestMinute).padStart(2, "0")}`}
              logo={<DayIcon size={ICON_SIZES.sm} color={COLORS.primary5} />}
              rightElement={
                <Checkbox
                  checked={digestEnabled}
                  onChange={childDisabled ? undefined : handleToggleMorningDigest}
                  size={ICON_SIZES.sm}
                />
              }
            />
            <View style={[styles.timePicker, !digestEnabled && { opacity: 0.5 }]}>
              <TimePicker
                value={`${String(digestHour).padStart(2, "0")}:${String(digestMinute).padStart(2, "0")}`}
                onChange={handleDigestTimeChange}
                disabled={digestTimeDisabled}
              />
            </View>
          </View>
        ),
      } as ListCellProps,

      // ── Task Reminders ─────────────────────────────────────────────────────
      makeListCell("task-reminders", {
        title: "Task Reminders",
        subtitle: "Get reminded before task deadlines",
        logo: <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
        disabled: childDisabled,
        onPress: childDisabled ? undefined : () => handleToggleTaskReminders(!taskRemindersEnabled),
        rightElement: (
          <Checkbox
            checked={taskRemindersEnabled}
            onChange={childDisabled ? undefined : handleToggleTaskReminders}
            size={ICON_SIZES.sm}
          />
        ),
      }),

      // ── Smart Reminders ────────────────────────────────────────────────────
      makeListCell("smart-reminders", {
        title: "Smart Reminders",
        subtitle: "Use AI to optimize reminder timing",
        logo: <PuzzleIcon size={ICON_SIZES.sm} color={COLORS.primary4} />,
        disabled: taskChildDisabled,
        onPress: taskChildDisabled ? undefined : () => handleToggleSmartReminders(!smartRemindersEnabled),
        rightElement: (
          <Checkbox
            checked={smartRemindersEnabled}
            onChange={taskChildDisabled ? undefined : handleToggleSmartReminders}
            size={ICON_SIZES.sm}
          />
        ),
      }),

      // ── Ojo Personality ────────────────────────────────────────────────────
      makeListCell("ojo-personality", {
        title: "Ojo Personality",
        subtitle: "AI-crafted notifications with personality",
        logo: <OjoIcon size={ICON_SIZES.sm} color={COLORS.primary3} />,
        disabled: taskChildDisabled,
        onPress: taskChildDisabled ? undefined : () => handleToggleOjoNotifications(!ojoEnabled),
        rightElement: (
          <Checkbox
            checked={ojoEnabled}
            onChange={taskChildDisabled ? undefined : handleToggleOjoNotifications}
            size={ICON_SIZES.sm}
          />
        ),
      }),
    ],
    [
      allEnabled,
      isSaving,
      digestEnabled,
      digestHour,
      digestMinute,
      childDisabled,
      digestTimeDisabled,
      taskChildDisabled,
      taskRemindersEnabled,
      smartRemindersEnabled,
      ojoEnabled,
      handleToggleNotifications,
      handleToggleMorningDigest,
      handleDigestTimeChange,
      handleToggleTaskReminders,
      handleToggleSmartReminders,
      handleToggleOjoNotifications,
    ],
  );

  return (
    <SettingsSubScreen title="Notifications" iconName="notifications" scrollKey="notification-settings" onBack={onBack}>
      <View style={styles.boxesContainer}>
        {/* Notification Preferences */}
        <Box>
          <View style={styles.boxContent}>
            <AppText variant="bodyText" style={{ color: colors.gray2 }}>
              Customize how and when you receive notifications from Mojo.
            </AppText>

            <View style={styles.listContent}>
              <List data={settingItems} />
            </View>
          </View>
        </Box>

        {/* Test Notifications */}
        {allEnabled && (
          <Box title="Test Notifications" titleColor={COLORS.primary5}>
            <View style={styles.boxContent}>
              <AppText variant="bodyText" style={{ color: colors.gray2 }}>
                Send test notifications to verify your setup is working correctly.
              </AppText>

              <View style={styles.btnRow}>
                <AppButton
                  title={isTesting ? "Sending..." : "Test Push"}
                  onPress={handleTestNotification}
                  mode="light"
                  color="primary1"
                  disabled={isTesting}
                  style={styles.flex1}
                />
                <AppButton
                  title={isTestingMorningDigest ? "Sending..." : "Test Digest"}
                  onPress={handleTestMorningDigest}
                  mode="filled"
                  color="primary1"
                  disabled={isTestingMorningDigest}
                  style={styles.flex1}
                />
              </View>

              {taskRemindersEnabled && (
                <View style={[styles.subSection, { backgroundColor: colors.bg3 }]}>
                  <View style={styles.subSectionHeader}>
                    <ClockIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
                    <AppText variant="boldText" style={{ color: colors.text1 }}>
                      Task Reminder Tests
                    </AppText>
                  </View>
                  <AppText variant="notes" style={{ color: colors.gray1 }}>
                    Test task reminders using your current tasks.
                  </AppText>
                  <View style={styles.btnRow}>
                    <AppButton
                      title={isTestingSmartReminder ? "..." : "Smart Reminder"}
                      onPress={handleTestSmartReminder}
                      mode="filled"
                      color="primary3"
                      disabled={isTestingSmartReminder}
                      style={styles.flex1}
                    />
                    <AppButton
                      title={isTestingDefaultReminder ? "..." : "Default Reminder"}
                      onPress={handleTestDefaultReminder}
                      mode="light"
                      color="primary3"
                      disabled={isTestingDefaultReminder}
                      style={styles.flex1}
                    />
                  </View>

                  {ojoEnabled && (
                    <AppButton
                      title={isTestingOjo ? "Sending..." : "Test Ojo Notification"}
                      onPress={() => handleTestOjoNotification()}
                      mode="filled"
                      color="primary1"
                      style={{ marginTop: SPACING.sm }}
                    />
                  )}

                  <AppButton
                    title="View Smart Calculation"
                    onPress={handleTestSmartCalculation}
                    mode="light"
                    color="primary4"
                    style={{ marginTop: SPACING.sm }}
                  />

                  {smartReminderResult && (
                    <View style={[styles.calcResult, { backgroundColor: colors.bg2 }]}>
                      {smartReminderResult.success ? (
                        <>
                          <AppText variant="boldText" style={{ color: colors.text1 }}>
                            Task: {smartReminderResult.task?.name}
                          </AppText>
                          {smartReminderResult.mlPrediction && (
                            <AppText variant="notes" style={{ color: colors.gray1 }}>
                              ML Category: {smartReminderResult.mlPrediction.category}/5 —{" "}
                              {smartReminderResult.mlPrediction.interpretation}
                            </AppText>
                          )}
                          <AppText variant="notes" style={{ color: colors.gray1 }}>
                            Smart: {smartReminderResult.comparison?.smart?.timing?.minutesBefore}min before,{" "}
                            {smartReminderResult.comparison?.smart?.timing?.remindCount}x (
                            {smartReminderResult.comparison?.smart?.timing?.urgency})
                          </AppText>
                          <AppText variant="notes" style={{ color: colors.gray1 }}>
                            Default: {smartReminderResult.comparison?.default?.timing?.minutesBefore}min before
                          </AppText>
                        </>
                      ) : (
                        <AppText variant="notes" style={{ color: colors.gray1 }}>
                          {smartReminderResult.error || "No tasks available for calculation"}
                        </AppText>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Periodic Test Mode */}
              <View style={[styles.subSection, { backgroundColor: colors.bg3 }]}>
                <View style={styles.subSectionHeader}>
                  <RepeatIcon size={ICON_SIZES.sm} color={testModeActive ? COLORS.primary6 : COLORS.primary1} />
                  <AppText variant="boldText" style={{ color: colors.text1 }}>
                    Periodic Test Mode
                  </AppText>
                  {testModeActive && (
                    <View style={[styles.activeBadge, { backgroundColor: COLORS.primary6 }]}>
                      <AppText variant="notes" style={{ color: COLORS.colorWhite, fontWeight: "700" }}>
                        ACTIVE
                      </AppText>
                    </View>
                  )}
                </View>
                <AppText variant="notes" style={{ color: colors.gray1 }}>
                  {testModeActive
                    ? "Sending a test notification every minute. Tap to stop."
                    : "Start to receive a test notification every minute."}
                </AppText>
                <AppButton
                  title={isTogglingTestMode ? "..." : testModeActive ? "Stop Test Mode" : "Start Test Mode"}
                  onPress={handleToggleTestMode}
                  mode="filled"
                  color={testModeActive ? "primary5" : "primary4"}
                  disabled={isTogglingTestMode}
                  style={{ marginTop: SPACING.xs }}
                />
              </View>
            </View>
          </Box>
        )}

        {/* Debug Info (dev only) */}
        {__DEV__ && (
          <Box title="Debug Info" titleColor={COLORS.lightGray}>
            <View style={styles.boxContent}>
              <AppText variant="notes" style={{ color: colors.gray1, fontFamily: "monospace" }}>
                Token: {pushToken?.substring(0, 40)}...
              </AppText>
              <AppText variant="notes" style={{ color: colors.gray1, fontFamily: "monospace" }}>
                Status: {permissionStatus}
              </AppText>
              <AppText variant="notes" style={{ color: colors.gray1, fontFamily: "monospace" }}>
                Timezone: {preferences?.timezone}
              </AppText>
            </View>
          </Box>
        )}
      </View>
    </SettingsSubScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  boxesContainer: {
    gap: SPACING.lg,
  },
  boxContent: {
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  listContent: {
    width: "100%",
    paddingVertical: SPACING.sm,
  },

  // Setting row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  nestedSetting: {
    marginLeft: SPACING.md,
  },
  settingInfo: { flex: 1 },

  // Info / warning box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderRadius: moderateScale(8),
    padding: SPACING.md,
  },

  // Time picker
  timePicker: {
    marginLeft: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  // Ojo type selector
  ojoContainer: {
    borderRadius: moderateScale(12),
    padding: SPACING.md,
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  ojoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  ojoCard: {
    width: "47%",
    padding: SPACING.sm,
    borderRadius: moderateScale(10),
    borderWidth: 2,
    alignItems: "center",
    gap: SPACING.xs,
  },
  ojoIconCircle: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Test section
  btnRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  flex1: { flex: 1 },
  subSection: {
    borderRadius: moderateScale(10),
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  subSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  activeBadge: {
    borderRadius: moderateScale(10),
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginLeft: "auto",
  },
  calcResult: {
    padding: SPACING.sm,
    borderRadius: moderateScale(8),
    gap: SPACING.xs,
  },
});
