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
  /** Rendered before the category icon — use for Checkbox or other leading controls */
  leadingNode?: React.ReactNode;
  /** Merged with the default row container style */
  style?: StyleProp<ViewStyle>;
  /** Merged with the default title text style */
  textStyle?: StyleProp<TextStyle>;
  /** Merged with the default icon style */
  iconStyle?: StyleProp<ViewStyle>;
  reversed?: boolean;
}> = ({ title, taskname, category, size = "lg", reversed = false, leadingNode, style, textStyle, iconStyle }) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";
  return (
    <View style={[styles.titleRow, style, reversed ? styles.reversedRow : null]}>
      {meta?.icon ? (
        <Icon name={meta.icon} size={iconSize} color={meta.color} style={[styles.icon, iconStyle]} />
      ) : null}
      <View style={styles.rightTitle}>
        {leadingNode}
        <AppText variant={titleVariant} numberOfLines={2} style={{ flex: 1 }}>
          {title || taskname}
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
  },

  icon: {
    marginLeft: SPACING.sm,
    marginBottom: -SPACING.xs,
  },
});
