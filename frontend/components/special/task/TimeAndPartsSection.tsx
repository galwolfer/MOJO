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
import { View, StyleSheet, Pressable } from "react-native";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../../theme";
import AppText from "../../common/AppText";
import Input from "../../inputs/Input";
import SliderComponent from "../../inputs/Slider";
import Box from "../../layout/Box";
import { Subtask } from "../../../screens/createEditTasks/components/taskFormTypes";

interface Props {
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];

  onEstimatedMinutesChange: (v: string) => void;
  onNumSubtasksChange: (v: number) => void;
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void;

  boxContentStyle?: object;
}

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
      {numSubtasks >= 2 && (
        <View style={styles.subtasksSection}>
          {subtasks.map((subtask, index) => (
            <View key={subtask.id} style={styles.subtaskCard}>
              <AppText style={styles.subtaskHeader}>Part {index + 1}</AppText>

              <View style={styles.formField}>
                <Input
                  label="Part Name"
                  placeholder="e.g., Planning"
                  value={subtask.title}
                  onChangeText={(t) => onSubtaskUpdate(index, "title", t)}
                  type="text"
                />
              </View>

              <View style={styles.formField}>
                <Input
                  label="Part Description"
                  placeholder="Describe this part..."
                  value={subtask.description}
                  onChangeText={(t) => onSubtaskUpdate(index, "description", t)}
                  type="longtext"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formField}>
                <Input
                  label="Estimated Minutes"
                  placeholder="e.g., 15"
                  value={subtask.minutes}
                  onChangeText={(t) => onSubtaskUpdate(index, "minutes", t)}
                  type="number"
                />
              </View>
            </View>
          ))}
        </View>
      )}
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
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  subtasksSection: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  subtaskCard: {
    backgroundColor: COLORS.white2,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary1,
  },
  subtaskHeader: {
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    color: COLORS.primary1,
    marginBottom: SPACING.md,
  },
});

export default TimeAndPartsSection;
