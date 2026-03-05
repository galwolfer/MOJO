/**
 * NotificationSettingsScreen
 *
 * Unified settings screen for push notification preferences.
 * Handles the full lifecycle: not-initialized → setup, permission denied, and main config.
 * Uses SettingsSubScreen for consistent header/scroll layout across all settings screens.
 */
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { useNotifications } from "../../../context/NotificationContext";
import { useColors } from "../../../context/ThemeContext";
import { COLORS, SPACING, FONT_SIZES, ICON_SIZES } from "../../../theme";
import { post, get } from "../../../services/httpClient";
import { OjoType, OjoTypeOption } from "../../../services/notificationService";
import { getOjoType, OjoTypeName } from "../../../config/ojoTypeConfig";
import { ICONS } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/icons/Checkbox";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import ErrorText from "../../../components/common/ErrorText";
import List, { type ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import SettingsSubScreen from "./components/SettingsSubScreen";

type Props = { onBack: () => void };

// ── Reusable switch row ──────────────────────────────────────────────────────

type SettingRowProps = {
  label: string;
  description?: string;
  Icon?: React.FC<{ size?: number; color?: string }>;
  iconColor?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  nested?: boolean;
  divider?: boolean;
};

function SettingRow({
  label,
  description,
  Icon,
  iconColor = COLORS.primary1,
  value,
  onChange,
  disabled,
  nested,
  divider = true,
}: SettingRowProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.settingRow,
        { borderBottomColor: colors.bg3 },
        nested && styles.nestedSetting,
        !divider && { borderBottomWidth: 0 },
      ]}
    >
      {Icon && <Icon size={ICON_SIZES.sm} color={iconColor} />}
      <View style={styles.settingInfo}>
        <AppText variant="boldText" style={{ color: colors.text1 }}>
          {label}
        </AppText>
        {description && (
          <AppText variant="notes" style={{ color: colors.gray1 }}>
            {description}
          </AppText>
        )}
      </View>
      <View style={disabled ? { opacity: 0.4 } : undefined}>
        <Checkbox checked={value} onChange={disabled ? undefined : onChange} size={ICON_SIZES.sm} />
      </View>
    </View>
  );
}

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

  useEffect(() => {
    if (!isInitialized) return;
    get<{ success: boolean; availableOjoTypes?: OjoTypeOption[] }>("/notifications/preferences")
      .then((r) => {
        if (r.success && r.availableOjoTypes) setAvailableOjoTypes(r.availableOjoTypes);
      })
      .catch(() => {});
  }, [isInitialized]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const save = async (fn: () => Promise<unknown>) => {
    setIsSaving(true);
    try {
      await fn();
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = (enabled: boolean) => save(() => updatePreferences({ enabled }));

  const digestHour = preferences?.morningDigest?.hour ?? 8;
  const digestMinute = preferences?.morningDigest?.minute ?? 0;

  const handleToggleMorningDigest = (enabled: boolean) =>
    save(() => updatePreferences({ morningDigest: { enabled, hour: digestHour, minute: digestMinute } }));

  const changeDigestTime = (hour: number, minute: number) =>
    save(() =>
      updatePreferences({ morningDigest: { enabled: preferences?.morningDigest?.enabled ?? true, hour, minute } }),
    );

  const handleToggleTaskReminders = (enabled: boolean) =>
    save(() =>
      updatePreferences({
        taskReminders: {
          enabled,
          defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
          useSmartReminders: preferences?.taskReminders?.useSmartReminders ?? true,
        },
      }),
    );

  const handleToggleSmartReminders = (useSmartReminders: boolean) =>
    save(() =>
      updatePreferences({
        taskReminders: {
          enabled: preferences?.taskReminders?.enabled ?? true,
          defaultReminderMinutes: preferences?.taskReminders?.defaultReminderMinutes ?? 60,
          useSmartReminders,
        },
      }),
    );

  const handleToggleOjoNotifications = (enabled: boolean) =>
    save(() =>
      updatePreferences({
        ojoNotifications: { enabled, selectedOjoType: preferences?.ojoNotifications?.selectedOjoType ?? null },
      }),
    );

  const handleSelectOjoType = (ojoType: OjoType) =>
    save(() =>
      updatePreferences({
        ojoNotifications: { enabled: preferences?.ojoNotifications?.enabled ?? true, selectedOjoType: ojoType },
      }),
    );

  const handleTestNotification = async () => {
    setIsTesting(true);
    await testNotification();
    setIsTesting(false);
  };

  const handleTestMorningDigest = async () => {
    setIsTestingMorningDigest(true);
    try {
      await post("/notifications/test/morning-digest", {});
    } catch {
    } finally {
      setIsTestingMorningDigest(false);
    }
  };

  const handleTestSmartReminder = async () => {
    setIsTestingSmartReminder(true);
    try {
      await post("/notifications/test/task-reminder", { useSmartReminders: true, useOjo: false });
    } catch {
    } finally {
      setIsTestingSmartReminder(false);
    }
  };

  const handleTestDefaultReminder = async () => {
    setIsTestingDefaultReminder(true);
    try {
      await post("/notifications/test/task-reminder", { useSmartReminders: false, useOjo: false });
    } catch {
    } finally {
      setIsTestingDefaultReminder(false);
    }
  };

  const handleTestSmartCalculation = async () => {
    try {
      const result = await post("/notifications/test/smart-reminder", {});
      setSmartReminderResult(result);
    } catch {
      setSmartReminderResult({ success: false, error: "Failed to calculate" });
    }
  };

  const handleTestOjoNotification = async (ojoType?: OjoType) => {
    setIsTestingOjo(true);
    try {
      await post("/notifications/test/ojo-reminder", { ojoType });
    } catch {
    } finally {
      setIsTestingOjo(false);
    }
  };

  const handleToggleTestMode = async () => {
    setIsTogglingTestMode(true);
    if (testModeActive) await stopPeriodicTest();
    else await startPeriodicTest();
    setIsTogglingTestMode(false);
  };

  // ── Icons ─────────────────────────────────────────────────────────────────

  const UpIcon = ICONS.up;
  const DownIcon = ICONS.down;
  const DayIcon = ICONS.day;
  const ClockIcon = ICONS.clock;
  const MindfulnessIcon = ICONS.mindfulness;
  const OjoIcon = ICONS.ojo;
  const RepeatIcon = ICONS.repeat;
  const NotificationIcon = ICONS.notifications;

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
              color="primary1"
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

  // ── Derived preferences ───────────────────────────────────────────────────

  const allEnabled = preferences?.enabled ?? false;
  const digestEnabled = preferences?.morningDigest?.enabled ?? true;
  const taskRemindersEnabled = preferences?.taskReminders?.enabled ?? true;
  const smartRemindersEnabled = preferences?.taskReminders?.useSmartReminders ?? true;
  const ojoEnabled = preferences?.ojoNotifications?.enabled ?? false;

  // ── Main render ───────────────────────────────────────────────────────────

  const settingItems: ListCellProps[] = [
    makeListCell("all-notifications", {
      title: "All Notifications",
      subtitle: "Enable or disable all push notifications",
      logo: <NotificationIcon size={ICON_SIZES.sm} color={COLORS.primary1} />,
      disabled: isSaving,
      rightElement: (
        <View style={isSaving ? { opacity: 0.4 } : undefined}>
          <Checkbox checked={allEnabled} onChange={handleToggleNotifications} size={ICON_SIZES.sm} />
        </View>
      ),
      divider: allEnabled,
    }),
  ];

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

            {allEnabled && (
              <>
                {/* Morning Digest */}
                <SettingRow
                  label="Morning Digest"
                  description={`Daily summary at ${String(digestHour).padStart(2, "0")}:${String(digestMinute).padStart(2, "0")}`}
                  Icon={DayIcon}
                  value={digestEnabled}
                  onChange={handleToggleMorningDigest}
                  disabled={isSaving}
                />

                {digestEnabled && (
                  <View style={styles.timePicker}>
                    <AppText variant="boldText" style={{ color: colors.text1, marginBottom: SPACING.xs }}>
                      Set Digest Time
                    </AppText>
                    <View style={styles.timeInputGroup}>
                      {/* Hour stepper */}
                      <View style={styles.timeInputContainer}>
                        <TouchableOpacity
                          onPress={() => changeDigestTime(digestHour < 23 ? digestHour + 1 : 0, digestMinute)}
                          disabled={isSaving}
                          style={styles.timeBtn}
                        >
                          <UpIcon size={ICON_SIZES.xs} color={COLORS.colorWhite} />
                        </TouchableOpacity>
                        <AppText variant="title2" style={styles.timeDigit}>
                          {String(digestHour).padStart(2, "0")}
                        </AppText>
                        <TouchableOpacity
                          onPress={() => changeDigestTime(digestHour > 0 ? digestHour - 1 : 23, digestMinute)}
                          disabled={isSaving}
                          style={styles.timeBtn}
                        >
                          <DownIcon size={ICON_SIZES.xs} color={COLORS.colorWhite} />
                        </TouchableOpacity>
                      </View>

                      <AppText variant="title2" style={[styles.timeSep, { color: colors.text1 }]}>
                        :
                      </AppText>

                      {/* Minute stepper */}
                      <View style={styles.timeInputContainer}>
                        <TouchableOpacity
                          onPress={() => changeDigestTime(digestHour, digestMinute < 59 ? digestMinute + 1 : 0)}
                          disabled={isSaving}
                          style={styles.timeBtn}
                        >
                          <UpIcon size={ICON_SIZES.xs} color={COLORS.colorWhite} />
                        </TouchableOpacity>
                        <AppText variant="title2" style={styles.timeDigit}>
                          {String(digestMinute).padStart(2, "0")}
                        </AppText>
                        <TouchableOpacity
                          onPress={() => changeDigestTime(digestHour, digestMinute > 0 ? digestMinute - 1 : 59)}
                          disabled={isSaving}
                          style={styles.timeBtn}
                        >
                          <DownIcon size={ICON_SIZES.xs} color={COLORS.colorWhite} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <AppText variant="notes" style={{ color: colors.gray1, textAlign: "center" }}>
                      Tap arrows to adjust the time
                    </AppText>
                  </View>
                )}

                {/* Task Reminders */}
                <SettingRow
                  label="Task Reminders"
                  description="Get reminded before task deadlines"
                  Icon={ClockIcon}
                  value={taskRemindersEnabled}
                  onChange={handleToggleTaskReminders}
                  disabled={isSaving}
                />

                {taskRemindersEnabled && (
                  <>
                    {/* Smart Reminders */}
                    <SettingRow
                      label="Smart Reminders"
                      description="Use AI to optimize reminder timing"
                      Icon={MindfulnessIcon}
                      iconColor={COLORS.primary3}
                      value={smartRemindersEnabled}
                      onChange={handleToggleSmartReminders}
                      disabled={isSaving}
                      nested
                    />

                    {/* Ojo Personality */}
                    <SettingRow
                      label="Ojo Personality"
                      description="AI-crafted notifications with personality"
                      Icon={OjoIcon}
                      iconColor={COLORS.primary3}
                      value={ojoEnabled}
                      onChange={handleToggleOjoNotifications}
                      disabled={isSaving}
                      nested
                      divider={false}
                    />

                    {/* Ojo type picker — shown when Ojo is enabled and Smart Reminders are OFF */}
                    {ojoEnabled && !smartRemindersEnabled && availableOjoTypes.length > 0 && (
                      <View style={[styles.ojoContainer, { backgroundColor: colors.bg3 }]}>
                        <AppText variant="boldText" style={{ color: colors.text1 }}>
                          Choose Your Ojo
                        </AppText>
                        <AppText variant="notes" style={{ color: colors.gray1 }}>
                          Select the personality for your reminders
                        </AppText>
                        <View style={styles.ojoGrid}>
                          {availableOjoTypes.map((ojo) => {
                            const ojoConfig = getOjoType(ojo.name as OjoTypeName);
                            const OjoTypeIcon = ICONS[ojoConfig.icon as keyof typeof ICONS];
                            const isSelected = preferences?.ojoNotifications?.selectedOjoType === ojo.name;
                            const iconSize = moderateScale(40);
                            return (
                              <TouchableOpacity
                                key={ojo.name}
                                style={[
                                  styles.ojoCard,
                                  { backgroundColor: colors.bg2, borderColor: "transparent" },
                                  isSelected && {
                                    borderColor: ojoConfig.color,
                                    backgroundColor: ojoConfig.color + "15",
                                  },
                                ]}
                                onPress={() => handleSelectOjoType(ojo.name)}
                                disabled={isSaving}
                              >
                                <View
                                  style={[
                                    styles.ojoIconCircle,
                                    {
                                      backgroundColor: ojoConfig.color,
                                      width: iconSize,
                                      height: iconSize,
                                      borderRadius: iconSize / 2,
                                    },
                                  ]}
                                >
                                  {typeof OjoTypeIcon === "function" && (
                                    <OjoTypeIcon size={iconSize * 0.55} color={COLORS.colorWhite} />
                                  )}
                                </View>
                                <AppText
                                  variant="boldText"
                                  style={{ color: isSelected ? ojoConfig.color : colors.text1, textAlign: "center" }}
                                >
                                  {ojo.displayName}
                                </AppText>
                                <AppText
                                  variant="notes"
                                  style={{ color: isSelected ? ojoConfig.color : colors.gray1, textAlign: "center" }}
                                  numberOfLines={2}
                                >
                                  {ojo.persona}
                                </AppText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Info: when Smart Reminders + Ojo both on, type is auto-selected */}
                    {ojoEnabled && smartRemindersEnabled && (
                      <View style={[styles.infoBox, { backgroundColor: COLORS.primary3 + "15" }]}>
                        <AppText variant="notes" style={{ color: COLORS.primary3, flex: 1 }}>
                          With Smart Reminders on, Ojo type is automatically selected based on task difficulty
                          prediction.
                        </AppText>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
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
    gap: SPACING.md,
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
    alignItems: "center",
    gap: SPACING.sm,
  },
  timeInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  timeInputContainer: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  timeBtn: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
  },
  timeDigit: {
    minWidth: FONT_SIZES.lg * 1.5,
    textAlign: "center",
  },
  timeSep: {
    marginHorizontal: SPACING.xs,
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
