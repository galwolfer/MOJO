/**
 * TimeAndPartsSection
 *
 * Renders the "TIME & PARTS" box:
 *   - Estimated minutes input
 *   - Split-into-parts counter (+/− stepper)
 *   - Per-subtask cards (title, description, estimated minutes) when count ≥ 2
 *
 * All state lives in the parent. This component is purely presentational.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, SPACING } from "../../../theme";
import Input from "../../../components/inputs/Input";
import SliderComponent from "../../../components/inputs/Slider";
import Box from "../../../components/layout/Box";
import List, { ListCellProps } from "../../../components/layout/List";
import { Subtask } from "./taskFormTypes";
import SubtaskCard from "./SubtaskCard";

interface Props {
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];

  onEstimatedMinutesChange: (v: string) => void;
  onNumSubtasksChange: (v: number) => void;
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void;

  boxContentStyle?: object;
}

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

const TimeAndPartsSection: React.FC<Props> = ({
  estimatedMinutes,
  numSubtasks,
  subtasks,
  onEstimatedMinutesChange,
  onNumSubtasksChange,
  onSubtaskUpdate,
  boxContentStyle,
}) => {
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
          trackColor={COLORS.lightGray}
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

      {/* Estimated Minutes (only when not splitting) */}
      {numSubtasks === 1 && (
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

      {/* Subtask cards — only when ≥ 2 parts */}
      {numSubtasks >= 2 && <List data={toListData(subtasks, onSubtaskUpdate)} />}
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
