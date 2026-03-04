/**
 * CreateTask Screen
 *
 * A task creation form that lets users:
 * - Enter task name, description, and deadline
 * - Adjust effort and importance
 * - Select category and subcategory
 * - Split the task into subtasks
 *
 * Layout mirrors other screens (Settings, etc.):
 * header via NavigationContext + ScrollableContent.
 */

import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import AppButton from "../../components/common/AppButton";
import AppText from "../../components/common/AppText";
import ErrorBanner from "../../components/common/ErrorBanner";
import PopupBox from "../../components/common/PopupBox";
import ScrollableContent from "../../components/layout/ScrollableContent";
import { ICONS } from "../../components/icons/icons";
import { TaskDetailsSection, TimeAndPartsSection } from "../../components/special/task";
import type { TaskFormState, Subtask } from "../../components/special/task";
import { CATEGORY_KEYS } from "../../config/categoryMeta";
import { createTask, createTaskSchedule } from "../../services/taskService";
import { fetchSubcategoriesForCategory, type Subcategory } from "../../services/subcategoryService";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";

// --- Default form state ---

const DEFAULT_FORM: TaskFormState = {
  taskName: "",
  timeToComplete: "",
  effort: 3,
  importance: 3,
  category: CATEGORY_KEYS[0] || "uncategorized",
  subCategoryId: null,
  description: "",
  estimatedMinutes: "",
  numSubtasks: 1,
  subtasks: [],
};

// --- Component ---

const CreateTask: React.FC = () => {
  const { setHeaderConfig, setActiveTab } = useNavigation();
  const { notifyTaskUpdate } = useTaskContext();
  const colors = useColors();

  const [formState, setFormState] = useState<TaskFormState>(DEFAULT_FORM);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popupInfo, setPopupInfo] = useState<{
    title: string;
    message: string;
    resetOnClose?: boolean;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

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

  // Load subcategories when category changes
  useEffect(() => {
    if (!formState.category) return;
    let cancelled = false;
    fetchSubcategoriesForCategory(formState.category)
      .then((subs) => {
        if (!cancelled) {
          setSubcategories(subs);
          // Keep current selection if still valid; otherwise auto-select the first ("General [Category]")
          setFormState((prev) => {
            const stillValid = subs.some((s) => s.id === prev.subCategoryId);
            return stillValid ? prev : { ...prev, subCategoryId: subs[0]?.id ?? null };
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSubcategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formState.category]);

  // Form handlers
  const handleTaskNameChange = useCallback((v: string) => {
    setFormState((p) => ({ ...p, taskName: v }));
    setFormErrors([]);
  }, []);
  const handleTimeToCompleteChange = useCallback((v: string) => {
    setFormState((p) => ({ ...p, timeToComplete: v }));
    setFormErrors([]);
  }, []);
  const handleDateSelect = useCallback((date: string) => {
    setFormState((p) => ({ ...p, timeToComplete: date }));
    setIsCalendarVisible(false);
    setFormErrors([]);
  }, []);
  const handleEffortChange = useCallback((v: number) => setFormState((p) => ({ ...p, effort: v })), []);
  const handleImportanceChange = useCallback((v: number) => setFormState((p) => ({ ...p, importance: v })), []);
  const handleCategorySelect = useCallback((key: string) => {
    setFormState((p) => ({ ...p, category: key, subCategoryId: null }));
  }, []);
  const handleSubCategorySelect = useCallback((id: string | null) => {
    setFormState((p) => ({ ...p, subCategoryId: id }));
  }, []);
  const handleSubcategoryCreated = useCallback(
    (newSub: Subcategory) => {
      // append and reload if necessary
      setSubcategories((prev) => [...prev, newSub]);
      if (formState.category) {
        fetchSubcategoriesForCategory(formState.category).then(setSubcategories);
      }
    },
    [formState.category],
  );
  const handleDescriptionChange = useCallback((v: string) => setFormState((p) => ({ ...p, description: v })), []);
  // Only allow numeric input for estimated minutes
  const handleEstimatedMinutesChange = useCallback((v: string) => {
    const numericOnly = v.replace(/[^0-9]/g, "");
    setFormState((p) => ({ ...p, estimatedMinutes: numericOnly }));
    // Clear errors when user starts correcting
    setFormErrors([]);
  }, []);

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
    // For minutes field, only allow numeric input
    const processedValue = field === "minutes" ? String(value).replace(/[^0-9]/g, "") : value;
    setFormState((p) => {
      const updated = [...p.subtasks];
      updated[index] = { ...updated[index], [field]: processedValue };
      return { ...p, subtasks: updated };
    });
    // Clear errors when user starts correcting
    setFormErrors([]);
  }, []);

  const resetForm = useCallback(() => {
    setFormState(DEFAULT_FORM);
    setSubcategories([]);
    setFormErrors([]);
  }, []);

  // Validation function
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    // Task name required
    if (!formState.taskName.trim()) {
      errors.push("Task name is required");
    }

    // Due date required
    if (!formState.timeToComplete.trim()) {
      errors.push("Due date is required");
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formState.timeToComplete)) {
        errors.push("Invalid date format (expected YYYY-MM-DD)");
      } else {
        const selectedDate = new Date(formState.timeToComplete);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errors.push("Due date cannot be in the past");
        }
      }
    }

    // Validate estimated minutes (when single task)
    if (formState.numSubtasks === 1 && formState.estimatedMinutes) {
      const mins = parseInt(formState.estimatedMinutes, 10);
      if (isNaN(mins) || mins <= 0) {
        errors.push("Estimated minutes must be a positive number");
      } else if (mins > 1440) {
        errors.push("Estimated minutes cannot exceed 1440 (24 hours)");
      }
    }

    // Validate subtasks (when split into parts)
    if (formState.numSubtasks >= 2) {
      const hasAtLeastOneTitle = formState.subtasks.some((st) => st.title.trim());
      if (!hasAtLeastOneTitle) {
        errors.push("At least one part must have a name");
      }

      // Validate each subtask's minutes if provided
      formState.subtasks.forEach((st, idx) => {
        if (st.minutes) {
          const mins = parseInt(st.minutes, 10);
          if (isNaN(mins) || mins <= 0) {
            errors.push(`Part ${idx + 1}: minutes must be a positive number`);
          } else if (mins > 1440) {
            errors.push(`Part ${idx + 1}: minutes cannot exceed 1440 (24 hours)`);
          }
        }
      });
    }

    return errors;
  }, [formState]);

  const handleCreateTask = useCallback(async () => {
    // Run validation
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);

    setIsLoading(true);
    try {
      const subtasksData = formState.subtasks
        .map((st) => ({
          title: st.title,
          description: st.description || undefined,
          minutes: st.minutes ? parseInt(st.minutes, 10) : undefined,
        }));

      let taskType: "perfect" | "in_parts" | "leaky" = "perfect";
      if (formState.numSubtasks > 1) {
        const mins = formState.subtasks
          .map((st) => (st.minutes ? parseInt(st.minutes, 10) : 0))
          .filter((m) => m > 0);
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
        subcategoryId: formState.subCategoryId ?? undefined,
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
  }, [formState, notifyTaskUpdate, validateForm]);

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
      {/* Error banner at top */}
      <ErrorBanner message={formErrors.join("\n")} />

      <TaskDetailsSection
        taskName={formState.taskName}
        timeToComplete={formState.timeToComplete}
        effort={formState.effort}
        importance={formState.importance}
        category={formState.category}
        subCategoryId={formState.subCategoryId}
        subcategories={subcategories}
        description={formState.description}
        isCalendarVisible={isCalendarVisible}
        onTaskNameChange={handleTaskNameChange}
        onTimeToCompleteChange={handleTimeToCompleteChange}
        onDateSelect={handleDateSelect}
        onCalendarToggle={() => setIsCalendarVisible((v) => !v)}
        onEffortChange={handleEffortChange}
        onImportanceChange={handleImportanceChange}
        onCategorySelect={handleCategorySelect}
        onSubCategorySelect={handleSubCategorySelect}
        onSubcategoryCreated={handleSubcategoryCreated}
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

      {/* Error banner below button */}
      <ErrorBanner message={formErrors.join("\n")} />

      <PopupBox visible={!!popupInfo} onClose={closePopup} title={popupInfo?.title ?? ""} titleColor={COLORS.primary1}>
        <AppText style={[styles.popupMessage, { color: colors.gray2 }]}>{popupInfo?.message}</AppText>
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
