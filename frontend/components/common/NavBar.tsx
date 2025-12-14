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
        <ICONS.user size={ICON_SIZES.md} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.ojo size={ICON_SIZES.md} color={COLORS.primary1} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.7}>
        <ICONS.list size={ICON_SIZES.md} color={COLORS.primary1} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SPACING.xlg,
    borderTopRightRadius: SPACING.xlg,
    borderColor: COLORS.primary1,
    borderWidth: 1,
    ...(Platform.OS === "web" ? { boxShadow: SHADOWS.card.boxShadow } : {}),
    shadowColor: SHADOWS.card.shadowColor,
    shadowOffset: SHADOWS.card.shadowOffset,
    shadowOpacity: SHADOWS.card.shadowOpacity,
    shadowRadius: SHADOWS.card.shadowRadius,
    elevation: SHADOWS.card.elevation,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
});
