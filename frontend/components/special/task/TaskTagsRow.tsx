import React from "react";
import { View } from "react-native";
import Tag from "../../inputs/tag";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { StyleSheet } from "react-native";
import { SPACING } from "../../../theme";
import { getImportanceLabel, getEffortLabel } from "../../widgets/widgetHelpers";

export const TaskTagsRow: React.FC<{
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  importance?: number | null;
  effort?: number | null;
}> = ({ category, categoryDisplay, subcategory, subcategoryDisplay, importance, effort }) => {
  const categoryMeta = getCategoryMeta(category);
  const subLabel = subcategoryDisplay || subcategory || "";

  const importanceIcon = (imp?: number | null) => {
    if (!imp) return "list";
    if (imp <= 2) return "lowImportant";
    if (imp === 3) return "mediumImportant";
    return "highPriority";
  };

  const importanceColorIndex = (imp?: number | null) => {
    if (!imp) return 8;
    if (imp <= 2) return 6;
    if (imp === 3) return 5;
    return 7;
  };

  const effortIcon = (eff?: number | null) => {
    if (!eff) return "list";
    if (eff <= 2) return "lowEffort";
    if (eff === 3) return "flame";
    return "highEffort";
  };

  const effortColor = (eff?: number | null) => {
    if (!eff) return 8;
    if (eff <= 2) return 6;
    if (eff === 3) return 5;
    return 7;
  };

  return (
    <View style={styles.tagRow}>
      {category && (
        <Tag
          label={categoryDisplay || category}
          leftIcon={categoryMeta.icon}
          colorIndex={categoryMeta.colorIndex}
          style={styles.tagItem}
        />
      )}

      {subLabel ? (
        <Tag label={subLabel} colorIndex={Math.max(0, Math.min(17, subLabel.length % 9))} style={styles.tagItem} />
      ) : null}

      {importance ? (
        <Tag
          label={getImportanceLabel(importance ?? undefined)}
          leftIcon={importanceIcon(importance)}
          colorIndex={importanceColorIndex(importance)}
          style={styles.tagItem}
        />
      ) : null}

      {effort ? (
        <Tag
          label={getEffortLabel(effort ?? undefined)}
          leftIcon={effortIcon(effort)}
          colorIndex={effortColor(effort)}
          style={styles.tagItem}
        />
      ) : null}
    </View>
  );
};

export default TaskTagsRow;

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tagItem: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
