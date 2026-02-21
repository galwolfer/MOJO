/**
 * AdditionalDetailsSection
 *
 * Renders the "ADDITIONAL DETAILS" box:
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
import Box from "../../layout/Box";
import { Subtask } from "./taskFormTypes";

interface Props {
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];

  onEstimatedMinutesChange: (v: string) => void;
  onNumSubtasksChange: (v: number) => void;
  onSubtaskUpdate: (index: number, field: keyof Subtask, value: any) => void;

  boxContentStyle?: object;
}

const AdditionalDetailsSection: React.FC<Props> = ({
  estimatedMinutes,
  numSubtasks,
  subtasks,
  onEstimatedMinutesChange,
  onNumSubtasksChange,
  onSubtaskUpdate,
  boxContentStyle,
}) => {
  return (
    <Box title="ADDITIONAL DETAILS" style={[styles.boxContent, boxContentStyle]}>
      {/* Estimated Minutes */}
      <View style={styles.formField}>
        <AppText style={styles.label}>Estimated Minutes</AppText>
        <Input
          placeholder="e.g., 30"
          value={estimatedMinutes}
          onChangeText={onEstimatedMinutesChange}
          type="number"
        />
      </View>

      {/* Split task counter */}
      <View style={styles.formField}>
        <AppText style={styles.label}>Split Task Into Parts</AppText>
        <View style={styles.subtaskCounterContainer}>
          <Pressable
            style={styles.counterButton}
            onPress={() => onNumSubtasksChange(Math.max(1, numSubtasks - 1))}
          >
            <AppText style={styles.counterButtonText}>−</AppText>
          </Pressable>

          <View style={styles.counterDisplay}>
            <AppText style={styles.counterText}>{numSubtasks}</AppText>
          </View>

          <Pressable
            style={styles.counterButton}
            onPress={() => onNumSubtasksChange(numSubtasks + 1)}
          >
            <AppText style={styles.counterButtonText}>+</AppText>
          </Pressable>
        </View>
      </View>

      {/* Subtask cards — only when ≥ 2 parts */}
      {numSubtasks >= 2 && (
        <View style={styles.subtasksSection}>
          <AppText style={[styles.label, { marginBottom: SPACING.md }]}>Define Subtasks</AppText>
          {subtasks.map((subtask, index) => (
            <View key={subtask.id} style={styles.subtaskCard}>
              <AppText style={styles.subtaskHeader}>Part {index + 1}</AppText>

              <View style={styles.formField}>
                <AppText style={styles.label}>Part Name</AppText>
                <Input
                  placeholder="e.g., Planning"
                  value={subtask.title}
                  onChangeText={(t) => onSubtaskUpdate(index, "title", t)}
                  type="text"
                />
              </View>

              <View style={styles.formField}>
                <AppText style={styles.label}>Part Description</AppText>
                <Input
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
  subtaskCounterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  counterDisplay: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    alignItems: "center",
    ...SHADOWS.card,
  },
  counterText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.primary1,
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

export default AdditionalDetailsSection;
