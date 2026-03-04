import React, { useMemo, useState, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View, ScrollView } from "react-native";
import AppText from "../common/AppText";
import FilterChips from "../common/FilterChips";
import { DEMO_FILTERS } from "../../config/iconFilters";
import { ICONS, ICON_NAMES } from "../icons/icons";
import { COLORS, FONT_SIZES, ICON_SIZES, SPACING } from "../../theme";
import { useColors } from "../../context/ThemeContext";

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
  const colors = useColors();

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
      <FilterChips
        filters={Object.keys(DEMO_FILTERS)}
        selected={selectedFilter}
        onChange={(f) => {
          setSelectedFilter(f);
          // if current value is not in new list, clear it so selection stays consistent
          if (value && f !== "All" && !(DEMO_FILTERS[f] || []).includes(value)) {
            onChange(null);
          }
        }}
        style={styles.filterScroll}
      />

      <View style={styles.grid} onLayout={onGridLayout}>
        {allowNone && (
          <TouchableOpacity
            style={[
              styles.iconOption,
              { width: itemSize, height: itemSize, backgroundColor: colors.bg1, borderColor: colors.lightP1 },
              !value && styles.iconSelected,
            ]}
            onPress={() => onChange(null)}
            accessibilityLabel="No icon"
          ></TouchableOpacity>
        )}
        {availableIcons.map((key) => {
          const Icon = ICONS[key] || DefaultIcon;
          const isSelected = value === key;
          const iconRenderSize = isSelected ? ICON_SIZES.md : ICON_SIZES.sm + 2;
          const iconRenderColor = isSelected ? selectedColor || COLORS.primary1 : colors.gray2;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.iconOption,
                { width: itemSize, height: itemSize, backgroundColor: colors.bg1, borderColor: colors.lightP1 },
                isSelected && [
                  styles.iconSelected,
                  {
                    borderColor: selectedColor || COLORS.primary1,
                    backgroundColor: colors.bg2,
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
