/**
 * CreateTask Screen
 *
 * A task creation form that lets users:
 * - Enter task name, description, and deadline
 * - Adjust effort and importance
 * - Select category and tags
 * - Split the task into subtasks
 *
 * Layout mirrors other screens (Settings, etc.):
 * header via NavigationContext + ScrollableContent.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../theme";
import AppButton from "../components/common/AppButton";
import AppText from "../components/common/AppText";
import PopupBox from "../components/common/PopupBox";
import ScrollableContent from "../components/layout/ScrollableContent";
import { ICONS } from "../components/icons/icons";
import { TaskDetailsSection, TimeAndPartsSection } from "../components/special/task";
import type { TaskFormState, Subtask } from "../components/special/task";
import { CATEGORY_KEYS } from "../config/categoryMeta";
import { createTask, suggestCategory, createTaskSchedule } from "../services/taskService";
import { useNavigation } from "../context/NavigationContext";
import { useTaskContext } from "../context/TaskContext";

// --- Default form state ---

const DEFAULT_FORM: TaskFormState = {
  taskName: "",
  timeToComplete: "",
  effort: 3,
  importance: 3,
  category: CATEGORY_KEYS[0] || "uncategorized",
  tags: [],
  description: "",
  estimatedMinutes: "",
  numSubtasks: 1,
  subtasks: [],
};

// --- Component ---

const CreateTask: React.FC = () => {
  const { setHeaderConfig, setActiveTab } = useNavigation();
  const { notifyTaskUpdate } = useTaskContext();

  const [formState, setFormState] = useState<TaskFormState>(DEFAULT_FORM);
  const [tagInput, setTagInput] = useState("");
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popupInfo, setPopupInfo] = useState<{
    title: string;
    message: string;
    resetOnClose?: boolean;
  } | null>(null);

  const categoryManuallyChanged = useRef(false);

  // Header
  const LeftIcon = ICONS.left;
  const PlusIcon = ICONS.plus;

  useEffect(() => {
    const handleBackPress = () => setActiveTab("calendar");

    setHeaderConfig({
      title: "Create Task",
      show: true,
      icon: ICONS.plus,
      leftElement: (
        <TouchableOpacity onPress={handleBackPress}>
          <LeftIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerRight}>{PlusIcon && <PlusIcon size={ICON_SIZES.md} color={COLORS.primary1} />}</View>
      ),
    });
  }, [setHeaderConfig, setActiveTab]);

  // Autofill category from task name
  useEffect(() => {
    if (!formState.taskName.trim()) return;
    categoryManuallyChanged.current = false;
    const id = setTimeout(async () => {
      try {
        const suggestion = await suggestCategory(formState.taskName);
        if (suggestion && !categoryManuallyChanged.current) {
          setFormState((prev) => ({
            ...prev,
            category: suggestion.category,
            tags: suggestion.subCategory ? [suggestion.subCategory] : [],
          }));
        }
      } catch {
        /* silent */
      }
    }, 800);
    return () => clearTimeout(id);
  }, [formState.taskName]);

  // Form handlers
  const handleTaskNameChange = useCallback((v: string) => setFormState((p) => ({ ...p, taskName: v })), []);
  const handleTimeToCompleteChange = useCallback((v: string) => setFormState((p) => ({ ...p, timeToComplete: v })), []);
  const handleDateSelect = useCallback((date: string) => {
    setFormState((p) => ({ ...p, timeToComplete: date }));
    setIsCalendarVisible(false);
  }, []);
  const handleEffortChange = useCallback((v: number) => setFormState((p) => ({ ...p, effort: v })), []);
  const handleImportanceChange = useCallback((v: number) => setFormState((p) => ({ ...p, importance: v })), []);
  const handleCategorySelect = useCallback((key: string) => {
    categoryManuallyChanged.current = true;
    setFormState((p) => ({ ...p, category: key }));
  }, []);
  const handleTagInputChange = useCallback((v: string) => setTagInput(v), []);
  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !formState.tags.includes(tagInput.trim())) {
      setFormState((p) => ({ ...p, tags: [...p.tags, tagInput.trim()] }));
      setTagInput("");
    }
  }, [tagInput, formState.tags]);
  const handleRemoveTag = useCallback(
    (tag: string) => setFormState((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) })),
    [],
  );
  const handleDescriptionChange = useCallback((v: string) => setFormState((p) => ({ ...p, description: v })), []);
  const handleEstimatedMinutesChange = useCallback(
    (v: string) => setFormState((p) => ({ ...p, estimatedMinutes: v })),
    [],
  );

  const handleNumSubtasksChange = useCallback(
    (value: number) => {
      const clamped = Math.min(10, Math.max(1, value));
      const existing = formState.subtasks;
      const next: Subtask[] = Array.from(
        { length: clamped },
        (_, i) =>
          existing[i] ?? { id: `subtask-${i}-${Date.now()}`, title: "", description: "", minutes: "", index: i + 1 },
      );
      setFormState((p) => ({ ...p, numSubtasks: clamped, subtasks: next }));
    },
    [formState.subtasks],
  );

  const handleSubtaskUpdate = useCallback((index: number, field: keyof Subtask, value: any) => {
    setFormState((p) => {
      const updated = [...p.subtasks];
      updated[index] = { ...updated[index], [field]: value };
      return { ...p, subtasks: updated };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormState(DEFAULT_FORM);
    setTagInput("");
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!formState.taskName.trim()) {
      setPopupInfo({ title: "Validation Error", message: "Please enter a task name" });
      return;
    }
    if (!formState.timeToComplete.trim()) {
      setPopupInfo({ title: "Validation Error", message: "Please select a date to complete" });
      return;
    }

    setIsLoading(true);
    try {
      const subtasksData = formState.subtasks
        .filter((st) => st.title.trim())
        .map((st) => ({
          title: st.title,
          description: st.description || undefined,
          minutes: st.minutes ? parseInt(st.minutes, 10) : undefined,
        }));

      let taskType: "perfect" | "in_parts" | "leaky" = "perfect";
      if (formState.numSubtasks > 1) {
        const mins = formState.subtasks.map((st) => (st.minutes ? parseInt(st.minutes, 10) : 0)).filter((m) => m > 0);
        taskType = mins.length >= 2 && !mins.every((m) => m === mins[0]) ? "leaky" : "in_parts";
      }

      const result = await createTask({
        taskname: formState.taskName,
        description: formState.description || undefined,
        category: formState.category,
        importance: formState.importance,
        effort: formState.effort,
        deadline: formState.timeToComplete,
        estimatedMinutes: formState.estimatedMinutes ? parseInt(formState.estimatedMinutes, 10) : undefined,
        tags: formState.tags.length > 0 ? formState.tags : undefined,
        subtasks: subtasksData.length > 0 ? subtasksData : undefined,
        taskType,
        chunkCount: formState.numSubtasks > 1 ? formState.numSubtasks : undefined,
      });

      if (result) {
        notifyTaskUpdate();
        await createTaskSchedule(result._id, { planningHorizonDays: 14 }).catch(() => {});
        setPopupInfo({ title: "Success", message: "Task created successfully.", resetOnClose: true });
      } else {
        setPopupInfo({ title: "Error", message: "Failed to create task. Please try again." });
      }
    } catch (error) {
      setPopupInfo({
        title: "Error",
        message: `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [formState, notifyTaskUpdate]);

  const closePopup = useCallback(() => {
    if (popupInfo?.resetOnClose) resetForm();
    setPopupInfo(null);
  }, [popupInfo, resetForm]);

  return (
    <ScrollableContent
      respectHeader
      respectNavBar
      extraTopPadding={SPACING.lg}
      scrollKey="create-task"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      <TaskDetailsSection
        taskName={formState.taskName}
        timeToComplete={formState.timeToComplete}
        effort={formState.effort}
        importance={formState.importance}
        category={formState.category}
        tags={formState.tags}
        description={formState.description}
        tagInput={tagInput}
        isCalendarVisible={isCalendarVisible}
        onTaskNameChange={handleTaskNameChange}
        onTimeToCompleteChange={handleTimeToCompleteChange}
        onDateSelect={handleDateSelect}
        onCalendarToggle={() => setIsCalendarVisible((v) => !v)}
        onEffortChange={handleEffortChange}
        onImportanceChange={handleImportanceChange}
        onCategorySelect={handleCategorySelect}
        onTagInputChange={handleTagInputChange}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onDescriptionChange={handleDescriptionChange}
      />

      <TimeAndPartsSection
        estimatedMinutes={formState.estimatedMinutes}
        numSubtasks={formState.numSubtasks}
        subtasks={formState.subtasks}
        onEstimatedMinutesChange={handleEstimatedMinutesChange}
        onNumSubtasksChange={handleNumSubtasksChange}
        onSubtaskUpdate={handleSubtaskUpdate}
      />

      <View style={styles.buttonContainer}>
        <AppButton
          title={isLoading ? "CREATING..." : "CREATE TASK"}
          onPress={handleCreateTask}
          mode="filled"
          color={COLORS.primary6}
          icon={isLoading ? undefined : "plus"}
          iconPosition="right"
          width="100%"
          disabled={isLoading}
        />
      </View>

      <PopupBox visible={!!popupInfo} onClose={closePopup} title={popupInfo?.title ?? ""} titleColor={COLORS.primary1}>
        <AppText style={styles.popupMessage}>{popupInfo?.message}</AppText>
        <AppButton title="OK" mode="filled" color="primary1" onPress={closePopup} width="100%" />
      </PopupBox>
    </ScrollableContent>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    gap: SPACING.lg,
    paddingBottom: SPACING.xlg * 6,
  },
  headerRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  popupMessage: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
  },
});

export default CreateTask;
