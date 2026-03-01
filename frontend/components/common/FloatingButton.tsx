import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle, Text, View } from "react-native";
import AppText from "../common/AppText";
import { COLORS, ICON_SIZES, SHADOWS, SPACING } from "../../theme";
import useContentInsets from "../../hooks/useContentInsets";
import { useColors } from "../../context/ThemeContext";

interface Props {
  onPress: () => void;
  text?: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  right?: boolean; // keep for future alignment support
  style?: ViewStyle;
  color?: string;
}

export default function FloatingButton({ onPress, text = "ADD", Icon, style, color }: Props) {
  const insets = useContentInsets();
  const colors = useColors();
  const backgroundColor = color || COLORS.primary6; // default to green (primary6)

  return (
    <TouchableOpacity style={[styles.floatingButton, { backgroundColor }, style]} onPress={onPress}>
      {text ? (
        <AppText variant="bodyText" style={[styles.buttonText, { color: colors.text2 }]}>
          {text}
        </AppText>
      ) : null}
      {Icon ? (
        <View style={styles.iconWrap}>
          <Icon size={ICON_SIZES.sm} color={colors.text2} style={text ? styles.plusIcon : undefined} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    right: SPACING.lg,
    bottom: SPACING.xlg * 4 + SPACING.lg, // adjust for nav bar
    borderRadius: SPACING.xlg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.card,
    elevation: 6,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "600",
    marginRight: SPACING.sm,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  plusIcon: {
    marginLeft: SPACING.sm,
  },
});
