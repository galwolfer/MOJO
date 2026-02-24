/**
 * TaskDetailsSection
 *
 * Renders the "TASK DETAILS" box used in both EditTask and (optionally) CreateTask:
 *   - Task name input
 *   - Due date picker (inline CalendarPicker dropdown)
 *   - Effort + Importance sliders (side-by-side)
 *   - Category picker
 *   - Tags editor + TagsBelow chip list
 *   - Description textarea
 *
 * All state lives in the parent; this component is purely presentational + layout.
 */

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../../theme";
import AppText from "../../common/AppText";
import Input from "../../inputs/Input";
import SliderComponent from "../../inputs/Slider";
import CalendarPicker from "../../inputs/CalendarPicker";
import TagsBelow from "../../inputs/TagsBelow";
import Box from "../../layout/Box";
import { ICONS } from "../../icons/icons";
import CategoryPicker from "../CategoryPicker";
import { getImportanceColor } from "../../widgets/taskHelpers";

interface Props {
  // values
  taskName: string;
  timeToComplete: string;
  effort: number;
  importance: number;
  category: string;
  tags: string[];
  description: string;
  tagInput: string;
  isCalendarVisible: boolean;

  // callbacks
  onTaskNameChange: (v: string) => void;
  onTimeToCompleteChange: (v: string) => void;
  onDateSelect: (date: string) => void;
  onCalendarToggle: () => void;
  onEffortChange: (v: number) => void;
  onImportanceChange: (v: number) => void;
  onCategorySelect: (key: string) => void;
  onTagInputChange: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onDescriptionChange: (v: string) => void;

  /** Optional extra style applied to the inner box content wrapper */
  boxContentStyle?: object;
}

const TaskDetailsSection: React.FC<Props> = ({
  taskName,
  timeToComplete,
  effort,
  importance,
  category,
  tags,
  description,
  tagInput,
  isCalendarVisible,
  onTaskNameChange,
  onTimeToCompleteChange,
  onDateSelect,
  onCalendarToggle,
  onEffortChange,
  onImportanceChange,
  onCategorySelect,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onDescriptionChange,
  boxContentStyle,
}) => {
  return (
    <Box title="TASK DETAILS" style={[styles.boxContent, boxContentStyle]}>
      {/* Task Name */}
      <View style={styles.formField}>
        <Input label="Task Name" placeholder="Your Task" value={taskName} onChangeText={onTaskNameChange} type="text" />
      </View>

      {/* Due Date / Time to Complete */}
      <View style={styles.formField}>
        <View style={styles.timeToCompleteWrapper}>
          <Input
            label="Time to Complete"
            placeholder="YYYY-MM-DD"
            value={timeToComplete}
            onChangeText={onTimeToCompleteChange}
            type="text"
            editable={false}
            onPress={onCalendarToggle}
            rightElement={
              ICONS.calendar ? React.createElement(ICONS.calendar, { size: 24, color: COLORS.primary1 }) : null
            }
          />

          {isCalendarVisible && (
            <View style={styles.inlineCalendarContainer}>
              <CalendarPicker
                onDateSelect={(d: string) => {
                  onDateSelect(d);
                }}
                selectedDate={timeToComplete}
              />
            </View>
          )}
        </View>
      </View>

      {/* Effort + Importance sliders */}
      <View style={styles.slidersContainer}>
        <View style={[styles.sliderWrapper, { flex: 1, marginRight: SPACING.md }]}>
          <SliderComponent
            value={effort}
            onValueChange={onEffortChange}
            min={1}
            max={5}
            step={1}
            label="Effort"
            trackColor={COLORS.lightGray}
            TrackThumbColor={getImportanceColor(effort)}
            valueDescriptions={{ 1: "Very Easy", 2: "Easy", 3: "Moderate", 4: "Hard", 5: "Very Hard" }}
          />
        </View>
        <View style={[styles.sliderWrapper, { flex: 1 }]}>
          <SliderComponent
            value={importance}
            onValueChange={onImportanceChange}
            min={1}
            max={5}
            step={1}
            label="Importance"
            trackColor={COLORS.lightGray}
            TrackThumbColor={getImportanceColor(importance)}
            valueDescriptions={{ 1: "Low", 2: "Below Avg", 3: "Average", 4: "Above Avg", 5: "Critical" }}
          />
        </View>
      </View>

      {/* Category */}
      <View style={styles.formField}>
        <CategoryPicker label="Task Category" value={category as any} onChange={onCategorySelect} />
      </View>

      {/* Tags */}
      <View style={styles.formField}>
        <Input
          label="Task Tags"
          placeholder="Add a tag"
          value={tagInput}
          onChangeText={onTagInputChange}
          type="text"
          rightElement={
            <Pressable onPress={onAddTag}>
              <AppText variant="title3" style={styles.addTagButtonText}>
                +
              </AppText>
            </Pressable>
          }
        />
        <TagsBelow selected={tags} onRemove={onRemoveTag} />
      </View>

      {/* Description */}
      <View style={styles.formField}>
        <Input
          label="Task Description"
          placeholder="Your Task"
          value={description}
          onChangeText={onDescriptionChange}
          type="longtext"
          multiline
          numberOfLines={6}
        />
      </View>
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
  slidersContainer: {
    flexDirection: "row",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sliderWrapper: {
    gap: SPACING.sm,
  },
  timeToCompleteWrapper: {
    overflow: "visible",
  },
  inlineCalendarContainer: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  addTagButtonText: {
    color: COLORS.primary1,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
});

export default TaskDetailsSection;
