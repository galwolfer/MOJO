/**
 * SubtaskScheduleCard
 *
 * An extended subtask card used in **edit mode** that combines the basic
 * subtask fields (title, description, estimated minutes) with per-subtask
 * scheduling via the shared ScheduleToggle component.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACING } from "../../../theme";
import Input from "../../../components/inputs/Input";
import { Subtask } from "./taskFormTypes";
import ScheduleToggle from "./ScheduleToggle";
import type { ScheduleToggleData } from "./ScheduleToggle";

interface Props {
  subtask: Subtask;
  index: number;
  onUpdate: (field: keyof Subtask, value: any) => void;
}

const SubtaskScheduleCard: React.FC<Props> = ({ subtask, index, onUpdate }) => {
  const scheduleData: ScheduleToggleData = {
    mode: subtask.scheduleMode ?? "auto",
    date: subtask.sessionDate ?? "",
    startTime: subtask.sessionStartTime ?? "",
    endTime: subtask.sessionEndTime ?? "",
  };

  // Map ScheduleToggle field changes back to Subtask field names
  const handleScheduleChange = (field: keyof ScheduleToggleData, value: string) => {
    const fieldMap: Record<keyof ScheduleToggleData, keyof Subtask> = {
      mode: "scheduleMode",
      date: "sessionDate",
      startTime: "sessionStartTime",
      endTime: "sessionEndTime",
    };
    onUpdate(fieldMap[field], value);
  };

  return (
    <View style={styles.card}>
      {/* ── Subtask fields ─────────────────────────────────────────────── */}
      <View style={styles.field}>
        <Input
          label={`Part Name ${index + 1}`}
          placeholder="e.g., Planning"
          value={subtask.title}
          onChangeText={(t) => onUpdate("title", t)}
          type="text"
        />
      </View>

      <View style={styles.field}>
        <Input
          label="Part Description"
          placeholder="Describe this part..."
          value={subtask.description}
          onChangeText={(t) => onUpdate("description", t)}
          type="longtext"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.field}>
        <Input
          label="Estimated Minutes"
          placeholder="e.g., 15"
          value={subtask.minutes}
          onChangeText={(t) => onUpdate("minutes", t)}
          type="number"
        />
      </View>

      {/* ── Schedule section (shared component) ────────────────────────── */}
      <ScheduleToggle schedule={scheduleData} onChange={handleScheduleChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
  },
  field: {
    marginBottom: SPACING.md,
    overflow: "visible",
  },
});

export default SubtaskScheduleCard;
