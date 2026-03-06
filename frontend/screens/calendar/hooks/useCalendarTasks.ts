/**
 * useCalendarTasks Hook
 *
 * Custom hook for managing calendar tasks state and operations.
 * Handles task fetching, completion toggling, deletion, and subtask management.
 *
 * Usage:
 * ```tsx
 * const {
 *   taskGroups,
 *   isLoading,
 *   error,
 *   completedTasks,
 *   completedSubtasks,
 *   fetchTasksForDate,
 *   handleTaskCompletionToggle,
 *   handleSubtaskCompletionToggle,
 *   handleDeleteTask,
 *   handleDeleteSubtask,
 *   getLocalDateString,
 *   getFilteredTaskGroups,
 * } = useCalendarTasks(selectedDate, notifyTaskUpdate, subscribeToTaskUpdates);
 * ```
 */
import { useState, useEffect } from "react";
import {
  getScheduledSessionsForDate,
  updateTask,
  toggleTaskCompletion,
  getSubTasksForTask,
  markSubTaskComplete,
  markSubTaskTodo,
  deleteTask,
  deleteSubTask,
} from "../../../services/taskService";
import { TaskGroup } from "../types";
import { getLocalDateString } from "../../../utils/dateUtils";
import { useAccessibilityPreferences } from "../../../hooks/useAccessibilityPreferences";

export function useCalendarTasks(
  selectedDate: Date,
  notifyTaskUpdate: () => void,
  subscribeToTaskUpdates: (callback: () => void) => () => void,
) {
  const { preferences } = useAccessibilityPreferences();
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());

  /**
   * Fetch both regular tasks and scheduled sessions from API for the selected date.
   * Pass silent=true to refresh data without showing the loading spinner (e.g. after
   * optimistic updates so the UI doesn't flicker between states).
   */
  const fetchTasksForDate = async (date: Date, silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      // Fetch scheduled sessions for selected date
      const scheduledGroups = await getScheduledSessionsForDate(date, preferences.timeFormat);

      const groupsToUse: TaskGroup[] = scheduledGroups;

      // Initialize completed sets from server state
      const doneSubtasks = new Set<string>();
      const doneTasks = new Set<string>();
      groupsToUse.forEach((group) => {
        group.tasks.forEach((t) => {
          const taskIdToUse = t.taskId || t.id;

          // Handle tasks with NO subtasks
          if (!t.subtasks || t.subtasks.length === 0) {
            // scheduled sessions may report status="completed" rather than "done"
            if (t.completed === true || t.status === "done" || t.status === "completed") {
              doneTasks.add(taskIdToUse);
            }
            return;
          }

          // Handle tasks WITH subtasks
          t.subtasks.forEach((st) => {
            if (st.completed) doneSubtasks.add(st.id);
          });

          const serverProg = t.progressPercentage;

          if (typeof serverProg === "number" && serverProg === 100) {
            doneTasks.add(taskIdToUse);
          } else {
            const totalParts = t.totalParts;
            const isFullRepresentation = totalParts ? t.subtasks.length === totalParts : true;

            if (isFullRepresentation && t.subtasks.every((s) => s.completed)) {
              doneTasks.add(taskIdToUse);
            }
          }
        });
      });

      setCompletedSubtasks(doneSubtasks);
      setCompletedTasks(doneTasks);

      setTaskGroups(groupsToUse);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      if (!silent) setError("Failed to load tasks. Please try again.");
      setTaskGroups([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  /**
   * Handle task completion toggle
   */
  const handleTaskCompletionToggle = async (taskId: string, checked: boolean) => {
    try {
      // Optimistically update local state
      const newCompleted = new Set(completedTasks);
      if (checked) {
        newCompleted.add(taskId);
      } else {
        newCompleted.delete(taskId);
      }

      // Locate the task card
      const allTasksFlat = taskGroups.flatMap((g) => g.tasks);
      const card = allTasksFlat.find((t) => t.id === taskId || t.taskId === taskId);
      const parentTaskId = card?.taskId || card?.id || taskId;

      // Keep parentTaskId flagged
      if (parentTaskId && parentTaskId !== taskId) {
        if (checked) newCompleted.add(parentTaskId);
        else newCompleted.delete(parentTaskId);
      }
      setCompletedTasks(newCompleted);

      // Toggle all subtasks if parent task has them
      if (card?.subtasks && card.subtasks.length > 0) {
        let subtaskIds: string[] = [];
        try {
          const full = await getSubTasksForTask(parentTaskId);
          subtaskIds = full.map((s) => s._id);
        } catch (e) {
          subtaskIds = card.subtasks.map((s) => s.id);
        }

        const newSubtasksCompleted = new Set(completedSubtasks);
        if (checked) {
          subtaskIds.forEach((id) => newSubtasksCompleted.add(id));
        } else {
          subtaskIds.forEach((id) => newSubtasksCompleted.delete(id));
        }
        setCompletedSubtasks(newSubtasksCompleted);

        // Persist each subtask change
        const ops = subtaskIds.map((stId) =>
          checked ? markSubTaskComplete(parentTaskId, stId) : markSubTaskTodo(parentTaskId, stId),
        );
        const results = await Promise.allSettled(ops);
        const failed = results.some(
          (r) => r.status === "rejected" || (r.status === "fulfilled" && !(r as any).value?.success),
        );
        if (failed) {
          console.error("[handleTaskCompletionToggle] Failed to update one or more subtasks", results);
          fetchTasksForDate(selectedDate, true);
        }
      }

      // Persist parent task status update by toggling; the toggle endpoint will
      // handle both completion and reversal and also update any scheduled sessions
      // accordingly. We ignore `checked` since toggle flips whatever the server has.
      // In the unlikely event the UI state and server drift, the optimistic update
      // above will keep things coherent until the silent refetch.
      await toggleTaskCompletion(parentTaskId);

      // Notify other components
      notifyTaskUpdate();

      // Silently revalidate — don't show loading spinner so the UI doesn't flicker
      await fetchTasksForDate(selectedDate, true);
    } catch (err) {
      console.error("Failed to update task completion:", err);
      fetchTasksForDate(selectedDate, true);
    }
  };

  /**
   * Handle subtask completion toggle.
   * Visual state is managed locally in TaskCard to prevent re-rendering all sibling cards.
   * This handler only persists to the server and silently re-fetches on failure so the
   * card can revert its local state via the useEffect prop sync.
   */
  const handleSubtaskCompletionToggle = async (taskId: string, subtaskId: string, checked: boolean) => {
    try {
      const result = checked ? await markSubTaskComplete(taskId, subtaskId) : await markSubTaskTodo(taskId, subtaskId);

      if (!result.success) {
        console.error("Failed to update subtask status — reverting via silent refresh");
        // Silent refresh: TaskCard useEffect will sync local state back to server truth
        await fetchTasksForDate(selectedDate, true);
      } else {
        notifyTaskUpdate();
      }
    } catch (err) {
      console.error("Failed to update subtask completion:", err);
      await fetchTasksForDate(selectedDate, true);
    }
  };

  /**
   * Handle task deletion
   */
  const handleDeleteTask = async (taskId: string) => {
    try {
      const success = await deleteTask(taskId);
      if (success) {
        await fetchTasksForDate(selectedDate);
        notifyTaskUpdate();
      } else {
        console.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  /**
   * Handle subtask deletion — removes the SubTask and its TaskSchedule entries via API
   */
  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    try {
      const success = await deleteSubTask(taskId, subtaskId);
      if (success) {
        await fetchTasksForDate(selectedDate);
        notifyTaskUpdate();
      } else {
        console.error("Failed to delete subtask");
      }
    } catch (error) {
      console.error("Error deleting subtask:", error);
    }
  };

  /**
   * Get tasks filtered by selected date.
   */
  const getFilteredTaskGroups = (): TaskGroup[] => {
    const selectedDateString = getLocalDateString(selectedDate);

    const filteredGroups: TaskGroup[] = [];

    taskGroups.forEach((group) => {
      const matchingTasks = group.tasks.filter((task) => {
        return task.dateString === selectedDateString;
      });

      if (matchingTasks.length > 0) {
        filteredGroups.push({
          date: group.date,
          tasks: matchingTasks,
        });
      }
    });

    return filteredGroups;
  };

  /**
   * Subscribe to task updates
   */
  useEffect(() => {
    // Always silent: a notify triggered by our own checkbox toggles must not
    // show the loading spinner (that is the main flicker source).
    const unsubscribe = subscribeToTaskUpdates(() => {
      fetchTasksForDate(selectedDate, true);
    });
    return unsubscribe;
  }, [selectedDate, subscribeToTaskUpdates]);

  /**
   * Fetch tasks when selected date or time format changes
   */
  useEffect(() => {
    fetchTasksForDate(selectedDate);
  }, [selectedDate, preferences.timeFormat]);

  return {
    taskGroups,
    isLoading,
    error,
    completedTasks,
    completedSubtasks,
    fetchTasksForDate,
    handleTaskCompletionToggle,
    handleSubtaskCompletionToggle,
    handleDeleteTask,
    handleDeleteSubtask,
    getLocalDateString,
    getFilteredTaskGroups,
  };
}
