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
}> = ({ title, taskname, category, size = "lg", leadingNode, style, textStyle, iconStyle }) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";
  return (
    <View style={[styles.titleRow, style]}>
      {leadingNode}
      {meta?.icon ? (
        <Icon name={meta.icon} size={iconSize} color={meta.color} style={[styles.icon, iconStyle]} />
      ) : null}
      <AppText variant={titleVariant} numberOfLines={2}>
        {title || taskname}
      </AppText>
    </View>
  );
};

export default TaskTitle;

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  icon: {
    marginLeft: SPACING.sm,
    marginBottom: -SPACING.xs,
  },
});
