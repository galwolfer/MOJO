import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../../common/AppText";
import { COLORS, FONT_SIZES, SPACING } from "../../../theme";

const DEFAULT_PRIMARY_COLORS = [
  COLORS.primary1,
  COLORS.primary2,
  COLORS.primary3,
  COLORS.primary4,
  COLORS.primary5,
  COLORS.primary6,
  COLORS.primary7,
];

type SubcategoryColorPickerProps = {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  colors?: string[];
  showAuto?: boolean;
};

export default function SubcategoryColorPicker({
  label,
  value,
  onChange,
  colors,
  showAuto = true,
}: SubcategoryColorPickerProps) {
  const palette = useMemo(() => (colors && colors.length > 0 ? colors : DEFAULT_PRIMARY_COLORS), [colors]);

  return (
    <View style={styles.container}>
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <View style={styles.grid}>
        {showAuto && (
          <TouchableOpacity
            style={[styles.colorOption, styles.autoOption, !value && styles.colorSelected]}
            onPress={() => onChange(null)}
          >
            <AppText style={styles.autoText}>Auto</AppText>
          </TouchableOpacity>
        )}
        {palette.map((color) => {
          const isSelected = value === color;
          return (
            <TouchableOpacity
              key={color}
              style={[styles.colorOption, { backgroundColor: color }, isSelected && styles.colorSelected]}
              onPress={() => onChange(color)}
            />
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
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.white3,
  },
  autoOption: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.brightP1,
    alignItems: "center",
    justifyContent: "center",
  },
  autoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  colorSelected: {
    borderColor: COLORS.primary1,
    borderWidth: 2,
  },
});
