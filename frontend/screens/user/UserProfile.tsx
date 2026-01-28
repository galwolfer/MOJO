import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import Box from "../../components/layout/Box";
import { StatBadge, ProgressGraph } from "./components";
import FriendsList from "./components/FriendsList";
import { moderateScale } from "react-native-size-matters";
import { getUserStats } from "../../services/userService";
import { getUserPreferences } from "../../services/apiClient";
import { getTasks, calculateTaskProgress, type Task, type TaskProgress } from "../../services/taskService";
import { getOjoType } from "../../config/ojoTypeConfig";
import { SettingsScreen, EditPreferencesScreen, ChatSettingsScreen } from "../settings";

/**
 * UserProfileScreen
 *
 * Displays the user's profile with:
 * - Profile photo with gradient ring
 * - Username display
 * - Stats row (tasks, points, streak)
 * - Progress graph
 * - Goals section
 * - Friends list
 */

const DEFAULT_PROGRESS = new Array(14).fill(0);

const MOCK_FRIENDS = [
  {
    id: "1",
    name: "Linus tech",
    avatar: null,
    isOnline: true,
    stats: { tasks: 34, streak: 1717, points: 289 },
  },
  {
    id: "2",
    name: "Ofek Avan Danan",
    avatar: null,
    isOnline: false,
    stats: { tasks: 12, streak: 1717, points: 234 },
  },
  {
    id: "3",
    name: "Shahar",
    avatar: null,
    isOnline: false,
    stats: { tasks: 45, streak: 890, points: 567 },
  },
  {
    id: "4",
    name: "Gal Wolter",
    avatar: null,
    isOnline: true,
    stats: { tasks: 28, streak: 456, points: 321 },
  },
];

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();
  const { setHeaderConfig } = useNavigation();
  const { width } = useWindowDimensions();
  const { subscribeToTaskUpdates } = useTaskContext();

  // Screen navigation state
  const [currentScreen, setCurrentScreen] = useState<"profile" | "settings" | "edit-preferences" | "chat-settings">(
    "profile",
  );

  const [stats, setStats] = useState({ tasks: 0, points: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<number[]>(DEFAULT_PROGRESS);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [tasks, setTasksState] = useState<Task[]>([]);
  const mountedRef = useRef(true);

  const SettingsIcon = ICONS.settings;
  const UserIcon = ICONS.user;
  const CheckIcon = ICONS.list;
  const FlameIcon = ICONS.flame;
  const TrophyIcon = ICONS.trophy;
  const [ojoGradient, setOjoGradient] = useState<string[] | null>(null);

  const headerElement = useMemo(
    () => (
      <View style={styles.headerProfileSection} pointerEvents="box-none">
        {/* Avatar */}
        <View style={styles.headerAvatarWrapper}>
          <LinearGradient
            colors={(ojoGradient ?? [COLORS.primary1, COLORS.primary2]) as [string, string, ...string[]]}
            end={{ x: 1, y: 1 }}
            style={styles.headerAvatarGradient}
          >
            <View style={styles.headerAvatarInner}>
              {user?.profileImage ? (
                <Image
                  source={{
                    uri: user.profileImage,
                  }}
                  style={styles.headerAvatarImage}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <UserIcon size={moderateScale(35)} color={COLORS.lightGray} />
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Display Name */}
        <AppText variant="title2" style={styles.headerUsername}>
          {user?.displayName || user?.username || "User"}
        </AppText>
        {user?.username && (
          <AppText variant="notes" style={styles.headerDisplayName}>
            @{user.username}
          </AppText>
        )}

        {/* Stats Row */}
        <View style={{ width: "100%" }}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary1} />
          ) : (
            <View style={styles.headerStatsRow}>
              <StatBadge
                icon={<CheckIcon size={ICON_SIZES.md} color={COLORS.colorWhite} />}
                value={stats.tasks}
                label="Tasks"
                color={COLORS.primary6}
              />
              <StatBadge
                icon={<TrophyIcon size={ICON_SIZES.md} color={COLORS.colorWhite} />}
                value={stats.points}
                label="Points"
                color={COLORS.primary5}
              />
              <StatBadge
                icon={<FlameIcon size={ICON_SIZES.md} color={COLORS.colorWhite} />}
                value={stats.streak}
                label="Days Streak"
                color={COLORS.primary4}
              />
            </View>
          )}
        </View>
      </View>
    ),
    [user?.profileImage, user?.displayName, user?.username, loading, stats, ojoGradient],
  );

  const headerRight = useMemo(
    () => (
      <TouchableOpacity onPress={() => setCurrentScreen("settings")} style={styles.headerRightTouchable}>
        <SettingsIcon size={ICON_SIZES.md} color={COLORS.primary1} />
      </TouchableOpacity>
    ),
    [setCurrentScreen],
  );

  useEffect(() => {
    if (currentScreen !== "profile") return;
    setHeaderConfig({ show: true, element: headerElement, rightElement: headerRight });
  }, [currentScreen, headerElement, headerRight, setHeaderConfig]);

  // Load user's OjoType gradient for avatar outline (matches ProfileSettings)
  // Re-run whenever the profile view becomes active so changes from Settings appear immediately.
  useEffect(() => {
    let mounted = true;
    if (currentScreen !== "profile") return () => {
      mounted = false;
    };

    (async () => {
      try {
        const prefs = await getUserPreferences();
        const ojoName = prefs?.ojoType?.name as any;
        const cfg = ojoName ? getOjoType(ojoName) : getOjoType("mentorjo");
        if (mounted) setOjoGradient(cfg.gradient2 ?? cfg.gradient ?? [cfg.color, cfg.color]);
      } catch (e) {
        // ignore and keep default colors
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentScreen]);

  const fetchAllData = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [statsData, taskList] = await Promise.all([getUserStats(), getTasks()]);
      if (!mountedRef.current) return;
      setStats(statsData);
      setTasksState(taskList);
      const progress = calculateTaskProgress(taskList, 14);
      setTaskProgress(progress);
      setProgressData(progress.dailyProgress);
    } catch (err) {
      console.warn("UserProfile fetch failed", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAllData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchAllData]);

  useEffect(() => {
    const onState = (state: AppStateStatus) => {
      if (state === "active") {
        fetchAllData();
      }
    };
    const sub = AppState.addEventListener("change", onState);
    return () => sub.remove();
  }, [fetchAllData]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(() => fetchAllData());
    return unsubscribe;
  }, [subscribeToTaskUpdates, fetchAllData]);

  const graphWidth = Math.min(width - SPACING.xlg * 2 - SPACING.md * 2, 500);

  // If on Settings screen, render SettingsScreen
  if (currentScreen === "settings") {
    return (
      <SettingsScreen
        onBack={() => setCurrentScreen("profile")}
        onEditPreferences={() => setCurrentScreen("edit-preferences")}
        onChatSettings={() => setCurrentScreen("chat-settings")}
      />
    );
  }

  // If on Edit Preferences screen, render EditPreferencesScreen
  if (currentScreen === "edit-preferences") {
    return (
      <EditPreferencesScreen
        onBack={() => setCurrentScreen("settings")}
        onSave={() => {
          // Optionally refresh data after preferences are saved
          fetchAllData();
        }}
      />
    );
  }

  // If on Chat Settings screen, render ChatSettingsScreen
  if (currentScreen === "chat-settings") {
    return (
      <ChatSettingsScreen
        onBack={() => setCurrentScreen("settings")}
        onSave={() => {
          // Optionally refresh data after chat settings are saved
          fetchAllData();
        }}
      />
    );
  }

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="user-profile"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      {/* Progress Section */}
      <Box title="My Progress">
        <View style={styles.progressContent}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary3} style={{ marginVertical: SPACING.lg }} />
          ) : (
            <>
              {taskProgress && (
                <View style={styles.progressSummary}>
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.today.completed}/{taskProgress.today.total}
                    </AppText>
                    <AppText variant="notes" style={styles.progressSummaryLabel}>
                      Today
                    </AppText>
                  </View>
                  <View style={styles.progressSummaryDivider} />
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.today.percentage}%
                    </AppText>
                    <AppText variant="notes" style={styles.progressSummaryLabel}>
                      Completed
                    </AppText>
                  </View>
                  <View style={styles.progressSummaryDivider} />
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.week.completed}
                    </AppText>
                    <AppText variant="notes" style={styles.progressSummaryLabel}>
                      This Week
                    </AppText>
                  </View>
                </View>
              )}
              <ProgressGraph data={progressData} width={graphWidth} height={moderateScale(100)} />
            </>
          )}
          <AppText variant="notes" style={styles.progressNote}>
            {tasks.length > 0
              ? `Track your daily task completion over the last ${progressData.length} days`
              : "Complete tasks to see your progress here!"}
          </AppText>
        </View>
      </Box>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <AppText variant="boldText" style={styles.logoutText}>
          Logout
        </AppText>
      </TouchableOpacity>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.lg,
    paddingBottom: SPACING.xlg,
  },

  // Header Profile Styles
  headerProfileSection: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    width: "100%",
    marginTop: -SPACING.xlg - SPACING.md,
  },
  headerAvatarWrapper: {
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: moderateScale(55),
    overflow: "hidden",
    backgroundColor: COLORS.white2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarImage: {
    width: "100%",
    height: "100%",
  },
  headerAvatarGradient: {
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: moderateScale(55),
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(2),
  },
  headerAvatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(53),
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.white2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerUsername: {
    color: COLORS.primary1,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  headerDisplayName: {
    color: COLORS.lightGray,
    textAlign: "center",
  },
  headerStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  headerRight: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightTouchable: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
    zIndex: 9999,
  },

  // Profile Section
  profileSection: {
    alignItems: "center",
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarGradient: {
    width: moderateScale(130),
    height: moderateScale(130),
    borderRadius: moderateScale(65),
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(63),
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(63),
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(63),
    backgroundColor: COLORS.white2,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsOverlay: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.card,
  },
  username: {
    color: COLORS.primary1,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  displayName: {
    color: COLORS.lightGray,
    textAlign: "center",
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  // Progress Section
  progressContent: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  progressSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white2,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  progressSummaryItem: {
    alignItems: "center",
    paddingHorizontal: SPACING.md,
  },
  progressSummaryValue: {
    color: COLORS.primary1,
    fontSize: moderateScale(18),
  },
  progressSummaryLabel: {
    color: COLORS.lightGray,
    fontSize: moderateScale(10),
    marginTop: 2,
  },
  progressSummaryDivider: {
    width: 1,
    height: moderateScale(30),
    backgroundColor: COLORS.lightGray,
    opacity: 0.3,
  },
  progressNote: {
    color: COLORS.lightGray,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
  },

  // Friends Section
  friendsSection: {
    width: "100%",
    borderRadius: SPACING.lg,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  friendsGradient: {
    width: "100%",
    paddingBottom: SPACING.md,
  },
  friendsHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
  },
  friendsTitle: {
    color: COLORS.colorWhite,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  friendsList: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: SPACING.sm,
    borderRadius: SPACING.md,
  },

  // Logout
  logoutButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xlg,
    backgroundColor: COLORS.white,
    borderRadius: SPACING.lg,
    ...SHADOWS.card,
    marginTop: SPACING.md,
    marginBottom: SPACING.xlg * 2,
  },
  logoutText: {
    color: COLORS.primary7,
  },
});
