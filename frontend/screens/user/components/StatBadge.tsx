import React from "react";
import { View, StyleSheet } from "react-native";
import { useWindowDimensions } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, SHADOWS } from "../../../theme";
import { moderateScale } from "react-native-size-matters";

/**
 * StatBadge
 *
 * Displays a single stat with an icon, value, and label.
 * Used in the user profile for showing tasks, points, and streak.
 *
 * Props:
 * - `icon` - React node (icon component) to display
 * - `value` - The numeric value to display
 * - `label` - Text label below the value
 * - `color` - Optional color for the icon background (defaults to primary1)
 */

type StatBadgeProps = {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color?: string;
};

const StatBadge: React.FC<StatBadgeProps> = ({ icon, value, label, color = COLORS.primary1 }) => {
  const { width } = useWindowDimensions();
  const isSmall = width < 450;

  if (isSmall) {
    return (
      <View style={[styles.container, styles.smallContainer, { backgroundColor: color }]}>
        <View style={styles.topRow}>
          <View style={styles.iconCircle}>{icon}</View>
          <AppText variant="boldText" style={styles.value}>
            {value}
          </AppText>
        </View>
        <AppText variant="notes" style={styles.label}>
          {label}
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <View style={styles.iconCircle}>{icon}</View>
      <View style={styles.textContainer}>
        <AppText variant="boldText" style={styles.value}>
          {value}
        </AppText>
        <AppText variant="notes" style={styles.label}>
          {label}
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(25),
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  smallContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    width: "30%",
    gap: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  iconCircle: {
    width: moderateScale(32),
    height: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "flex-start",
  },
  value: {
    fontSize: moderateScale(14),
    color: COLORS.colorWhite,
    lineHeight: moderateScale(16),
  },
  label: {
    fontSize: moderateScale(10),
    color: COLORS.colorWhite,
    lineHeight: moderateScale(12),
    textAlign: "center",
  },
});

export default StatBadge;
