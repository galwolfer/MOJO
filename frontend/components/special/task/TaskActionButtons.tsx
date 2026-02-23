/**
 * TaskActionButtons
 *
 * Renders the bottom action area of EditTask:
 *   - Primary "UPDATE TASK" CTA (full width, green)
 *   - Secondary row: "Discard Changes" + "DELETE TASK" (side by side)
 *
 * All actions are delegated to the parent via callbacks.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACING } from "../../../theme";
import AppButton from "../../common/AppButton";

interface Props {
  onUpdate: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}

const TaskActionButtons: React.FC<Props> = ({ onUpdate, onDiscard, onDelete, isUpdating }) => {
  return (
    <>
      <View style={styles.buttonContainer}>
        <AppButton
          title={isUpdating ? "UPDATING..." : "UPDATE TASK"}
          onPress={onUpdate}
          mode="filled"
          color="#2ecc71"
          icon={isUpdating ? undefined : "check"}
          iconPosition="right"
          width="100%"
          disabled={isUpdating}
        />
      </View>

      <View style={styles.actionRow}>
        <AppButton
          title="Discard Changes"
          onPress={onDiscard}
          mode="filled"
          color="lightGray"
          width="48%"
        />
        <AppButton
          title="DELETE TASK"
          onPress={onDelete}
          mode="filled"
          color="primary7"
          width="48%"
          disabled={isUpdating}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
  },
  actionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
});

export default TaskActionButtons;
