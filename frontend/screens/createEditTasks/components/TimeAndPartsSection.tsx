/**
 * TimeAndPartsSection
 *
 * Renders the "TIME & PARTS" box:
 *   - Estimated minutes input
 *   - Split-into-parts counter (+/− stepper)
 *   - Per-subtask cards (title, description, estimated minutes) when count ≥ 2
 *
 * When `editMode` is true (used by EditTask):
 *   - Each subtask card is replaced by SubtaskScheduleCard which adds an
 *     Auto / Manual toggle and inline session time fields.
 *   - For single-task mode (numSubtasks === 1) an inline schedule section
 *     appears below the estimated minutes input.
 *
 * All state lives in the parent. This component is purely presentational.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import Input from "../../../components/inputs/Input";
import SliderComponent from "../../../components/inputs/Slider";
import Box from "../../../components/layout/Box";
import List, { ListCellProps } from "../../../components/layout/List";
import { Subtask } from "./taskFormTypes";
import SubtaskCard from "./SubtaskCard";
import SubtaskScheduleCard from "./SubtaskScheduleCard";
import ScheduleToggle from "./ScheduleToggle";
import type { ScheduleToggleData } from "./ScheduleToggle";

/** Schedule state for single-task mode in edit */
export interface SingleTaskSchedule {
  mode: "auto" | "manual";
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface Props {
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];

  onEstimatedMinutesChange: (v: string) => void;
  onNumSubtasksChange: (v: number) => void;
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void;

  boxContentStyle?: object;

  // ── Edit-mode props (optional – only passed from EditTask) ────────────
  /** When true, subtask cards include schedule controls */
  editMode?: boolean;
  /** Schedule state for single-task (numSubtasks === 1) edit mode */
  singleTaskSchedule?: SingleTaskSchedule;
  /** Called when a single-task schedule field changes */
  onSingleTaskScheduleChange?: (field: keyof SingleTaskSchedule, value: any) => void;
}

/* ── List‑data mapper (create mode – no schedule) ─────────────────────── */
const toListData = (
  subtasks: Subtask[],
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void,
): ListCellProps[] =>
  subtasks.map((subtask, index) => ({
    id: subtask.id,
    content: (
      <SubtaskCard subtask={subtask} index={index} onUpdate={(field, value) => onSubtaskUpdate(index, field, value)} />
    ),
  }));

/* ── List‑data mapper (edit mode – with schedule) ─────────────────────── */
const toScheduleListData = (
  subtasks: Subtask[],
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void,
): ListCellProps[] =>
  subtasks.map((subtask, index) => ({
    id: subtask.id,
    content: (
      <SubtaskScheduleCard
        subtask={subtask}
        index={index}
        onUpdate={(field, value) => onSubtaskUpdate(index, field, value)}
      />
    ),
  }));

/* ── Main component ───────────────────────────────────────────────────── */
const TimeAndPartsSection: React.FC<Props> = ({
  estimatedMinutes,
  numSubtasks,
  subtasks,
  onEstimatedMinutesChange,
  onNumSubtasksChange,
  onSubtaskUpdate,
  boxContentStyle,
  editMode = false,
  singleTaskSchedule,
  onSingleTaskScheduleChange,
}) => {
  const colors = useColors();

  return (
    <Box title="TIME & PARTS" style={[styles.boxContent, boxContentStyle]}>
      {/* Split task counter slider */}
      <View style={styles.formField}>
        <SliderComponent
          label="Split into Parts"
          value={numSubtasks}
          onValueChange={onNumSubtasksChange}
          min={1}
          max={10}
          step={1}
          trackColor={colors.gray1}
          TrackThumbColor={COLORS.primary1}
          valueDescriptions={{
            1: "Single Task",
            2: "2 Parts",
            3: "3 Parts",
            4: "4 Parts",
            5: "5 Parts",
            6: "6 Parts",
            7: "7 Parts",
            8: "8 Parts",
            9: "9 Parts",
            10: "10 Parts",
          }}
        />
      </View>

      {/* Estimated Minutes (only when not splitting; hidden in manual-schedule edit mode) */}
      {numSubtasks === 1 && (!editMode || singleTaskSchedule?.mode !== "manual") && (
        <View style={styles.formField}>
          <Input
            label="Estimated Minutes"
            placeholder="e.g., 30"
            value={estimatedMinutes}
            onChangeText={onEstimatedMinutesChange}
            type="number"
          />
        </View>
      )}

      {/* Single-task schedule (edit mode only) */}
      {editMode && numSubtasks === 1 && singleTaskSchedule && onSingleTaskScheduleChange && (
        <ScheduleToggle
          schedule={{
            mode: singleTaskSchedule.mode,
            date: singleTaskSchedule.date,
            startTime: singleTaskSchedule.startTime,
            endTime: singleTaskSchedule.endTime,
          }}
          onChange={(field, value) => onSingleTaskScheduleChange(field as keyof SingleTaskSchedule, value)}
        />
      )}

      {/* Subtask cards — only when ≥ 2 parts */}
      {numSubtasks >= 2 &&
        (editMode ? (
          <List data={toScheduleListData(subtasks, onSubtaskUpdate)} />
        ) : (
          <List data={toListData(subtasks, onSubtaskUpdate)} />
        ))}
    </Box>
  );
};

const styles = StyleSheet.create({
  boxContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    overflow: "visible",
  },
  formField: {
    marginBottom: SPACING.md,
    overflow: "visible",
  },
  label: {
    fontWeight: "400",
    marginBottom: 4,
  },
});

export default TimeAndPartsSection;
