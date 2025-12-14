import React from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions, Platform } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, ICON_SIZES } from "../../theme";
import { ICONS } from "../icons/icons";

type HeaderProps = {
  title?: string;
  logo?: any; // image source or React element
  Icon?: any; // icon component
  show?: boolean;
  children?: React.ReactNode;
  style?: any;
};

export default function Header({ title, Icon = ICONS.calendar, show = true, children, style }: HeaderProps) {
  const { width } = useWindowDimensions();
  if (!show) return null;

  // default icon from the icons lib when `logo` prop isn't provided

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        <Icon size={ICON_SIZES.big} color={COLORS.primary1} />
        {title ? <Text style={[TYPOGRAPHY.title, styles.titleText]}>{title}</Text> : null}
      </View>

      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    // avoid `gap` (not widely supported) and use explicit paddings
    paddingHorizontal: SPACING.md,

    // small top inset so header doesn't butt up against status bar on mobile
    paddingTop: Platform.OS === "android" ? SPACING.xlg + SPACING.md : SPACING.lg,
    paddingBottom: SPACING.lg,

    backgroundColor: COLORS.white,

    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,

    ...(SHADOWS.card as object),
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    // use margins on children for spacing instead of `gap`
  },
  titleText: {
    color: COLORS.primary1,
    marginLeft: SPACING.md,
  },
  children: {
    width: "100%",
    marginTop: SPACING.lg,
  },
});
