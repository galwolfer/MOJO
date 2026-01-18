import React, { useEffect, useState, useCallback, useRef } from "react";

/**
 * UserProfileScreen
 *
 * Displays user profile with:
 * - Profile photo with gradient ring
 * - Username display
 * - Stats row (tasks, points, streak)
 * - Progress graph (real-time from tasks)
 * - Friends list
 * - Logout action
 */
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
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import { COLORS, SPACING, SHADOWS } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "../context/NavigationContext";
import { useTaskContext } from "../context/TaskContext";
import { ICONS } from "../components/icons/icons";
import { Box } from "../components";
import ScrollableContent from "../components/layout/ScrollableContent";
import { StatBadge, ProgressGraph, FriendListItem } from "./user/components";
import { moderateScale } from "react-native-size-matters";
import { getUserStats } from "../services/userService";
import { getTasks, calculateTaskProgress, Task, TaskProgress } from "../services/taskService";

// Default progress data used as fallback
const DEFAULT_PROGRESS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Polling interval for real-time updates (in milliseconds)
const POLL_INTERVAL = 5000; // 5 seconds

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

type UserStats = {
  tasks: number;
  points: number;
  streak: number;
};

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();
  const { setHeaderConfig } = useNavigation();
  const { subscribeToTaskUpdates } = useTaskContext();
  const { width } = useWindowDimensions();

  // Real-time stats state
  const [stats, setStats] = useState<UserStats>({ tasks: 0, points: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<number[]>(DEFAULT_PROGRESS);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Refs for polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const SettingsIcon = ICONS.settings;
  const UserIcon = ICONS.user;
  const CheckIcon = ICONS.list;
  const FlameIcon = ICONS.flame;
  const TrophyIcon = ICONS.trophy;

  /**
   * Fetch all data (stats and tasks)
   * This function is called on mount and on every poll interval
   */
  const fetchAllData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      // Fetch stats and tasks in parallel for efficiency
      const [statsData, tasksData] = await Promise.all([
        getUserStats(),
        getTasks(),
      ]);

      if (!isMountedRef.current) return;

      // Update stats
      setStats(statsData);
      
      // Update tasks and calculate progress
      setTasks(tasksData);
      
      // Calculate real-time progress from tasks
      const progress = calculateTaskProgress(tasksData, 14);
      setTaskProgress(progress);
      setProgressData(progress.dailyProgress);
      
    } catch (error) {
      console.warn("Failed to fetch user data:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchAllData();

    // Set up polling for real-time updates
    pollIntervalRef.current = setInterval(fetchAllData, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchAllData]);

  // Handle app state changes (pause polling when app is in background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - refresh data immediately and resume polling
        fetchAllData();
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(fetchAllData, POLL_INTERVAL);
        }
      } else {
        // App went to background - pause polling to save resources
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [fetchAllData]);

  // Subscribe to task updates from other parts of the app (chat, task completion, etc.)
  useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(() => {
      // Immediately refresh data when a task is updated anywhere in the app
      fetchAllData();
    });

    return unsubscribe;
  }, [subscribeToTaskUpdates, fetchAllData]);

  useEffect(() => {
    setHeaderConfig({
      title: "Mojo",
      show: true,
      icon: ICONS.mojo,
      rightElement: (
        <TouchableOpacity onPress={() => {}}>
          <SettingsIcon size={24} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
    });
  }, []);

  const graphWidth = Math.min(width - SPACING.xlg * 2 - SPACING.md * 2, 300);

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="user-profile"
      contentContainerStyle={styles.contentContainer}
    >
      {/* Profile Header Section */}
      <View style={styles.profileSection}>
        {/* Avatar with gradient ring */}
        <View style={styles.avatarWrapper}>
          <LinearGradient
            colors={[COLORS.primary1, COLORS.primary2, COLORS.primary4]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <View style={styles.avatarInner}>
              {user?.displayName ? (
                <Image
                  source={{
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.displayName
                    )}&background=random&size=120`,
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={50} color={COLORS.grayLight} />
                </View>
              )}
            </View>
          </LinearGradient>

          {/* Settings button overlay */}
          <TouchableOpacity style={styles.settingsOverlay}>
            <SettingsIcon size={20} color={COLORS.colorWhite} />
          </TouchableOpacity>
        </View>

        {/* Username */}
        <AppText variant="title2" style={styles.username}>
          {user?.displayName || user?.username || "User"}
        </AppText>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary1} />
          ) : (
            <>
              <StatBadge
                icon={<CheckIcon size={16} color={COLORS.colorWhite} />}
                value={stats.tasks}
                label="Tasks"
                color={COLORS.primary6}
              />
              <StatBadge
                icon={<TrophyIcon size={16} color={COLORS.colorWhite} />}
                value={stats.points}
                label="Points"
                color={COLORS.primary5}
              />
              <StatBadge
                icon={<FlameIcon size={16} color={COLORS.colorWhite} />}
                value={stats.streak}
                label="Days Streak"
                color={COLORS.primary4}
              />
            </>
          )}
        </View>
      </View>

      {/* Progress Section */}
      <Box title="My Progress" titleColor={COLORS.primary3}>
        <View style={styles.progressContent}>
          {/* Today's Progress Summary */}
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
          
          {/* Progress Graph */}
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary3} style={{ marginVertical: SPACING.lg }} />
          ) : (
            <ProgressGraph
              data={progressData}
              width={graphWidth}
              height={moderateScale(100)}
            />
          )}
          
          <AppText variant="notes" style={styles.progressNote}>
            {tasks.length > 0 
              ? `Track your daily task completion over the last ${progressData.length} days`
              : "Complete tasks to see your progress here!"
            }
          </AppText>
        </View>
      </Box>

      {/* Friends Section */}
      <View style={styles.friendsSection}>
        <LinearGradient
          colors={[COLORS.primary3, COLORS.primary1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.friendsGradient}
        >
          {/* Title */}
          <View style={styles.friendsHeader}>
            <AppText variant="title3" style={styles.friendsTitle}>
              My Friends
            </AppText>
          </View>

          {/* Friends list */}
          <View style={styles.friendsList}>
            {MOCK_FRIENDS.map((friend) => (
              <FriendListItem
                key={friend.id}
                name={friend.name}
                avatar={friend.avatar}
                stats={friend.stats}
                isOnline={friend.isOnline}
              />
            ))}
          </View>
        </LinearGradient>
      </View>

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
    paddingBottom: SPACING.xlg * 4,
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
    marginBottom: SPACING.sm,
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
  },
  logoutText: {
    color: COLORS.primary7,
  },
});
