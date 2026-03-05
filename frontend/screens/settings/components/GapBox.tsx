import React from "react";
import { View, StyleSheet } from "react-native";
import Box from "../../../components/layout/Box";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import SliderComponent from "../../../components/inputs/Slider";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";

interface GapBoxProps {
  gapMinutes: number;
  saving: boolean;
  onChange: (newValue: number) => void;
  onSave: () => void;
}

export function GapBox({ gapMinutes, saving, onChange, onSave }: GapBoxProps) {
  return (
    <Box title="GAP BETWEEN TASKS" titleColor={COLORS.primary1} style={styles.box}>
      <AppText style={styles.helpText}>Minimum minutes of free time between two scheduled sessions.</AppText>

      <SliderComponent
        value={gapMinutes}
        onValueChange={onChange}
        min={0}
        max={120}
        step={5}
        label={`${gapMinutes} min`}
        style={{ marginVertical: SPACING.sm, width: "100%" }}
      />

      <AppButton
        title={saving ? "…" : "Save"}
        mode="filled"
        color="primary6"
        onPress={onSave}
        disabled={saving}
        style={[styles.saveBtn, { width: "100%" }]}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%" },
  helpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginBottom: SPACING.md,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  saveBtn: { width: "100%" },
});
