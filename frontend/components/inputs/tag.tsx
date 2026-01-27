import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, ICON_SIZES, getPalettePair } from "../../theme";
import { ICONS } from "../icons/icons";

interface TagProps {
  label: string;
  editable?: boolean;
  onRemove?: () => void;
  /** Optional icon node or an `ICONS` map key (e.g., 'study', 'flame') */
  leftIcon?: React.ReactNode | string;
  /** choose a color palette 1..7, random if omitted */
  colorIndex?: number;
  /** optional explicit background and text colors (hex/string) */
  bgColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>; // accept style objects or arrays
}

/**
 * Tag - A styled tag component with optional remove functionality.
 * @param label - The text label for the tag.
 * @param editable - Whether the tag can be removed.
 * @param onRemove - Callback when the remove button is pressed.
 * @param leftIcon - Optional icon to display on the left.
 * @param colorIndex - Color palette index (1-7).
 * @param style - Optional custom styles.
 */
const Tag = ({ label, editable = false, onRemove, leftIcon, colorIndex, bgColor, textColor, style }: TagProps) => {
  const pair = getPalettePair(typeof colorIndex === "number" ? colorIndex : undefined);
  const bg = bgColor || pair.bg;
  const text = textColor || pair.text;

  return (
    <View style={[styles.root, { backgroundColor: bg }, style]}>
      {leftIcon ? (
        <View style={styles.leftIcon}>
          {typeof leftIcon === "string"
            ? (() => {
                const IconComp = (ICONS as any)[leftIcon];
                return IconComp ? <IconComp size={ICON_SIZES.sm} color={text} /> : null;
              })()
            : leftIcon}
        </View>
      ) : null}
      <Text style={[styles.label, { color: text }]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      {editable && (
        <TouchableOpacity onPress={onRemove} accessibilityRole="button" style={styles.removeTouch}>
          <ICONS.cancel width={ICON_SIZES.sm} height={ICON_SIZES.sm} color={text} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    padding: SPACING.md,
    gap: 1,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.notes,
    color: COLORS.darkP4,
  },
  removeTouch: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Tag;
