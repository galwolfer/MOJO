import React from "react";
import { View } from "react-native";
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
  hideIcon?: boolean;
  style?: any;
  textStyle?: any;
  iconStyle?: any;
  leadingNode?: React.ReactNode;
  reversed?: boolean;
}> = ({ title, taskname, category, size = "lg", hideIcon, style, textStyle, iconStyle, leadingNode, reversed }) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";

  return (
    <View style={[styles.titleRow, style, reversed ? { flexDirection: "row-reverse" } : undefined]}>
      {!hideIcon && meta?.icon ? (
        <Icon name={meta.icon} size={iconSize} color={meta.color} style={[styles.icon, iconStyle]} />
      ) : null}
      {leadingNode}
      <AppText variant={titleVariant} style={[styles.titleText, textStyle]} numberOfLines={3}>
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
  titleText: {
    fontWeight: "600",
    flex: 1,
    textAlign: "left",
  },
  icon: {
    marginLeft: SPACING.sm,
    marginBottom: -SPACING.xs,
  },
});
