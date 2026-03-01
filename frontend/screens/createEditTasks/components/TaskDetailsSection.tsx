import React from "react";
import { View } from "react-native";

interface Props {
  taskName: string;
  timeToComplete: string;
  effort: number;
  importance: number;
  category: string;
  subCategoryId: string | null;
  subcategories: any[];
  description: string;
  isCalendarVisible: boolean;
  onTaskNameChange: (v: string) => void;
  onTimeToCompleteChange: (v: string) => void;
  onDateSelect: (date: string) => void;
  onCalendarToggle: () => void;
  onEffortChange: (v: number) => void;
  onImportanceChange: (v: number) => void;
  onCategorySelect: (v: string) => void;
  onSubCategorySelect: (id: string | null) => void;
  onSubcategoryCreated?: (newSub: any) => void;
  onDescriptionChange: (v: string) => void;
}

export const TaskDetailsSection: React.FC<Props> = (props) => {
  // stub implementation
  return <View />;
};

export default TaskDetailsSection;
