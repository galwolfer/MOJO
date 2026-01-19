import React from "react";
import { View, StyleSheet, Image } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, SHADOWS } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { moderateScale } from "react-native-size-matters";

/**
 * FriendListItem
 *
 * Displays a friend in the friends list with avatar, name, and mini stats.
 *
 * Props:
 * - `name` - Friend's display name
 * - `avatar` - URL or local image for the avatar
 * - `tasks` - Number of completed tasks
 * - `points` - Total points earned
 * - `streak` - Current streak days
 * - `isOnline` - Whether the friend is currently online
 */

type FriendStats = {
  tasks: number;
  points: number;
  streak: number;
};

type FriendListItemProps = {
  name: string;
  avatar?: string | null;
  stats: FriendStats;
  isOnline?: boolean;
};

const MiniStat: React.FC<{ icon: React.ReactNode; value: number; color: string }> = ({
  icon,
  value,
  color,
}) => (
  <View style={[styles.miniStat, { backgroundColor: color }]}>
    <View style={styles.miniIcon}>{icon}</View>
    <AppText variant="notes" style={styles.miniValue}>
      {value}
    </AppText>
  </View>
);

const FriendListItem: React.FC<FriendListItemProps> = ({
  name,
  avatar,
  stats,
  isOnline = false,
}) => {
  const UserIcon = ICONS.user;
  const CheckIcon = ICONS.list;
  const FlameIcon = ICONS.flame;
  const TrophyIcon = ICONS.trophy;

  return (
    <View style={styles.container}>
      {/* Avatar with online indicator */}
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <UserIcon size={20} color={COLORS.grayLight} />
          </View>
        )}
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Name */}
      <View style={styles.nameContainer}>
        <AppText variant="bodyText" style={styles.name} numberOfLines={1}>
          {name}
        </AppText>
      </View>

      {/* Mini stats */}
      <View style={styles.statsRow}>
        <MiniStat
          icon={<CheckIcon size={12} color={COLORS.colorWhite} />}
          value={stats.tasks}
          color={COLORS.primary6}
        />
        <MiniStat
          icon={<FlameIcon size={12} color={COLORS.colorWhite} />}
          value={stats.streak}
          color={COLORS.primary5}
        />
        <MiniStat
          icon={<TrophyIcon size={12} color={COLORS.colorWhite} />}
          value={stats.points}
          color={COLORS.primary4}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: "transparent",
    gap: SPACING.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    borderWidth: 2,
    borderColor: COLORS.white2,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.white2,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: COLORS.primary6,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  nameContainer: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: COLORS.colorWhite,
    fontSize: moderateScale(14),
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: moderateScale(10),
    gap: 3,
  },
  miniIcon: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniValue: {
    color: COLORS.colorWhite,
    fontSize: moderateScale(10),
    fontWeight: "600",
  },
});

export default FriendListItem;
