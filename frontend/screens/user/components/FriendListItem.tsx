import React from "react";
import { View, StyleSheet, Image } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, SHADOWS } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
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

const MiniStat: React.FC<{ icon: React.ReactNode; value: number; color: string }> = ({ icon, value, color }) => (
  <View style={[styles.miniStat, { backgroundColor: color }]}>
    <View style={styles.miniIcon}>{icon}</View>
    <AppText variant="notes" style={styles.miniValue}>
      {value}
    </AppText>
  </View>
);

const FriendListItem: React.FC<FriendListItemProps> = ({ name, avatar, stats, isOnline = false }) => {
  const colors = useColors();
  const UserIcon = ICONS.user;
  const CheckIcon = ICONS.list;
  const FlameIcon = ICONS.flame;
  const TrophyIcon = ICONS.trophy;

  return (
    <View style={styles.container}>
      {/* Avatar with online indicator */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarShadow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.bg2 }]}>
              <UserIcon size={moderateScale(18)} color={colors.gray1} />
            </View>
          )}
        </View>
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.contentContainer}>
        <AppText variant="bodyText" style={[styles.name, { color: colors.text1 }]} numberOfLines={1}>
          {name}
        </AppText>

        <View style={styles.statsRow}>
          <MiniStat
            icon={<CheckIcon size={moderateScale(16)} color={colors.text2} />}
            value={stats.tasks}
            color={COLORS.primary6}
          />
          <MiniStat
            icon={<FlameIcon size={moderateScale(16)} color={colors.text2} />}
            value={stats.streak}
            color={COLORS.primary5}
          />
          <MiniStat
            icon={<TrophyIcon size={moderateScale(16)} color={colors.text2} />}
            value={stats.points}
            color={COLORS.primary4}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    alignSelf: "stretch",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
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
    paddingRight: SPACING.sm,
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: SPACING.sm,
  },
  name: {
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    flexShrink: 0,
    flexWrap: "wrap",
    marginTop: 6,
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: moderateScale(14),
    gap: 8,
    minWidth: moderateScale(36),
    maxWidth: moderateScale(70),
    justifyContent: "center",
  },
  miniIcon: {
    width: moderateScale(18),
    height: moderateScale(18),
    alignItems: "center",
    justifyContent: "center",
  },
  miniValue: {
    color: COLORS.colorWhite,
    fontSize: moderateScale(13),
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginTop: SPACING.sm,
  },
  avatarShadow: {
    borderRadius: moderateScale(26),
    alignItems: "center",
    justifyContent: "center",
    // apply the card shadow token for consistent look
    ...(SHADOWS.card as object),
    padding: 2,
    backgroundColor: COLORS.white,
  },
});

export default FriendListItem;
