import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES } from "../../theme";

type NavBarProps = {
  show?: boolean;
};

export default function NavBar({ show = true }: NavBarProps) {
  if (!show) return null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.user size={ICON_SIZES.big} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.ojo size={ICON_SIZES.big * 1.7} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.list size={ICON_SIZES.big} color={COLORS.primary1} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === "web" ? SPACING.lg : SPACING.lg,
    paddingHorizontal: SPACING.xlg,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SPACING.xlg,
    borderTopRightRadius: SPACING.xlg,
    height: SPACING.xlg * 3 + (Platform.OS !== "web" ? SPACING.lg : 0),
    ...(SHADOWS.card as object),
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
