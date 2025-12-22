import React from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions, Platform } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, ICON_SIZES } from "../../theme";
import { ICONS } from "../icons/icons";

type HeaderProps = {
  title?: string;
  Icon?: any; // icon component
  show?: boolean;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  centerElement?: React.ReactNode;
  style?: any;
};

export default function Header({ title, Icon, show = true, rightElement, leftElement, style }: HeaderProps) {
  if (!show) return null;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.container}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {leftElement}
          {Icon && !leftElement && <Icon size={ICON_SIZES.big} color={COLORS.primary1} />}
          {title && <Text style={[TYPOGRAPHY.title, styles.titleText]}>{title}</Text>}
        </View>

        {/* Right Section */}
        {rightElement && <View style={styles.rightSection}>{rightElement}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === "android" ? SPACING.xlg + SPACING.md : SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    ...(SHADOWS.card as object),
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  leftSection: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
  },
  centerSection: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  titleText: {
    width: "100%",
    marginLeft: SPACING.sm,
    color: COLORS.primary1,
  },
});
