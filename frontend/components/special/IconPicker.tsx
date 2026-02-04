import React, { useMemo, useState, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View, ScrollView } from "react-native";
import AppText from "../common/AppText";
import { ICONS, ICON_NAMES } from "../icons/icons";
import { COLORS, FONT_SIZES, ICON_SIZES, SPACING } from "../../theme";

type SubcategoryIconPickerProps = {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options?: string[];
  allowNone?: boolean;
  selectedColor?: string | null; // tint to use when an icon is selected
};

export default function SubcategoryIconPicker({
  label,
  value,
  onChange,
  options,
  allowNone = true,
  selectedColor = null,
}: SubcategoryIconPickerProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  // Compact filters (All + 3 concise categories) covering all available icons
  const DEMO_FILTERS: Record<string, string[] | undefined> = {
    All: undefined,
    Essentials: [
      "bag",
      "calendar",
      "check",
      "clock",
      "list",
      "send",
      "settings",
      "shoppingCart",
      "plus",
      "edit",
      "repeat",
      "trash",
      "split",
      "right",
      "left",
      "up",
      "down",
      "user",
      "notifications",
      "other",
      "prefrences",
      "study",
      "goals",
      "skills",
      "medal",
      "trophy",
      "highEffort",
      "lowEffort",
      "highPriority",
      "mediumPiority",
      "mediumImportant",
      "lowImportant",
      "cancel",
    ],
    Wellness: ["health", "mindfulness", "workout", "heart", "flame"],
    Creative: [
      "creative",
      "hobbies",
      "puzzle",
      "explore",
      "burger",
      "move",
      "reflection",
      "mojo",
      "ojo",
      "friends",
      "family",
      "mentorjo",
      "bestojo",
      "brojo",
      "strictojo",
      "random",
      "default",
    ],
  };

  const availableIcons = useMemo(() => {
    // If options provided, use them; otherwise default to full ICON_NAMES registry
    const base = options && options.length > 0 ? options : ICON_NAMES;
    // apply demo filter if not "All"
    const filtered =
      DEMO_FILTERS[selectedFilter] && selectedFilter !== "All"
        ? base.filter((k) => (DEMO_FILTERS[selectedFilter] || []).includes(k))
        : base;
    return filtered.filter((key) => !!ICONS[key]);
  }, [options, selectedFilter]);

  const DefaultIcon = ICONS.default;

  // Responsive sizing: measure container and compute item size in px so layout adapts
  // Min 4 columns for mobile readability, larger max size for better visibility
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const itemCount = availableIcons.length + (allowNone ? 1 : 0);

  const { columns, itemSize } = useMemo(() => {
    const minColumns = 4; // 4 icons per row for mobile-friendly sizing
    const maxItemSize = SPACING.xlg + SPACING.md; // larger icons for mobile visibility
    const gap = SPACING.sm;

    if (!containerWidth || containerWidth <= 0) return { columns: minColumns, itemSize: maxItemSize };

    // Calculate cols based on max item size
    const maxPossibleCols = Math.floor((containerWidth + gap) / (maxItemSize + gap));
    let cols = Math.max(minColumns, maxPossibleCols); // use min 4 or more if space allows

    // Calculate actual item size based on columns
    const avail = containerWidth - gap * (cols - 1);
    const size = Math.floor(avail / cols);
    const finalSize = Math.min(size, maxItemSize); // cap at maxItemSize

    return { columns: cols, itemSize: finalSize };
  }, [containerWidth, itemCount]);

  const onGridLayout = useCallback((e: any) => setContainerWidth(e.nativeEvent.layout.width), [setContainerWidth]);

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      {/* Filter chips (demo) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ gap: SPACING.sm }}
      >
        {Object.keys(DEMO_FILTERS).map((f) => {
          const isActive = selectedFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                setSelectedFilter(f);
                // if current value is not in new list, clear it so selection stays consistent
                if (value && f !== "All" && !(DEMO_FILTERS[f] || []).includes(value)) {
                  onChange(null);
                }
              }}
            >
              <AppText style={{ color: isActive ? COLORS.white : COLORS.darkGray }}>{f}</AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.grid} onLayout={onGridLayout}>
        {allowNone && (
          <TouchableOpacity
            style={[styles.iconOption, { width: itemSize, height: itemSize }, !value && styles.iconSelected]}
            onPress={() => onChange(null)}
            accessibilityLabel="No icon"
          ></TouchableOpacity>
        )}
        {availableIcons.map((key) => {
          const Icon = ICONS[key] || DefaultIcon;
          const isSelected = value === key;
          const iconRenderSize = isSelected ? ICON_SIZES.md : ICON_SIZES.sm + 2;
          const iconRenderColor = isSelected ? selectedColor || COLORS.primary1 : COLORS.darkGray;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.iconOption,
                { width: itemSize, height: itemSize },
                isSelected && [
                  styles.iconSelected,
                  {
                    borderColor: selectedColor || COLORS.primary1,
                  },
                ],
              ]}
              onPress={() => onChange(key)}
            >
              <Icon size={iconRenderSize} color={iconRenderColor} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
    maxWidth: "100%",
  },
  label: {
    marginBottom: -SPACING.sm,
    marginTop: SPACING.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  filterScroll: {
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary1,
    borderColor: COLORS.primary1,
  },
  iconOption: {
    width: SPACING.xlg,
    height: SPACING.xlg,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  iconSelected: {
    borderWidth: 5,
    backgroundColor: COLORS.white2,
  },
});
