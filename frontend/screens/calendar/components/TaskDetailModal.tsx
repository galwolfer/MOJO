/**
 * TaskDetailModal
 *
 * Full-screen modal that displays detailed task information.
 * Reuses the same components as TaskDetailWidget (TaskTitle, TaskTagsRow,
 * TwoColumnGrid, ScheduledSessionsSection) for consistency.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import PopupBox from "../../../components/common/PopupBox";
import { COLORS, SPACING, ICON_SIZES } from "../../../theme";
import { getCategoryMeta } from "../../../config/categoryMeta";
import Icon from "../../../components/icons/Icon";
import {
  TaskTagsRow,
  TwoColumnGrid,
  renderTaskField,
  ScheduledSessionsSection,
} from "../../../components/special/task";
import { TaskWithSubtasks } from "../../../services/taskService";
import { useTaskContext } from "../../../context/TaskContext";
import { useOptionalStatsContext } from "../../../context/StatsContext";
import { getCategoryDisplay, ScheduledSession, Subtask } from "../../../components/widgets/taskHelpers";
import { toggleSubtask, toggleSessionSmart } from "../../../components/widgets/widgetHelpers";

interface TaskDetailModalProps {
  visible: boolean;
  task: TaskWithSubtasks | null;
  onClose: () => void;
  onEdit?: (task: TaskWithSubtasks) => void;
}

// ─── Inner content (needs hooks, so lives in its own component) ──────────────

function TaskDetailContent({
  task,
  onClose,
  onEdit,
}: {
  task: TaskWithSubtasks;
  onClose: () => void;
  onEdit?: (task: TaskWithSubtasks) => void;
}) {
  const { notifyTaskUpdate } = useTaskContext();
  const { notifyStatsChange } = useOptionalStatsContext();

  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  // Initialize checkbox state from task data whenever the task changes
  useEffect(() => {
    const done = new Set<string>();
    const rawSubtasks: any[] = task.subtasks || (task as any).subTasks || [];

    // Mark completed sessions — the /tasks API response doesn't include subtaskId
    // on schedule objects, only subtaskIndex. Use it to look up the subtask _id.
    (task.scheduledSessions || []).forEach((s: any) => {
      const isDoneSession = s.subtaskStatus === "done" || s.status === "completed";
      if (!isDoneSession) return;

      // Prefer explicit subtaskId when present (widget/detail calls may include it)
      if (s.subtaskId) {
        done.add(s.subtaskId);
        return;
      }
      // Fallback: match by 1-based subtaskIndex against st.index
      if (typeof s.subtaskIndex === "number") {
        const found = rawSubtasks.find((st: any) => (st.index ?? st.order) === s.subtaskIndex);
        const sid = found ? found._id || found.id || "" : "";
        if (sid) done.add(sid);
      }
    });

    setCompletedParts(done);
  }, [task]);

  const categoryMeta = getCategoryMeta(task.category);
  const categoryDisplay = getCategoryDisplay(task.category);
  // Guard: subCategory may arrive as a raw ObjectId string when the API doesn't populate it.
  const subCat = task.subCategory && typeof task.subCategory === "object" ? task.subCategory : null;
  const subLabel = (task as any).subcategoryDisplay || subCat?.label || subCat?.name || (task as any).subcategory || "";

  console.log("[TaskDetailModal] task.subCategory:", task.subCategory, "subCat:", subCat, "subLabel:", subLabel);

  const taskForFields = {
    dueDate: task.dueDate,
    startDate: task.earliestStart,
    earliestStart: task.earliestStart,
    estimatedDuration: task.estimatedDuration,
  };

  const normalizedSubtasks: Subtask[] = (task.subtasks || (task as any).subTasks || []).map((st: any) => ({
    id: st._id || st.id || String(st.index ?? ""),
    title: st.title,
    description: st.description,
    completed: st.status === "done" || st.completedAt != null,
    duration: st.minutes,
    // 'order' mirrors st.index (1-based) so getSubtaskIdFromSession can match
    // sessions by subtaskIndex when the session has no direct subtaskId field.
    order: st.index ?? st.order,
  }));

  const normalizedSessions: ScheduledSession[] = (task.scheduledSessions || []).map((s: any) => ({
    ...s,
    id: s.id || s._id,
  }));

  const handleToggleSubtask = useCallback(
    async (subtaskId?: string) => {
      if (!subtaskId) return;
      await toggleSubtask({
        taskId: task._id,
        subtaskId,
        completedParts,
        setCompletedParts,
        loadingParts,
        setLoadingParts,
        notifyTaskUpdate,
        notifyStatsChange,
      });
    },
    [task._id, completedParts, loadingParts, notifyTaskUpdate, notifyStatsChange],
  );

  const handleToggleSession = useCallback(
    async (taskIdParam: string, session: ScheduledSession, index: number, subtasksParam?: Subtask[]) => {
      await toggleSessionSmart({
        taskId: taskIdParam,
        session,
        index,
        subtasks: subtasksParam || normalizedSubtasks,
        completedParts,
        setCompletedParts,
        loadingParts,
        setLoadingParts,
        notifyTaskUpdate,
        notifyStatsChange,
      });
    },
    [normalizedSubtasks, completedParts, loadingParts, notifyTaskUpdate, notifyStatsChange],
  );

  return (
    <>
      {/* Edit button */}
      {onEdit && (
        <AppButton
          title="Edit Task"
          icon="edit"
          iconPosition="left"
          mode="light"
          color="primary1"
          onPress={() => {
            onEdit(task);
            onClose();
          }}
          style={styles.editButton}
        />
      )}

      {/* Tags */}
      <TaskTagsRow
        category={task.category}
        categoryDisplay={categoryDisplay}
        subcategoryDisplay={subLabel}
        subCategory={subCat}
        importance={task.importance}
        effort={task.effort}
      />

      {/* Details Grid */}
      <TwoColumnGrid
        items={[
          renderTaskField({ dueDate: task.dueDate }, "dueDate"),
          renderTaskField(taskForFields, "startDate"),
          renderTaskField(taskForFields, "earliestStart"),
          renderTaskField({ estimatedDuration: task.estimatedDuration }, "estimatedDuration"),
        ]}
      />

      {/* Description */}
      {task.description ? (
        <AppText variant="bodyText" style={styles.description}>
          {task.description}
        </AppText>
      ) : null}

      {/* Scheduled sessions with live checkboxes */}
      <View style={styles.ScheduledSessionsSectionContainer}>
        <ScheduledSessionsSection
          taskId={task._id}
          taskTitle={task.taskname || "Untitled"}
          scheduledSessions={normalizedSessions}
          subtasks={normalizedSubtasks}
          category={task.category}
          categoryColor={categoryMeta.color}
          completedParts={completedParts}
          loadingParts={loadingParts}
          onToggleSession={handleToggleSession}
          estimatedDuration={task.estimatedDuration}
          progressPercentage={task.progressPercentage ?? null}
          sessionHeaderMode="date"
          hideTaskTitle
          dividerColor={COLORS.white}
          taskStatus={task.status}
        />
      </View>
    </>
  );
}

// ─── Public wrapper ──────────────────────────────────────────────────────────

/**
 * TaskDetailModal — shows rich task details inside a PopupBox overlay.
 * Mirrors the layout of TaskDetailWidget using shared task components.
 * Checkboxes for subtasks and sessions are fully interactive.
 */
export default function TaskDetailModal({ visible, task, onClose, onEdit }: TaskDetailModalProps) {
  const categoryMeta = getCategoryMeta(task?.category);
  const titleIcon = categoryMeta?.icon ? (
    <Icon name={categoryMeta.icon as string} size={ICON_SIZES.md} color={COLORS.colorWhite} />
  ) : undefined;

  return (
    <PopupBox
      visible={visible}
      onClose={onClose}
      title={task?.taskname || (task as any)?.title || "Task Detail"}
      titleColor={categoryMeta.color}
      titleIcon={titleIcon}
    >
      <View style={styles.content}>
        {visible && task ? <TaskDetailContent task={task} onClose={onClose} onEdit={onEdit} /> : null}
      </View>
    </PopupBox>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  editButton: {
    alignSelf: "flex-start",
  },
  description: {
    color: COLORS.darkGray,
    lineHeight: 20,
  },
  ScheduledSessionsSectionContainer: {
    marginStart: SPACING.sm,
  },
});
