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

import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING, SHADOWS, ICON_SIZES, FONT_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
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
import {
  getTasks,
  getScheduledTasksByDay,
  calculateTaskProgress,
  type Task,
  type TaskProgress,
} from "../../services/taskService";
import UserAvatar from "../../components/common/UserAvatar";
import { SettingsScreen } from "../settings";
import { useBackHandler } from "../../hooks/useBackHandler";
import { useStatsContext } from "../../context/StatsContext";
import NotificationBell from "../../components/common/NotificationBell";

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
    name: "Gal Wolfer",
    avatar: null,
    isOnline: true,
    stats: { tasks: 28, streak: 456, points: 321 },
  },
];

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();

  const { setHeaderConfig, navigationParams, activeTab, clearNavigationParams } = useNavigation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { subscribeToTaskUpdates } = useTaskContext();
  const { stats, isLoading: statsLoading, refreshStats } = useStatsContext();

  // Screen navigation state
  const [currentScreen, setCurrentScreen] = useState<"profile" | "settings">("profile");
  // Desired sub-screen to open inside Settings (set when navigating via deep link)
  const pendingSettingsScreenRef = useRef<string | undefined>(undefined);

  // React to deep-link navigation params (e.g. from "Go to Busy Blocks" button)
  useEffect(() => {
    if (activeTab === "user" && navigationParams?.screen === "edit-preferences") {
      pendingSettingsScreenRef.current = "edit-preferences";
      (pendingSettingsScreenRef as any).subScreen = navigationParams?.subScreen;
      setCurrentScreen("settings");
      clearNavigationParams();
    }
  }, [navigationParams, activeTab, clearNavigationParams]);

  // When settings is open, back navigates to profile (sub-screens supersede this via their own handlers)
  useBackHandler(() => {
    setCurrentScreen("profile");
    return true;
  }, currentScreen === "settings");

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
  const headerElement = useMemo(
    () => (
      <View style={styles.headerProfileSection} pointerEvents="box-none">
        {/* Avatar */}
        <View style={[styles.headerAvatarWrapper, { backgroundColor: colors.bg2 }]}>
          <UserAvatar size={moderateScale(110)} imageUri={user?.profileImage ?? null} />
        </View>

        {/* Display Name */}
        <AppText variant="title2" style={styles.headerUsername}>
          {user?.displayName || user?.username || "User"}
        </AppText>
        {user?.username && (
          <AppText variant="notes" style={[styles.headerDisplayName, { color: colors.gray1 }]}>
            @{user.username}
          </AppText>
        )}

        {/* Stats Row */}
        <View style={{ width: "100%" }}>
          {loading || statsLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary1} />
          ) : (
            <View style={styles.headerStatsRow}>
              <StatBadge
                icon={<CheckIcon size={ICON_SIZES.md} color={colors.text2} />}
                value={stats.tasks}
                label="Tasks"
                color={COLORS.primary6}
              />
              <StatBadge
                icon={<TrophyIcon size={ICON_SIZES.md} color={colors.text2} />}
                value={stats.points}
                label="Points"
                color={COLORS.primary5}
              />
              <StatBadge
                icon={<FlameIcon size={ICON_SIZES.md} color={colors.text2} />}
                value={stats.streak}
                label="Days Streak"
                color={COLORS.primary4}
              />
            </View>
          )}
        </View>
      </View>
    ),
    [user?.profileImage, user?.displayName, user?.username, loading, statsLoading, stats, colors],
  );

  const headerRight = useMemo(
    () => (
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
        <NotificationBell />
        <TouchableOpacity onPress={() => setCurrentScreen("settings")} style={styles.headerRightTouchable}>
          <SettingsIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      </View>
    ),
    [setCurrentScreen],
  );

  useEffect(() => {
    if (currentScreen !== "profile") return;
    setHeaderConfig({ show: true, element: headerElement, rightElement: headerRight });
  }, [currentScreen, headerElement, headerRight, setHeaderConfig]);

  const fetchAllData = useCallback(async () => {
    if (!mountedRef.current) return null;
    console.log("[UserProfile] fetchAllData called");
    try {
      // Fetch tasks (stats are now managed by StatsContext)
      const taskList = await getTasks();
      console.log("[UserProfile] Got tasks:", taskList.length);
      if (!mountedRef.current) return null;

      // Only update tasks state if we got valid data
      if (taskList && taskList.length >= 0) {
        setTasksState(taskList);
      }

      // Also fetch scheduled tasks for today (and next days) so progress can prefer scheduled units
      try {
        const sched = await getScheduledTasksByDay(7);
        console.log("[UserProfile] Got scheduled tasks:", {
          hasSched: !!sched,
          todayTaskCount: sched?.today?.tasks?.length || 0,
        });
        if (sched && sched.today && sched.today.tasks) {
          const scheduledTaskIds = new Set<string>();
          const scheduledSubtaskKeys = new Set<string>();

          for (const t of sched.today.tasks) {
            if (t.id) scheduledTaskIds.add(t.id);
            if (Array.isArray(t.scheduledSessions)) {
              for (const s of t.scheduledSessions) {
                if (s.subtaskIndex !== undefined && s.subtaskIndex !== null) {
                  scheduledSubtaskKeys.add(`${t.id}:${s.subtaskIndex}`);
                }
              }
            }
          }

          console.log("[UserProfile] Scheduled info:", {
            taskIds: scheduledTaskIds.size,
            subtaskKeys: scheduledSubtaskKeys.size,
          });
          const progress = calculateTaskProgress(taskList, 14, {
            taskIds: scheduledTaskIds,
            subtaskKeys: scheduledSubtaskKeys,
          });
          console.log("[UserProfile] Progress calculated:", {
            todayTotal: progress.today.total,
            todayCompleted: progress.today.completed,
            dailyProgressSum: progress.dailyProgress.reduce((a, b) => a + b, 0),
          });
          setTaskProgress(progress);
          // Only update progressData if we have meaningful data or if user has tasks
          // This prevents UI from flashing zeros during refresh
          if (taskList.length > 0 || progress.dailyProgress.some((p) => p > 0)) {
            setProgressData(progress.dailyProgress);
          }
        } else {
          console.log("[UserProfile] No scheduled tasks for today, using fallback");
          const progress = calculateTaskProgress(taskList, 14);
          setTaskProgress(progress);
          if (taskList.length > 0 || progress.dailyProgress.some((p) => p > 0)) {
            setProgressData(progress.dailyProgress);
          }
        }
      } catch (err) {
        // If scheduled fetch fails, fallback to normal progress calc
        console.log("[UserProfile] Scheduled fetch failed, using fallback");
        const progress = calculateTaskProgress(taskList, 14);
        setTaskProgress(progress);
        if (taskList.length > 0 || progress.dailyProgress.some((p) => p > 0)) {
          setProgressData(progress.dailyProgress);
        }
      }

      return taskList;
    } catch (err) {
      console.warn("UserProfile fetch failed", err);
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch tasks and scheduled tasks so progress can use scheduled tasks for today
    (async () => {
      const taskList = await fetchAllData();
      try {
        // Load scheduled tasks for 7 days to capture today's scheduled items
        const sched = await getScheduledTasksByDay(7);
        if (sched && sched.today && sched.today.tasks && taskList) {
          const scheduledTaskIds = new Set<string>();
          const scheduledSubtaskKeys = new Set<string>();

          for (const t of sched.today.tasks) {
            if (t.id) scheduledTaskIds.add(t.id);
            if (Array.isArray(t.scheduledSessions)) {
              for (const s of t.scheduledSessions) {
                if (s.subtaskIndex !== undefined && s.subtaskIndex !== null) {
                  scheduledSubtaskKeys.add(`${t.id}:${s.subtaskIndex}`);
                }
              }
            }
          }

          // Recalculate progress with scheduled info using the freshly fetched task list
          const progress = calculateTaskProgress(taskList, 14, {
            taskIds: scheduledTaskIds,
            subtaskKeys: scheduledSubtaskKeys,
          });
          setTaskProgress(progress);
          // Only update if meaningful data
          if (taskList.length > 0 || progress.dailyProgress.some((p) => p > 0)) {
            setProgressData(progress.dailyProgress);
          }
        }
      } catch (err) {
        // ignore schedule fetch errors
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchAllData]);

  useEffect(() => {
    const onState = (state: AppStateStatus) => {
      if (state === "active") {
        fetchAllData();
        refreshStats(); // Also refresh stats when app becomes active
      }
    };
    const sub = AppState.addEventListener("change", onState);
    return () => sub.remove();
  }, [fetchAllData, refreshStats]);
  useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(() => {
      fetchAllData();
      refreshStats(); // Also refresh stats when tasks are updated
    });
    return unsubscribe;
  }, [subscribeToTaskUpdates, fetchAllData, refreshStats]);

  const graphWidth = Math.min(width - SPACING.xlg * 2 - SPACING.md * 2, 500);

  if (currentScreen === "settings") {
    const pending = pendingSettingsScreenRef.current;
    const pendingSub = (pendingSettingsScreenRef as any).subScreen as string | undefined;
    pendingSettingsScreenRef.current = undefined;
    (pendingSettingsScreenRef as any).subScreen = undefined;
    return <SettingsScreen onBack={() => setCurrentScreen("profile")} initialScreen={pending as any} initialSubScreen={pendingSub} />;
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
                <View style={[styles.progressSummary, { backgroundColor: colors.bg2 }]}>
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.today.completed}/{taskProgress.today.total}
                    </AppText>
                    <AppText variant="notes" style={[styles.progressSummaryLabel, { color: colors.gray1 }]}>
                      Today
                    </AppText>
                  </View>
                  <View style={[styles.progressSummaryDivider, { backgroundColor: colors.gray1 }]} />
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.today.percentage}%
                    </AppText>
                    <AppText variant="notes" style={[styles.progressSummaryLabel, { color: colors.gray1 }]}>
                      Completed
                    </AppText>
                  </View>
                  <View style={[styles.progressSummaryDivider, { backgroundColor: colors.gray1 }]} />
                  <View style={styles.progressSummaryItem}>
                    <AppText variant="boldText" style={styles.progressSummaryValue}>
                      {taskProgress.week.completed}
                    </AppText>
                    <AppText variant="notes" style={[styles.progressSummaryLabel, { color: colors.gray1 }]}>
                      This Week
                    </AppText>
                  </View>
                </View>
              )}
              <ProgressGraph data={progressData} width={graphWidth} height={moderateScale(100)} />
            </>
          )}
          <AppText variant="notes" style={[styles.progressNote, { color: colors.gray1 }]}>
            {tasks.length > 0
              ? `Track your daily task completion over the last ${progressData.length} days`
              : "Complete tasks to see your progress here!"}
          </AppText>
        </View>
      </Box>
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
    fontSize: FONT_SIZES.md,
  },
  progressSummaryLabel: {
    color: COLORS.lightGray,
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  progressSummaryDivider: {
    width: 1,
    height: FONT_SIZES.lg,
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
