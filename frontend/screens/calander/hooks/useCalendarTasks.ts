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
  getTasksForDate,
  getScheduledSessionsForDate,
  updateTask,
  getSubTasksForTask,
  markSubTaskComplete,
  markSubTaskTodo,
  deleteTask,
} from "../../../services/taskService";
import { TaskGroup } from "../types";

export function useCalendarTasks(
  selectedDate: Date,
  notifyTaskUpdate: () => void,
  subscribeToTaskUpdates: (callback: () => void) => () => void,
) {
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());

  /**
   * Fetch both regular tasks and scheduled sessions from API for the selected date
   */
  const fetchTasksForDate = async (date: Date) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both regular tasks and scheduled sessions in parallel
      const [taskGroups, scheduledGroups] = await Promise.all([
        getTasksForDate(date),
        getScheduledSessionsForDate(date),
      ]);

      console.log("[useCalendarTasks] Fetched taskGroups:", taskGroups);
      console.log("[useCalendarTasks] Fetched scheduledGroups:", scheduledGroups);

      // Use scheduled sessions if available, otherwise use regular tasks
      let groupsToUse: TaskGroup[];
      if (scheduledGroups.length > 0) {
        groupsToUse = scheduledGroups;
        console.log("[useCalendarTasks] Using scheduled groups");
      } else {
        groupsToUse = taskGroups;
        console.log("[useCalendarTasks] Using task groups");
      }

      // Initialize completed sets from server state
      const doneSubtasks = new Set<string>();
      const doneTasks = new Set<string>();
      groupsToUse.forEach((group) => {
        group.tasks.forEach((t) => {
          const taskIdToUse = (t as any).taskId || t.id;

          // Handle tasks with NO subtasks
          if (!t.subtasks || t.subtasks.length === 0) {
            if ((t as any).completed === true || (t as any).status === "done") {
              doneTasks.add(taskIdToUse);
            }
            return;
          }

          // Handle tasks WITH subtasks
          t.subtasks.forEach((st) => {
            if ((st as any).completed) doneSubtasks.add((st as any).id);
          });

          const serverProg = (t as any).progressPercentage;

          if (typeof serverProg === "number" && serverProg === 100) {
            doneTasks.add(taskIdToUse);
          } else {
            const totalParts = (t as any).totalParts;
            const isFullRepresentation = totalParts ? t.subtasks.length === totalParts : true;

            if (isFullRepresentation && t.subtasks.every((s) => (s as any).completed)) {
              doneTasks.add(taskIdToUse);
            }
          }
        });
      });

      setCompletedSubtasks(doneSubtasks);
      setCompletedTasks(doneTasks);

      console.log("[useCalendarTasks] groupsToUse:", groupsToUse);

      // Initialize completedSubtasks from the fetched data
      const newCompletedSubtasks = new Set<string>();
      groupsToUse.forEach((group, groupIdx) => {
        console.log(`[useCalendarTasks] Group ${groupIdx}:`, group);
        group.tasks.forEach((task, taskIdx) => {
          console.log(
            `[useCalendarTasks]   Task ${taskIdx}: id=${task.id}, title=${task.title}, subtasks=${task.subtasks?.length || 0}`,
          );
          if (task.subtasks) {
            task.subtasks.forEach((subtask, subIdx) => {
              console.log(
                `[useCalendarTasks]     Subtask ${subIdx}: id=${subtask.id}, title=${subtask.title}, completed=${subtask.completed}`,
              );
              if (subtask.completed) {
                newCompletedSubtasks.add(subtask.id);
              }
            });
          }
        });
      });
      setCompletedSubtasks(newCompletedSubtasks);

      setTaskGroups(groupsToUse);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load tasks. Please try again.");
      setTaskGroups([]);
    } finally {
      setIsLoading(false);
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
      const card: any = allTasksFlat.find((t: any) => t.id === taskId || t.taskId === taskId);
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
          subtaskIds = card.subtasks.map((s: any) => s.id);
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
          fetchTasksForDate(selectedDate);
        }
      }

      // Persist parent task status update
      await updateTask(parentTaskId, { status: checked ? "done" : "todo" });

      // Notify other components
      notifyTaskUpdate();

      // Revalidate
      await fetchTasksForDate(selectedDate);
    } catch (err) {
      console.error("Failed to update task completion:", err);
      fetchTasksForDate(selectedDate);
    }
  };

  /**
   * Handle subtask completion toggle
   */
  const handleSubtaskCompletionToggle = async (taskId: string, subtaskId: string, checked: boolean) => {
    try {
      // Optimistically update local state
      const newSubtasksCompleted = new Set(completedSubtasks);

      if (checked) {
        newSubtasksCompleted.add(subtaskId);
      } else {
        newSubtasksCompleted.delete(subtaskId);
      }

      setCompletedSubtasks(newSubtasksCompleted);

      // Call the API
      const result = checked ? await markSubTaskComplete(taskId, subtaskId) : await markSubTaskTodo(taskId, subtaskId);

      if (!result.success) {
        // Revert optimistic update on error
        const revertSubtasksCompleted = new Set(completedSubtasks);
        if (checked) {
          revertSubtasksCompleted.delete(subtaskId);
        } else {
          revertSubtasksCompleted.add(subtaskId);
        }
        setCompletedSubtasks(revertSubtasksCompleted);
        console.error("Failed to update subtask status");
      } else {
        notifyTaskUpdate();
      }
    } catch (err) {
      console.error("Failed to update subtask completion:", err);
      // Revert optimistic update on error
      const revertSubtasksCompleted = new Set(completedSubtasks);
      if (checked) {
        revertSubtasksCompleted.delete(subtaskId);
      } else {
        revertSubtasksCompleted.add(subtaskId);
      }
      setCompletedSubtasks(revertSubtasksCompleted);
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
   * Handle subtask deletion
   */
  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    try {
      const fullSubtasks = await getSubTasksForTask(taskId);
      const updatedSubtasks = fullSubtasks.filter((st) => st._id !== subtaskId);

      const success = await updateTask(taskId, { subtasks: updatedSubtasks } as any);
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
   * Convert local Date to YYYY-MM-DD string without UTC conversion
   */
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  /**
   * Get tasks filtered by selected date
   */
  const getFilteredTaskGroups = (): TaskGroup[] => {
    const selectedDateString = getLocalDateString(selectedDate);

    const filteredGroups: TaskGroup[] = [];

    taskGroups.forEach((group) => {
      const matchingTasks = group.tasks.filter((task) => task.dateString === selectedDateString);

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
    const unsubscribe = subscribeToTaskUpdates(() => {
      fetchTasksForDate(selectedDate);
    });
    return unsubscribe;
  }, [selectedDate, subscribeToTaskUpdates]);

  /**
   * Fetch tasks when selected date changes
   */
  useEffect(() => {
    fetchTasksForDate(selectedDate);
  }, [selectedDate]);

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
