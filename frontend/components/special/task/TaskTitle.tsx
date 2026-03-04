import React from "react";
import { View, StyleProp, ViewStyle, TextStyle } from "react-native";
import AppText from "../../common/AppText";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { StyleSheet } from "react-native";
import Icon from "../../icons/Icon";
import { ICON_SIZES, SPACING } from "../../../theme";

export const TaskTitle: React.FC<{
  title?: string;
  taskname?: string;
  category?: string;
  size?: "sm" | "md" | "lg";
  /** When true, the category icon is never rendered regardless of category value */
  hideIcon?: boolean;
  /** Rendered before the category icon — use for Checkbox or other leading controls */
  leadingNode?: React.ReactNode;
  /** Merged with the default row container style */
  style?: StyleProp<ViewStyle>;
  /** Merged with the default title text style */
  textStyle?: StyleProp<TextStyle>;
  /** Merged with the default icon style */
  iconStyle?: StyleProp<ViewStyle>;
  reversed?: boolean;
}> = ({
  title,
  taskname,
  category,
  hideIcon = false,
  size = "lg",
  reversed = false,
  leadingNode,
  style,
  textStyle,
  iconStyle,
}) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";

  // Insert zero‑width spaces between characters so extremely long words (or
  // languages without spaces) can wrap anywhere. The invisible characters do
  // not affect rendering but give the layout engine valid breakpoints.
  const rawText = title || taskname || "";
  const breakableText = rawText.split("").join("\u200B");

  return (
    <View style={[styles.titleRow, style, reversed ? styles.reversedRow : null]}>
      {!hideIcon && meta?.icon ? (
        <Icon name={meta.icon} size={iconSize} color={meta.color} style={[styles.icon, iconStyle]} />
      ) : null}
      <View style={styles.rightTitle}>
        {leadingNode}
        <AppText variant={titleVariant} style={{ flex: 1, flexWrap: "wrap", flexShrink: 1 }}>
          {breakableText}
        </AppText>
      </View>
    </View>
  );
};

export default TaskTitle;

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  reversedRow: {
    flexDirection: "row-reverse",
  },

  rightTitle: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignContent: "center",
    flexWrap: "wrap",
    flex: 1,
  },

  icon: {
    marginLeft: SPACING.sm,
    marginBottom: -SPACING.xs,
  },
});
