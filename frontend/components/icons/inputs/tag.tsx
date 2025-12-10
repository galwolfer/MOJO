import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY, getPalettePair } from "../../../theme";
import { ICONS } from "../icons";

interface TagProps {
  label: string;
  editable?: boolean;
  onRemove?: () => void;
  leftIcon?: React.ReactNode;
  /** choose a color palette 1..7, random if omitted */
  colorIndex?: number;
  style?: ViewStyle;
}

const Tag = ({ label, editable = false, onRemove, leftIcon, colorIndex, style }: TagProps) => {
  const pair = getPalettePair(typeof colorIndex === "number" ? colorIndex : undefined);

  return (
    <View style={[styles.root, { backgroundColor: pair.bg }, style]}>
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <Text style={[styles.label, { color: pair.text }]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      {editable && (
        <TouchableOpacity onPress={onRemove} accessibilityRole="button" style={styles.removeTouch}>
          <ICONS.cancel width={14} height={14} color={pair.text} />
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
  remove: {
    color: COLORS.darkP4,
    fontSize: 14,
    lineHeight: 14,
  },
});

export default Tag;
