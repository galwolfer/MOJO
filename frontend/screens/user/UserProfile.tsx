import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { COLORS, SPACING, SHADOWS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import Box from "../../components/layout/Box";
import { StatBadge, ProgressGraph, FriendListItem } from "./components";
import { moderateScale } from "react-native-size-matters";
import { getUserStats } from "../../services/userService";
import { getTasks, calculateTaskProgress, type Task, type TaskProgress } from "../../services/taskService";
import SettingsScreen from "./Settings";

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
  const [currentScreen, setCurrentScreen] = useState<"profile" | "settings">("profile");

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

  useEffect(() => {
    if (currentScreen === "profile") {
      setHeaderConfig({
        show: true,
        element: (
          <View style={styles.headerProfileSection}>
            {/* Avatar */}
            <View style={styles.headerAvatarWrapper}>
              {user?.profileImage ? (
                <Image
                  source={{
                    uri: user.profileImage,
                  }}
                  style={styles.headerAvatarImage}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <UserIcon size={50} color={COLORS.grayLight} />
                </View>
              )}
            </View>

            {/* Display Name */}
            <AppText variant="title2" style={styles.headerUsername}>
              {user?.displayName || user?.username || "User"}
            </AppText>
            {user?.username && user?.displayName && user.displayName !== user.username && (
              <AppText variant="notes" style={styles.headerDisplayName}>
                @{user.username}
              </AppText>
            )}

            {/* Stats Row */}
            <View style={styles.headerStatsRow}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary1} />
              ) : (
                <>
                  <StatBadge
                    icon={<CheckIcon size={28} color={COLORS.colorWhite} />}
                    value={stats.tasks}
                    label="Tasks"
                    color={COLORS.primary6}
                  />
                  <StatBadge
                    icon={<TrophyIcon size={28} color={COLORS.colorWhite} />}
                    value={stats.points}
                    label="Points"
                    color={COLORS.primary5}
                  />
                  <StatBadge
                    icon={<FlameIcon size={28} color={COLORS.colorWhite} />}
                    value={stats.streak}
                    label="Days Streak"
                    color={COLORS.primary4}
                  />
                </>
              )}
            </View>
          </View>
        ),
        rightElement: (
          <View style={styles.headerRight}>
            <AppButton icon="settings" mode="light" color="primary1" onPress={() => setCurrentScreen("settings")} />
          </View>
        ),
      });
    }
  }, [currentScreen, user?.profileImage, user?.displayName, user?.username, loading, stats]);

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

  const graphWidth = Math.min(width - SPACING.xlg * 2 - SPACING.md * 2, 300);

  // If on Settings screen, render SettingsScreen
  if (currentScreen === "settings") {
    return <SettingsScreen onBack={() => setCurrentScreen("profile")} />;
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

      {/* Friends Section */}
      <Box title="Friends">
        <View style={styles.friendsGradient}>
          <View style={styles.friendsList}>
            {MOCK_FRIENDS.map((friend) => (
              <FriendListItem key={friend.id} {...friend} />
            ))}
          </View>
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
    paddingBottom: SPACING.xlg * 2,
  },

  // Header Profile Styles
  headerProfileSection: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
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
    color: COLORS.grayLight,
    textAlign: "center",
  },
  headerStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  headerRight: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
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
    color: COLORS.grayLight,
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
    color: COLORS.primary3,
    fontSize: moderateScale(18),
  },
  progressSummaryLabel: {
    color: COLORS.grayLight,
    fontSize: moderateScale(10),
    marginTop: 2,
  },
  progressSummaryDivider: {
    width: 1,
    height: moderateScale(30),
    backgroundColor: COLORS.grayLight,
    opacity: 0.3,
  },
  progressNote: {
    color: COLORS.grayLight,
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
