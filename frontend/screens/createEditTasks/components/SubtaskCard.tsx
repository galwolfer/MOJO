/**
 * SubtaskCard
 *
 * A single subtask card showing Part N header and fields for title,
 * description, and estimated minutes.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACING } from "../../../theme";
import Input from "../../../components/inputs/Input";
import { Subtask } from "./taskFormTypes";

interface Props {
  subtask: Subtask;
  index: number;
  onUpdate: (field: keyof Subtask, value: any) => void;
}

const SubtaskCard: React.FC<Props> = ({ subtask, index, onUpdate }) => {
  return (
    <View style={styles.subtaskCard}>
      <View style={styles.formField}>
        <Input
          label={`Part Name ${index + 1}`}
          placeholder="e.g., Planning"
          value={subtask.title}
          onChangeText={(t) => onUpdate("title", t)}
          type="text"
        />
      </View>

      <View style={styles.formField}>
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

      <View style={styles.formField}>
        <Input
          label="Estimated Minutes"
          placeholder="e.g., 15"
          value={subtask.minutes}
          onChangeText={(t) => onUpdate("minutes", t)}
          type="number"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  subtaskCard: {
    padding: SPACING.md,
  },

  formField: {
    marginBottom: SPACING.md,
    overflow: "visible",
  },
});

export default SubtaskCard;
