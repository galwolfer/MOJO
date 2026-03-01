import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import { SPACING } from "../../../theme";
import { Subtask } from "./taskFormTypes";
import ScheduleToggle, { ScheduleToggleData } from "./ScheduleToggle";

interface Props {
  subtask: Subtask;
  index: number;
  onUpdate: (field: keyof Subtask, value: any) => void;
}

const SubtaskScheduleCard: React.FC<Props> = ({ subtask, index, onUpdate }) => {
  const scheduleData: ScheduleToggleData = {
    mode: "auto",
    date: "",
    startTime: "",
    endTime: "",
  };

  const handleScheduleChange = (field: keyof ScheduleToggleData, value: string) => {
    // no-op stub
  };

  return (
    <View style={styles.card}>
      <AppText>Subtask {index + 1}</AppText>
      <ScheduleToggle schedule={scheduleData} onChange={handleScheduleChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
  },
});

export default SubtaskScheduleCard;
