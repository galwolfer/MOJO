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
}> = ({ title, taskname, category, size = "lg" }) => {
  const meta = getCategoryMeta(category);
  const iconSize = size === "sm" ? ICON_SIZES.sm : size === "md" ? ICON_SIZES.md : ICON_SIZES.big;
  const titleVariant = size === "sm" ? "bodyText" : size === "md" ? "boldText" : "title3";
  return (
    <View style={styles.titleRow}>
      {meta?.icon ? <Icon name={meta.icon} size={iconSize} color={meta.color} style={styles.icon} /> : null}
      <AppText variant={titleVariant} style={styles.titleText} numberOfLines={3}>
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
