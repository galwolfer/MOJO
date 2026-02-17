import React from "react";
import { ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING } from "../../theme";

type FilterChipsProps = {
  filters: string[];
  selected?: string;
  onChange: (filter: string) => void;
  style?: any;
};

export default function FilterChips({ filters, selected, onChange, style }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.container}
    >
      {filters.map((f) => {
        const isActive = selected === f;
        return (
          <TouchableOpacity key={f} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onChange(f)}>
            <AppText style={{ color: isActive ? COLORS.white : COLORS.darkGray }}>{f}</AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.brightP1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary1,
    borderColor: COLORS.primary1,
  },
});
