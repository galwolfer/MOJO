/**
 * EditTask Screen
 *
 * A task editing form that mirrors CreateTask's layout and behavior.
 * Uses the same shared components (TaskDetailsSection, TimeAndPartsSection,
 * ErrorBanner) via ScrollableContent for consistent look & feel.
 *
 * Schedule editing is **merged into the subtask cards** so each subtask
 * (or the single-task) can be toggled between Auto / Manual scheduling.
 * Manual subtasks show inline date + start/end time fields; Auto subtasks
 * are handled by the scheduler on save.
 *
 * Additionally includes:
 *   - TaskActionButtons  (UPDATE / Discard / DELETE)
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import { COLORS, SPACING, FONT_SIZES, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";

// ── Common components ─────────────────────────────────────────────────────────
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import ErrorBanner from "../../components/common/ErrorBanner";
import PopupBox from "../../components/common/PopupBox";
import ScrollableContent from "../../components/layout/ScrollableContent";

// ── Shared task-form section components ───────────────────────────────────────
import { TaskDetailsSection, TimeAndPartsSection } from "../../components/special/task";
import { toLocalDateStr, toLocalTimeStr } from "../../components/special/task/TaskScheduleEditor";
import type { TaskFormState, Subtask, EditableSession } from "../../components/special/task";
import type { SingleTaskSchedule } from "./components/TimeAndPartsSection";

// ── Icons and context ─────────────────────────────────────────────────────────
import { ICONS } from "../../components/icons/icons";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";

// ── Services ──────────────────────────────────────────────────────────────────
import {
  getTaskById,
  updateTask,
  deleteTask,
  getTaskSessions,
  updateTaskSchedule,
  createTaskSchedule,
} from "../../services/taskService";
import { fetchSubcategoriesForCategory, type Subcategory } from "../../services/subcategoryService";
import { combineLocalDateTime, combineEndDateTime, validateEditableSessions } from "../../components/special/task/TaskScheduleEditor";
import type { BusyBlock } from "../../services/busyBlockService";
import BusyBlockPreviewCard from "../../components/special/BusyBlockPreviewCard";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const EditTask: React.FC<{ taskId?: string }> = ({ taskId = "" }) => {
  const { setHeaderConfig, setActiveTab, setActiveTabWithParams } = useNavigation();
  const { notifyTaskUpdate } = useTaskContext();
  const colors = useColors();

  // ── Form state ────────────────────────────────────────────────────────────
  const [formState, setFormState] = useState<TaskFormState>({
    taskName: "",
    timeToComplete: "",
    effort: 3,
    importance: 3,
    category: "",
    subCategoryId: null,
    description: "",
    estimatedMinutes: "",
    numSubtasks: 1,
    subtasks: [],
  });

  // ── Snapshot of the original task data for rollback on scheduling failure ──
  const originalTaskRef = useRef<any>(null);

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);;
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  // ── Single-task schedule (numSubtasks === 1) ──────────────────────────────
  const [singleTaskSchedule, setSingleTaskSchedule] = useState<SingleTaskSchedule>({
    mode: "auto",
    date: "",
    startTime: "",
    endTime: "",
  });

  // ── UI / loading state ────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [popupInfo, setPopupInfo] = useState<{
    title: string;
    message: string;
    navigateOnClose?: boolean;
    confirmAction?: () => void;
    secondaryAction?: () => void;
    secondaryLabel?: string;
    blockingBusyBlocks?: BusyBlock[];
  } | null>(null);

  // ── Header ────────────────────────────────────────────────────────────────
  const LeftIcon = ICONS.left;

  useEffect(() => {
    const handleBackPress = () => setActiveTab("calendar");

    setHeaderConfig({
      title: "Edit Task",
      show: true,
      icon: ICONS.edit,
      leftElement: (
        <TouchableOpacity onPress={handleBackPress}>
          <LeftIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerRight}>
          {ICONS.edit && React.createElement(ICONS.edit, { size: ICON_SIZES.md, color: COLORS.primary1 })}
        </View>
      ),
    });
  }, [setHeaderConfig, setActiveTab]);

  // ── Load task data from API ───────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) {
      setIsFetching(false);
      setFetchError("No task ID provided.");
      return;
    }

    let cancelled = false;

    const loadTask = async () => {
      setIsFetching(true);
      setFetchError(null);
      try {
        const task = await getTaskById(taskId);
        if (cancelled) return;

        if (!task) {
          setFetchError("Task not found.");
          setIsFetching(false);
          return;
        }

        // Extract date portion from dueDate (YYYY-MM-DD) in UTC
        let dateStr = "";
        if (task.dueDate) {
          const d = new Date(task.dueDate);
          dateStr = d.toISOString().slice(0, 10);
        }

        // Build subtask form state from API subtasks
        const apiSubtasks = task.subtasks || (task as any).subTasks || [];
        const formSubtasks: Subtask[] = apiSubtasks.map((st: any, idx: number) => ({
          id: st._id || st.id || `subtask-${idx}-${Date.now()}`,
          title: st.title || "",
          description: st.description || "",
          minutes: st.minutes ? String(st.minutes) : "",
          index: st.index ?? idx + 1,
          // Schedule fields will be populated after sessions are loaded
          scheduleMode: "auto" as const,
          sessionId: undefined,
          sessionDate: "",
          sessionStartTime: "",
          sessionEndTime: "",
        }));

        const numSubtasks = formSubtasks.length > 0 ? formSubtasks.length : 1;

        // Resolve subCategoryId from loaded task
        const subCategoryId =
          task.subCategory?._id ||
          task.subCategory?.id ||
          (typeof task.subCategory === "string" ? task.subCategory : null);

        setFormState({
          taskName: task.taskname || "",
          timeToComplete: dateStr,
          effort: task.effort ?? 3,
          importance: task.importance ?? 3,
          category: task.category || "",
          subCategoryId: subCategoryId || null,
          description: task.description || "",
          estimatedMinutes: task.estimatedDuration ? String(task.estimatedDuration) : "",
          numSubtasks,
          subtasks: formSubtasks,
        });

        // Store original task data for rollback if scheduling fails after an update
        originalTaskRef.current = {
          taskname: task.taskname || "",
          description: task.description || "",
          category: task.category || "",
          subcategoryId: subCategoryId || undefined,
          importance: task.importance ?? 3,
          effort: task.effort ?? 3,
          dueDate: dateStr,
          estimatedDuration: task.estimatedDuration ?? undefined,
          taskType: (task as any).taskType || "perfect",
          chunkCount: (task as any).chunkCount ?? undefined,
          subtasks: formSubtasks.map((st, idx) => ({
            id: st.id,
            title: st.title,
            description: st.description || undefined,
            minutes: st.minutes ? parseInt(st.minutes, 10) : undefined,
            index: idx + 1,
          })),
        };

        // Fetch subcategories for the loaded category
        if (task.category) {
          fetchSubcategoriesForCategory(task.category)
            .then((subs) => {
              if (!cancelled) setSubcategories(subs);
            })
            .catch(() => {});
        }

        // ── Load sessions and merge into subtask / single-task schedule ──
        try {
          const sessionsData = await getTaskSessions(taskId);
          if (!cancelled && sessionsData && "manualSchedule" in sessionsData && "sessions" in sessionsData) {
            const isManual = sessionsData.manualSchedule;
            const activeSessions = (sessionsData.sessions ?? [])
              .filter((s: any) => s.status !== "completed")
              .map((s: any) => ({
                id: s._id,
                date: toLocalDateStr(s.start),
                startTime: toLocalTimeStr(s.start),
                endTime: toLocalTimeStr(s.end),
                subtaskIndex: s.subtaskIndex,
              }));

            if (numSubtasks >= 2) {
              // Multi-part: merge sessions into subtasks by subtaskIndex
              setFormState((prev) => ({
                ...prev,
                subtasks: prev.subtasks.map((st, idx) => {
                  const session = activeSessions.find((s: any) => s.subtaskIndex === (st.index ?? idx + 1));
                  return session
                    ? {
                        ...st,
                        scheduleMode: isManual ? ("manual" as const) : ("auto" as const),
                        sessionId: session.id,
                        sessionDate: session.date,
                        sessionStartTime: session.startTime,
                        sessionEndTime: session.endTime,
                      }
                    : st;
                }),
              }));
            } else {
              // Single task: populate single-task schedule state
              const firstSession = activeSessions[0];
              if (firstSession) {
                setSingleTaskSchedule({
                  mode: isManual ? "manual" : "auto",
                  sessionId: firstSession.id,
                  date: firstSession.date,
                  startTime: firstSession.startTime,
                  endTime: firstSession.endTime,
                });
              }
            }
          }
        } catch (_) {
          // non-fatal — schedule section simply shows defaults
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : "Failed to load task.");
        }
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    loadTask();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // ── Form handlers (mirror CreateTask, with error clearing + numeric filtering) ──

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
    fetchSubcategoriesForCategory(key)
      .then((subs) => {
        setSubcategories(subs);
        setFormState((p) => ({ ...p, subCategoryId: subs[0]?.id ?? null }));
      })
      .catch(() => setSubcategories([]));
  }, []);

  const handleSubCategorySelect = useCallback((id: string | null) => {
    setFormState((p) => ({ ...p, subCategoryId: id }));
  }, []);

  const handleSubcategoryCreated = useCallback((newSub: Subcategory) => {
    setSubcategories((prev) => [...prev, newSub]);
  }, []);

  const handleDescriptionChange = useCallback((v: string) => setFormState((p) => ({ ...p, description: v })), []);

  // Only allow numeric input for estimated minutes
  const handleEstimatedMinutesChange = useCallback((v: string) => {
    const numericOnly = v.replace(/[^0-9]/g, "");
    setFormState((p) => ({ ...p, estimatedMinutes: numericOnly }));
    setFormErrors([]);
  }, []);

  const handleNumSubtasksChange = useCallback(
    (value: number) => {
      const clamped = Math.min(10, Math.max(1, value));
      const existing = formState.subtasks;
      const next: Subtask[] = Array.from(
        { length: clamped },
        (_, i) =>
          existing[i] ?? {
            id: `subtask-${i}-${Date.now()}`,
            title: "",
            description: "",
            minutes: "",
            index: i + 1,
            scheduleMode: "auto" as const,
            sessionDate: "",
            sessionStartTime: "",
            sessionEndTime: "",
          },
      );
      setFormState((p) => ({ ...p, numSubtasks: clamped, subtasks: next }));
    },
    [formState.subtasks],
  );

  const handleSubtaskUpdate = useCallback((index: number, field: keyof Subtask, value: any) => {
    const processedValue = field === "minutes" ? String(value).replace(/[^0-9]/g, "") : value;
    setFormState((p) => {
      const updated = [...p.subtasks];
      updated[index] = { ...updated[index], [field]: processedValue };
      return { ...p, subtasks: updated };
    });
    setFormErrors([]);
  }, []);

  const handleSingleTaskScheduleChange = useCallback((field: keyof SingleTaskSchedule, value: any) => {
    setSingleTaskSchedule((p) => ({ ...p, [field]: value }));
    setFormErrors([]);
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    if (!formState.taskName.trim()) {
      errors.push("Task name is required");
    }

    if (!formState.timeToComplete.trim()) {
      errors.push("Due date is required");
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formState.timeToComplete)) {
        errors.push("Invalid date format (expected YYYY-MM-DD)");
      }
    }

    if (formState.numSubtasks === 1 && formState.estimatedMinutes) {
      const mins = parseInt(formState.estimatedMinutes, 10);
      if (isNaN(mins) || mins <= 0) {
        errors.push("Estimated minutes must be a positive number");
      } else if (mins > 1440) {
        errors.push("Estimated minutes cannot exceed 1440 (24 hours)");
      }
    }

    // Validate single-task manual session
    if (formState.numSubtasks === 1 && singleTaskSchedule.mode === "manual") {
      if (singleTaskSchedule.date && singleTaskSchedule.startTime && singleTaskSchedule.endTime) {
        const sessionErr = validateEditableSessions([
          {
            date: singleTaskSchedule.date,
            startTime: singleTaskSchedule.startTime,
            endTime: singleTaskSchedule.endTime,
          },
        ]);
        if (sessionErr) errors.push(sessionErr);
      }
    }

    if (formState.numSubtasks >= 2) {
      const hasAtLeastOneTitle = formState.subtasks.some((st) => st.title.trim());
      if (!hasAtLeastOneTitle) {
        errors.push("At least one part must have a name");
      }

      formState.subtasks.forEach((st, idx) => {
        if (st.minutes) {
          const mins = parseInt(st.minutes, 10);
          if (isNaN(mins) || mins <= 0) {
            errors.push(`Part ${idx + 1}: minutes must be a positive number`);
          } else if (mins > 1440) {
            errors.push(`Part ${idx + 1}: minutes cannot exceed 1440 (24 hours)`);
          }
        }

        // Validate manual session times for each subtask
        if (st.scheduleMode === "manual" && st.sessionDate && st.sessionStartTime && st.sessionEndTime) {
          const sessionErr = validateEditableSessions([
            {
              date: st.sessionDate,
              startTime: st.sessionStartTime,
              endTime: st.sessionEndTime,
            },
          ]);
          if (sessionErr) errors.push(`Part ${idx + 1}: ${sessionErr}`);
        }
      });
    }

    return errors;
  }, [formState, singleTaskSchedule]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteTask = useCallback(() => {
    if (!taskId) {
      setPopupInfo({ title: "Error", message: "Task ID is missing. Unable to delete task." });
      return;
    }

    setPopupInfo({
      title: "Delete Task",
      message: "Are you sure you want to delete this task? This action cannot be undone.",
      confirmAction: async () => {
        setIsLoading(true);
        try {
          const success = await deleteTask(taskId);
          if (success) {
            notifyTaskUpdate({ taskId });
            setActiveTab("calendar");
          } else {
            setPopupInfo({ title: "Error", message: "Failed to delete task. Please try again." });
          }
        } catch (error) {
          setPopupInfo({
            title: "Error",
            message: `Failed to delete task: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        } finally {
          setIsLoading(false);
        }
      },
    });
  }, [taskId, setActiveTab, notifyTaskUpdate]);

  // ── Update (task details + schedule) ──────────────────────────────────────
  const handleUpdateTask = useCallback(async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);

    if (!taskId) {
      setFormErrors(["Task ID is missing. Unable to update task."]);
      return;
    }

    setIsLoading(true);
    try {
      // ── 1. Build & send task update ─────────────────────────────────────
      const subtasksData = formState.subtasks
        .map((st, idx) => ({
          id: st.id,
          title: st.title,
          description: st.description || undefined,
          minutes: st.minutes ? parseInt(st.minutes, 10) : undefined,
          index: idx + 1,
        }));

      let taskType: "perfect" | "in_parts" | "leaky" = "perfect";
      let chunkCount: number | undefined = undefined;

      if (formState.numSubtasks > 1) {
        const mins = formState.subtasks.map((st) => (st.minutes ? parseInt(st.minutes, 10) : 0)).filter((m) => m > 0);
        taskType = mins.length >= 2 && !mins.every((m) => m === mins[0]) ? "leaky" : "in_parts";
        chunkCount = formState.numSubtasks;
      }

      const updates: any = {
        taskname: formState.taskName,
        description: formState.description || "",
        category: formState.category,
        subcategoryId: formState.subCategoryId ?? undefined,
        importance: formState.importance,
        effort: formState.effort,
        dueDate: formState.timeToComplete,
        estimatedDuration: formState.estimatedMinutes ? parseInt(formState.estimatedMinutes, 10) : undefined,
        taskType,
        chunkCount,
      };

      if (subtasksData.length > 0) {
        updates.subtasks = subtasksData;
      }

      const updatedTask = await updateTask(taskId, updates);
      if (!updatedTask) {
        setFormErrors(["Server returned no task data. Please try again."]);
        return;
      }

      // ── 2. Save schedule (manual sessions) ─────────────────────────────
      const manualSessions: Array<{
        id?: string;
        start: string;
        end: string;
        subtaskIndex: number | null;
      }> = [];
      let hasAutoSubtasks = false;

      if (formState.numSubtasks >= 2) {
        formState.subtasks.forEach((st, idx) => {
          if (st.scheduleMode === "manual" && st.sessionDate && st.sessionStartTime && st.sessionEndTime) {
            manualSessions.push({
              id: st.sessionId,
              start: combineLocalDateTime(st.sessionDate, st.sessionStartTime).toISOString(),
              // combineEndDateTime auto-detects overnight: if endTime ≤ startTime the
              // end falls on the next calendar day (e.g. 21:00 → 05:00 next day).
              end: combineEndDateTime(st.sessionDate, st.sessionStartTime, st.sessionEndTime).toISOString(),
              subtaskIndex: st.index ?? idx + 1,
            });
          } else {
            hasAutoSubtasks = true;
          }
        });
      } else {
        // Single task
        if (
          singleTaskSchedule.mode === "manual" &&
          singleTaskSchedule.date &&
          singleTaskSchedule.startTime &&
          singleTaskSchedule.endTime
        ) {
          manualSessions.push({
            id: singleTaskSchedule.sessionId,
            start: combineLocalDateTime(singleTaskSchedule.date, singleTaskSchedule.startTime).toISOString(),
            // Auto-detect overnight: if endTime ≤ startTime the end is next calendar day.
            end: combineEndDateTime(singleTaskSchedule.date, singleTaskSchedule.startTime, singleTaskSchedule.endTime).toISOString(),
            subtaskIndex: null,
          });
        } else {
          hasAutoSubtasks = true;
        }
      }

      // Save manual sessions if any
      if (manualSessions.length > 0) {
        const schedResult = await updateTaskSchedule(taskId, manualSessions);
        if (!schedResult.success) {
          // Roll back the task update so the DB is not left in a partially-updated state
          if (originalTaskRef.current) {
            await updateTask(taskId, originalTaskRef.current).catch(() => {});
          }
          const blocks = schedResult.blockingBusyBlocks;
          const hasBusyBlocks = blocks && blocks.length > 0;
          setPopupInfo({
            title: hasBusyBlocks ? "Busy Block Conflict" : "Schedule Conflict",
            message: schedResult.error ?? "The selected time is not available. It may conflict with a busy block, another task, or the task deadline. Please choose a different time.",
            blockingBusyBlocks: hasBusyBlocks ? blocks : undefined,
            secondaryAction: hasBusyBlocks
              ? () => setActiveTabWithParams("user", { screen: "edit-preferences", subScreen: "scheduling" })
              : undefined,
            secondaryLabel: hasBusyBlocks ? "Go to Busy Blocks" : undefined,
          });
          return;
        }
      }

      // Trigger auto-scheduling for remaining subtasks
      if (hasAutoSubtasks) {
        const scheduleResult = await createTaskSchedule(taskId, { planningHorizonDays: 14 });
        if (!scheduleResult?.success) {
          // Roll back the task update so the DB is not left in a partially-updated state
          if (originalTaskRef.current) {
            await updateTask(taskId, originalTaskRef.current).catch(() => {});
          }
          const blocks = scheduleResult?.blockingBusyBlocks;
          const hasBusyBlocks = blocks && blocks.length > 0;
          const fallbackMsg = "The auto-scheduler couldn't find a long enough free window before the deadline. Try extending the deadline, reducing the estimated duration, or freeing time by adjusting your busy blocks.";
          setPopupInfo({
            title: "Could Not Schedule Task",
            message: scheduleResult?.message || fallbackMsg,
            blockingBusyBlocks: hasBusyBlocks ? blocks : undefined,
            secondaryAction: hasBusyBlocks
              ? () => setActiveTabWithParams("user", { screen: "edit-preferences", subScreen: "scheduling" })
              : undefined,
            secondaryLabel: hasBusyBlocks ? "Go to Busy Blocks" : undefined,
          });
          return;
        }
      }

      notifyTaskUpdate({ taskId });
      setPopupInfo({ title: "Success!", message: "Task updated successfully.", navigateOnClose: true });
    } catch (error) {
      setFormErrors([`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`]);
    } finally {
      setIsLoading(false);
    }
  }, [formState, taskId, singleTaskSchedule, notifyTaskUpdate, validateForm]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (isFetching) {
    return (
      <SafeAreaView style={[styles.loadingWrapper, { backgroundColor: colors.bg3 }]}>
        <ActivityIndicator size="large" color={COLORS.primary1} />
        <AppText style={[styles.loadingText, { color: colors.gray2 }]}>Loading task...</AppText>
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.loadingWrapper}>
        <AppText variant="errorText" style={styles.fetchErrorText}>
          {fetchError}
        </AppText>
        <AppButton
          title="Go Back"
          onPress={() => setActiveTab("calendar")}
          mode="filled"
          color="primary1"
          width="60%"
        />
      </SafeAreaView>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <ScrollableContent
      respectHeader
      respectNavBar
      extraTopPadding={SPACING.lg}
      scrollKey="edit-task"
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
        editMode
        singleTaskSchedule={singleTaskSchedule}
        onSingleTaskScheduleChange={handleSingleTaskScheduleChange}
      />

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <AppButton
          title={isLoading ? "UPDATING..." : "UPDATE TASK"}
          onPress={handleUpdateTask}
          mode="filled"
          color={COLORS.primary6}
          icon={isLoading ? undefined : "edit"}
          iconPosition="right"
          width="100%"
          disabled={isLoading}
        />
      </View>

      <View style={styles.buttonRow}>
        <AppButton
          title="Discard"
          onPress={() => setActiveTab("calendar")}
          mode="filled"
          color="lightGray"
          width="48%"
          disabled={isLoading}
        />
        <AppButton
          title="Delete"
          onPress={handleDeleteTask}
          mode="filled"
          color="primary7"
          width="48%"
          disabled={isLoading}
        />
      </View>

      {/* Error banner below buttons */}
      <ErrorBanner message={formErrors.join("\n")} />

      {/* Popup / Alert */}
      <PopupBox
        visible={popupInfo !== null}
        onClose={() => setPopupInfo(null)}
        title={popupInfo?.title ?? ""}
        titleColor={COLORS.primary1}
      >
        <AppText style={[styles.popupMessage, { color: colors.gray2 }]}>{popupInfo?.message}</AppText>
        {popupInfo?.blockingBusyBlocks && popupInfo.blockingBusyBlocks.length > 0 ? (
          <View style={styles.busyBlocksList}>
            {popupInfo.blockingBusyBlocks.map((block, i) => (
              <BusyBlockPreviewCard key={block._id ?? `block-${i}`} block={block} />
            ))}
          </View>
        ) : null}
        {popupInfo?.confirmAction ? (
          <View style={styles.confirmRow}>
            <AppButton title="Cancel" mode="filled" color="lightGray" onPress={() => setPopupInfo(null)} width="48%" />
            <AppButton
              title="Delete"
              mode="filled"
              color="primary7"
              onPress={() => {
                const action = popupInfo?.confirmAction;
                setPopupInfo(null);
                if (action) action();
              }}
              width="48%"
            />
          </View>
        ) : popupInfo?.secondaryAction ? (
          <View style={styles.confirmRow}>
            <AppButton
              title="OK"
              mode="filled"
              color="lightGray"
              onPress={() => {
                const nav = popupInfo?.navigateOnClose;
                setPopupInfo(null);
                if (nav) setActiveTab("calendar");
              }}
              width="48%"
            />
            <AppButton
              title={popupInfo?.secondaryLabel ?? "Go to Busy Blocks"}
              mode="filled"
              color="primary5"
              onPress={() => {
                const action = popupInfo?.secondaryAction;
                setPopupInfo(null);
                if (action) action();
              }}
              width="48%"
            />
          </View>
        ) : (
          <AppButton
            title="OK"
            mode="filled"
            color="primary1"
            onPress={() => {
              const nav = popupInfo?.navigateOnClose;
              setPopupInfo(null);
              if (nav) setActiveTab("calendar");
            }}
            width="100%"
          />
        )}
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
  popupMessage: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
  },
  busyBlocksList: {
    width: "100%",
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  buttonRow: {
    width: "100%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  confirmRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.lg,
    backgroundColor: COLORS.white3,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.darkGray,
    marginTop: SPACING.md,
  },
  fetchErrorText: {
    textAlign: "center",
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xlg,
  },
});

export default EditTask;
