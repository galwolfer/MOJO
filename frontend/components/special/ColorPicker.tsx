import React, { useMemo, useState, useRef, useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../common/AppText";
import { ICONS } from "../icons/icons";
import { COLORS, FONT_SIZES, SPACING, ICON_SIZES, SHADOWS } from "../../theme";
import { useColors } from "../../context/ThemeContext";

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
  showAuto?: boolean; // kept for compatibility but renders a random color button
};

export default function SubcategoryColorPicker({
  label,
  value,
  onChange,
  colors,
  showAuto = true,
}: SubcategoryColorPickerProps) {
  const palette = useMemo(() => (colors && colors.length > 0 ? colors : DEFAULT_PRIMARY_COLORS), [colors]);
  const themeColors = useColors();
  const RandomIcon = ICONS.random;

  // Track if the currently chosen color was selected via the random button
  const [randomSelected, setRandomSelected] = useState(false);
  const lastRandom = useRef<string | null>(null);

  useEffect(() => {
    // If the external value equals the last random color we chose, keep the random button marked.
    // Otherwise clear the mark so explicit color picks show as selected normally.
    if (value && lastRandom.current && value === lastRandom.current) setRandomSelected(true);
    else setRandomSelected(false);
  }, [value]);

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="boldText" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.grid}>
        {showAuto && (
          <TouchableOpacity
            style={[
              styles.colorOption,
              styles.autoOption,
              { backgroundColor: themeColors.bg1, borderColor: themeColors.lightP1 },
              randomSelected && styles.colorSelected,
            ]}
            onPress={() => {
              const random = palette[Math.floor(Math.random() * palette.length)];
              lastRandom.current = random;
              setRandomSelected(true);
              onChange(random);
            }}
            accessibilityLabel="Random color"
          >
            {RandomIcon ? <RandomIcon size={ICON_SIZES.sm} color={themeColors.gray2} /> : null}
          </TouchableOpacity>
        )}
        {palette.map((color) => {
          const isSelected = value === color;
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color, borderColor: color },
                isSelected && styles.colorSelected,
              ]}
              onPress={() => {
                lastRandom.current = null;
                setRandomSelected(false);
                onChange(color);
              }}
            />
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
  },
  label: {
    marginBottom: -SPACING.sm,
    marginTop: SPACING.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    alignItems: "center",
  },
  colorOption: {
    width: SPACING.xlg,
    height: SPACING.xlg,
    borderRadius: SPACING.md,

    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.card,
  },
  autoOption: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.brightP1,
  },
  autoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  colorSelected: {
    borderWidth: 5,
    width: SPACING.xlg + SPACING.sm,
    height: SPACING.xlg + SPACING.sm,
  },
});
