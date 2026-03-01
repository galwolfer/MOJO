import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import { SPACING } from "../../../theme";

export interface ScheduleToggleData {
  mode: "auto" | "manual";
  date?: string;
  startTime?: string;
  endTime?: string;
}

interface Props {
  schedule: ScheduleToggleData;
  onChange: (field: keyof ScheduleToggleData, value: string) => void;
}

export default function ScheduleToggle({ schedule, onChange }: Props) {
  // minimal placeholder: render current mode and allow toggling
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => onChange("mode", schedule.mode === "auto" ? "manual" : "auto")}>
        <AppText>{schedule.mode === "auto" ? "Automatic" : "Manual"}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
});
