import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { Checkbox } from "../../../components/icons/Checkbox";
import { ICON_SIZES, SPACING } from "../../../theme";

interface SubtaskItemProps {
  subtask: { id: string; title?: string };
  parentTaskId: string;
  isCompleted: boolean;
  categoryColor?: string;
  showTime?: boolean;
  onToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
  onDelete?: (taskId: string, subtaskId: string) => void;
}

const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  parentTaskId,
  isCompleted,
  categoryColor,
  showTime,
  onToggle,
  onDelete,
}) => {
  const handleToggle = () => {
    onToggle(parentTaskId, subtask.id, !isCompleted);
  };

  return (
    <View style={styles.container}>
      <Checkbox checked={isCompleted} onChange={handleToggle} size={ICON_SIZES.sm} />
      <AppText style={styles.label}>{subtask.title || ""}</AppText>
      {onDelete ? (
        <TouchableOpacity onPress={() => onDelete(parentTaskId, subtask.id)}>
          <AppText style={styles.delete}>×</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  label: {
    flex: 1,
  },
  delete: {
    color: "red",
    padding: SPACING.xs,
  },
});

export default SubtaskItem;
