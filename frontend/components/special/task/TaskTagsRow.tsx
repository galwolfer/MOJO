import React from "react";
import { View } from "react-native";
import Tag from "../../inputs/tag";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { StyleSheet } from "react-native";
import { SPACING, paletteIndexFromColorToken } from "../../../theme";
import { getImportanceLabel, getEffortLabel } from "../../widgets/taskHelpers";

export const TaskTagsRow: React.FC<{
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  subCategory?: { icon?: string | null; color?: string | null; source?: string | null; parent?: string | null } | null;
  importance?: number | null;
  effort?: number | null;
  tags?: string[];
}> = ({ category, categoryDisplay, subcategory, subcategoryDisplay, subCategory, importance, effort, tags }) => {
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
          label={categoryDisplay || categoryMeta.displayName || category}
          leftIcon={categoryMeta.icon}
          colorIndex={categoryMeta.colorIndex}
          style={styles.tagItem}
        />
      )}

      {subLabel
        ? (() => {
            // If subcategory is a system 'General' subcategory, use category icon and color
            if (subCategory && subCategory.source === "category-default") {
              return (
                <Tag
                  label={subLabel}
                  leftIcon={categoryMeta.icon}
                  colorIndex={categoryMeta.colorIndex}
                  style={styles.tagItem}
                />
              );
            }

            // If subcategory has its own color token (e.g., p1, p2), translate to color index
            if (subCategory && subCategory.color) {
              const colorIdx = paletteIndexFromColorToken(subCategory.color, categoryMeta.colorIndex);
              return (
                <Tag
                  label={subLabel}
                  leftIcon={subCategory.icon || undefined}
                  colorIndex={colorIdx}
                  style={styles.tagItem}
                />
              );
            }

            // Fallback: use generated color index
            return (
              <Tag
                label={subLabel}
                colorIndex={Math.max(0, Math.min(17, subLabel.length % 9))}
                style={styles.tagItem}
              />
            );
          })()
        : null}

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

      {tags && tags.length > 0
        ? tags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              leftIcon={categoryMeta.icon}
              colorIndex={categoryMeta.colorIndex}
              style={styles.tagItem}
            />
          ))
        : null}
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
