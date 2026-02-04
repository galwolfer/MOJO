import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../common/AppText";
import { ICONS } from "../icons/icons";
import { COLORS, FONT_SIZES, ICON_SIZES, SPACING } from "../../theme";

const DEFAULT_ICON_OPTIONS = [
  "work",
  "study",
  "health",
  "home",
  "family",
  "hobbies",
  "creative",
  "goals",
  "mindfulness",
  "workout",
  "list",
  "calendar",
  "clock",
  "check",
  "heart",
  "puzzle",
  "explore",
];

type SubcategoryIconPickerProps = {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options?: string[];
  allowNone?: boolean;
};

export default function SubcategoryIconPicker({
  label,
  value,
  onChange,
  options,
  allowNone = true,
}: SubcategoryIconPickerProps) {
  const availableIcons = useMemo(() => {
    const list = options && options.length > 0 ? options : DEFAULT_ICON_OPTIONS;
    return list.filter((key) => !!ICONS[key]);
  }, [options]);

  const DefaultIcon = ICONS.default;

  return (
    <View style={styles.container}>
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <View style={styles.grid}>
        {allowNone && (
          <TouchableOpacity style={[styles.iconOption, !value && styles.iconSelected]} onPress={() => onChange(null)}>
            <AppText style={styles.iconNoneText}>None</AppText>
          </TouchableOpacity>
        )}
        {availableIcons.map((key) => {
          const Icon = ICONS[key] || DefaultIcon;
          const isSelected = value === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.iconOption, isSelected && styles.iconSelected]}
              onPress={() => onChange(key)}
            >
              <Icon size={ICON_SIZES.sm} color={isSelected ? COLORS.primary1 : COLORS.darkGray} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  label: {
    fontWeight: "400",
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  iconSelected: {
    borderColor: COLORS.primary1,
    backgroundColor: COLORS.white2,
  },
  iconNoneText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
});
