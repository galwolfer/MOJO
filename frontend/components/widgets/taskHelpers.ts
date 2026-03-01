import { COLORS } from "../../theme";
import { SVG_DATA_URIS } from "../icons/svg-data-uris";
import { getCategoryMeta } from "../../config/categoryMeta";
import { updateSubTask, GamificationResult } from "../../services/taskService";

export interface Subtask {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  completed?: boolean;
  order?: number;
  duration?: number;
}

export interface ScheduledSession {
  id?: string;
  start?: string;
  end?: string;
  status?: string;
  subtaskIndex?: number;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskStatus?: string;
}

/**
 * getSubtaskIdFromSession
 * Extracts the subtask ID from a scheduled session.
 * First checks for direct subtaskId, then falls back to finding by subtaskIndex in subtasks array.
 * @param session - The scheduled session object
 * @param subtasks - Array of subtasks to search in if using subtaskIndex
 * @returns The subtask ID string or undefined if not found
 */
export function getSubtaskIdFromSession(session?: ScheduledSession, subtasks?: Subtask[]) {
  if (!session) return undefined;
  if ((session as any).subtaskId) return (session as any).subtaskId;
  if (typeof session.subtaskIndex === "number" && subtasks) {
    const found = subtasks.find((st) => st.order === session.subtaskIndex || st.order === session.subtaskIndex);
    return found?.id;
  }
  return undefined;
}

/**
 * formatDate
 * Formats an ISO date string into a human-readable date format.
 * Returns "Not set" if no date provided, or the original string if parsing fails.
 * @param dateStr - ISO date string to format
 * @returns Formatted date string (e.g., "Mon, Jan 15, 2024")
 */
export const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Not set";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

/**
 * formatDateTime
 * Formats an ISO date string into a human-readable date and time format.
 * Returns "Not scheduled" if no date provided.
 * @param dateStr - ISO date string to format
 * @returns Formatted date and time string (e.g., "Mon, Jan 15 at 2:30 PM")
 */
export const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "Not scheduled";
  try {
    const date = new Date(dateStr);
    const dateText = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeText = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateText} at ${timeText}`;
  } catch {
    return dateStr;
  }
};

/**
 * formatTimeRange
 * Formats a scheduled session's start and end times into a time range string.
 * Returns "Time TBD" if no start time, or just start time if no valid end time.
 * @param session - Scheduled session with start/end times
 * @returns Time range string (e.g., "2:30 PM - 4:00 PM")
 */
export const formatTimeRange = (session?: ScheduledSession) => {
  if (!session?.start) return "Time TBD";
  try {
    const start = new Date(session.start as string);
    const end = session.end ? new Date(session.end) : null;
    const startText = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (!end || Number.isNaN(end.getTime())) return startText;
    const endText = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${startText} - ${endText}`;
  } catch {
    return "Time TBD";
  }
};

/**
 * getStatusStyle
 * Maps a status string to a color for UI styling.
 * Used to color-code task/session status indicators.
 * @param status - Status string (done, completed, in_progress, pending, todo)
 * @returns Color key from COLORS theme
 */
export const getStatusStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "done":
    case "completed":
      return COLORS.primary6; // Green for completed
    case "in_progress":
    case "in progress":
      return COLORS.primary1; // Blue for in progress
    case "pending":
    case "todo":
      return COLORS.primary5; // Yellow for pending
    default:
      return COLORS.darkGray; // Gray for unknown
  }
};

/**
 * getImportanceLabel
 * Converts an importance numeric value (1-5) to a human-readable label.
 * Used for displaying importance in task details and tags.
 * @param importance - Numeric importance level (1=Low, 5=Critical)
 * @returns Label string with importance level
 */
export const getImportanceLabel = (importance?: number) => {
  if (!importance) return "Not set";
  const labels = ["", "Low ", "Medium-Low ", "Medium ", "High ", "Critical"];
  return labels[importance] || `Priority ${importance}`;
};

/**
 * getEffortLabel
 * Converts an effort numeric value (1-5) to a human-readable label.
 * Used for displaying effort level in task details and tags.
 * @param effort - Numeric effort level (1=Minimal, 5=Extensive)
 * @returns Label string with effort level
 */
export const getEffortLabel = (effort?: number) => {
  if (!effort) return "Not set";
  const labels = ["", "Minimal ", "Light ", "Moderate ", "Heavy ", "Extensive "];
  return labels[effort] || `Level ${effort}`;
};

/**
 * getImportanceColor
 * Maps an importance/effort numeric value (1-5) to a display color.
 * Used by sliders in CreateTask and EditTask screens.
 */
export const getImportanceColor = (value: number): string => {
  if (value === 1) return COLORS.primary6; // Green - Low
  if (value === 2) return COLORS.primary1; // Blue - Below Avg
  if (value === 3) return COLORS.primary5; // Orange - Average
  if (value === 4) return COLORS.primary4; // Pink - Above Avg
  return "#D32F2F"; // Red - Critical
};

/**
 * formatDuration
 * Formats a duration in minutes to a human-readable time string.
 * Converts to hours and minutes format for durations over 60 minutes.
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "2h 30m" or "45 min")
 */
export const formatDuration = (minutes?: number) => {
  if (!minutes) return "Not set";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * UI helpers: map importance/effort values to presentation (color index / icon key)
 * These functions provide consistent styling mappings for importance and effort levels
 */

/**
 * importanceColorIndex
 * Maps importance level to a color index for theming.
 * @param imp - Importance level (1-5)
 * @returns Color index (6=green, 5=yellow, 7=red, 8=gray)
 */
export const importanceColorIndex = (imp?: number) => {
  if (!imp) return 8; // gray
  if (imp <= 2) return 6; // green
  if (imp === 3) return 5; // yellow
  return 7; // red
};

/**
 * importanceIcon
 * Maps importance level to an icon key for display.
 * @param imp - Importance level (1-5)
 * @returns Icon key string
 */
export const importanceIcon = (imp?: number): string => {
  if (!imp) return "list";
  if (imp <= 2) return "lowImportant";
  if (imp === 3) return "mediumImportant";
  return "highPriority";
};

/**
 * effortColor
 * Maps effort level to a color index for theming.
 * @param eff - Effort level (1-5)
 * @returns Color index (6=green, 5=yellow, 7=red, 8=gray)
 */
export const effortColor = (eff?: number) => {
  if (!eff) return 8;
  if (eff <= 2) return 6; // green
  if (eff === 3) return 5; // yellow
  return 7; // red
};

/**
 * effortIcon
 * Maps effort level to an icon key for display.
 * @param eff - Effort level (1-5)
 * @returns Icon key string
 */
export const effortIcon = (eff?: number): string => {
  if (!eff) return "list";
  if (eff <= 2) return "lowEffort";
  if (eff === 3) return "flame";
  return "highEffort";
};

/**
 * getTaskTypeLabel
 * Converts task type and split capability to a human-readable label.
 * Used to describe how a task can be scheduled.
 * @param taskType - Task type string ("in_parts", "leaky")
 * @param canSplit - Whether the task can be split into parts
 * @returns Descriptive label for task scheduling type
 */
export const getTaskTypeLabel = (taskType?: string, canSplit?: boolean) => {
  if (taskType === "in_parts") return "Split into parts";
  if (taskType === "leaky") return "Flexible timing";
  if (canSplit) return "Can be split";
  return "Single block";
};

/**
 * getSessionLabel
 * Generates a display label for a scheduled session.
 * Uses subtask title if available, otherwise falls back to part/session numbering.
 * @param session - Scheduled session object
 * @param index - Session index in the list (for fallback numbering)
 * @returns Display label for the session
 */
export const getSessionLabel = (session: ScheduledSession, index?: number) => {
  if (session.subtaskTitle) return session.subtaskTitle;
  if (session.subtaskIndex) return `Part ${session.subtaskIndex}`;
  if (typeof index === "number") return `Session ${index + 1}`;
  return `Session`;
};

/**
 * getSessionKey
 * Builds a stable key identifying a scheduled session for tracking completion state
 */
export const getSessionKey = (
  taskId: string,
  session: ScheduledSession,
  index: number,
  subtasks?: Subtask[],
): string => {
  const subtaskId = getSubtaskIdFromSession(session, subtasks);
  return subtaskId || session.id || `${taskId}-${session.start || `session-${index}`}`;
};

/**
 * getTimeParts
 * Extract hour:minute and AM/PM parts from an ISO date string.
 * Supports both 12-hour and 24-hour format based on the format parameter.
 * @param dateStr - ISO date string
 * @param format - Time format: "12h" (default) or "24h"
 * @returns Object with time (HH:MM), ampm (AM/PM or empty for 24h), and date strings
 */
export const getTimeParts = (
  dateStr?: string,
  format: "12h" | "24h" = "12h",
): { time: string; ampm: string; date: string } => {
  if (!dateStr) return { time: "", ampm: "", date: "" };
  try {
    const date = new Date(dateStr);
    const minutes = date.getMinutes();
    const rawHours = date.getHours();

    let time: string;
    let ampm: string;

    if (format === "24h") {
      // 24-hour format: HH:MM (e.g., "14:30")
      time = `${rawHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      ampm = "";
    } else {
      // 12-hour format: H:MM AM/PM (e.g., "2:30 PM")
      ampm = rawHours >= 12 ? "PM" : "AM";
      const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      time = `${hours12}:${minutes.toString().padStart(2, "0")}`;
    }

    // Format date as "Mon, Jan 27"
    const dateFormatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return { time, ampm, date: dateFormatted };
  } catch {
    return { time: "", ampm: "", date: "" };
  }
};

/**
 * getColoredDataUri
 * Takes an SVG data URI and replaces currentColor with a specified color.
 * Used to dynamically color SVG icons for different themes/states.
 * @param fileName - Key for the SVG in SVG_DATA_URIS
 * @param color - Hex color string to replace currentColor
 * @returns Modified data URI with colored SVG, or original if processing fails
 */
export const getColoredDataUri = (fileName: string, color: string) => {
  const raw = (SVG_DATA_URIS as Record<string, string>)[fileName];
  if (!raw) return undefined;
  const base64 = raw.split(",")[1];
  let svgContent = "";
  try {
    if (typeof atob === "function") svgContent = atob(base64);
    else if (typeof (global as any).atob === "function") svgContent = (global as any).atob(base64);
    else if (typeof Buffer !== "undefined") svgContent = Buffer.from(base64, "base64").toString("utf8");
  } catch (e) {
    return raw;
  }

  const colored = svgContent.replace(/currentColor/g, color);
  let newBase64 = "";
  try {
    if (typeof btoa === "function") newBase64 = btoa(colored);
    else if (typeof (global as any).btoa === "function") newBase64 = (global as any).btoa(colored);
    else if (typeof Buffer !== "undefined") newBase64 = Buffer.from(colored, "utf8").toString("base64");
  } catch (e) {
    return raw;
  }

  return `data:image/svg+xml;base64,${newBase64}`;
};

/**
 * getCategoryDisplay
 * Returns the human-friendly display name for a task category.
 * Prefers the provided categoryDisplay, falls back to categoryMeta displayName, then raw category key.
 * @param category - Category key string
 * @param categoryDisplay - Pre-formatted display name (takes precedence)
 * @returns Display name for the category
 */
export const getCategoryDisplay = (category?: string | null, categoryDisplay?: string | null): string => {
  if (categoryDisplay && typeof categoryDisplay === "string" && categoryDisplay.trim() !== "") return categoryDisplay;
  const meta = getCategoryMeta(category || undefined);
  return meta?.displayName || category || "";
};

/**
 * computeTaskProgress
 * Derives a task's progress percentage (0-100) from explicit progress, subtasks, or scheduled sessions
 */
export const computeTaskProgress = (task: any, completedParts: Set<string>): number => {
  const _taskId = task?.id || (task && task._id) || "(unknown)";

  // Subtasks take precedence when available (and consider optimistic completedParts)
  const subtasks = (task as any).subtasks as Subtask[] | undefined;
  if (subtasks && subtasks.length > 0) {
    const total = subtasks.length;
    const completed = subtasks.filter(
      (st) => st.status === "done" || st.completed || (st.id && completedParts.has(st.id)),
    ).length;
    const v = total === 0 ? 0 : Math.round((completed / total) * 100);
    return v;
  }

  // Next, use scheduled sessions when available
  const sessions = (task as any).scheduledSessions as ScheduledSession[] | undefined;
  if (sessions && sessions.length > 0) {
    let completed = 0;
    sessions.forEach((s, idx) => {
      const key = getSessionKey(task.id, s, idx, subtasks);
      const isDone = (s as any).subtaskStatus === "done" || s.status === "completed" || completedParts.has(key);
      if (isDone) completed += 1;
    });
    const v = Math.round((completed / sessions.length) * 100);
    return v;
  }

  // Fallback to explicit progressPercentage if provided
  if (typeof task?.progressPercentage === "number") {
    const v = Math.max(0, Math.min(100, task.progressPercentage));
    return v;
  }

  // No progress information available
  return 0;
};

/**
 * sessionRowData
 * Extracts the display-friendly pieces for a scheduled session row.
 * Keeps rendering logic in components clean and testable.
 * Builds time range text based on screen width (compact vs full).
 * @param session - Scheduled session object
 * @param subtasks - Array of subtasks for finding associated subtask
 * @param index - Session index for fallback labeling
 * @param options - Display options (width for responsive formatting)
 * @returns Object with subtask, dateText, timeRangeText, label, and durationMinutes
 */
export function sessionRowData(
  session?: ScheduledSession,
  subtasks?: Subtask[],
  index?: number,
  options?: { width?: number },
) {
  const subtask = session ? (subtasks || []).find((st) => st.id === (session as any).subtaskId) : undefined;

  // Build a compact or full time range depending on available width
  let timeRangeText = "";
  if (session?.start) {
    try {
      const start = new Date(session.start as string);
      const startText = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      if (!session.end) {
        timeRangeText = startText;
      } else if (options?.width && options.width <= 600) {
        // compact: show only the start time when width is small
        timeRangeText = startText;
      } else {
        // full range
        timeRangeText = formatTimeRange(session);
      }
    } catch {
      timeRangeText = "";
    }
  }

  return {
    subtask,
    dateText: formatDate(session?.start),
    timeRangeText,
    label: getSessionLabel(session || ({} as ScheduledSession), index),
    durationMinutes: subtask?.duration,
  };
}

/**
 * toggleSubtask
 * Handles toggling the completion state of a subtask.
 * Updates local state optimistically, persists to server, and reverts on failure.
 * Triggers task update notification and onAction callback.
 * @param params - Object containing taskId, subtaskId, and state management functions
 */
export const toggleSubtask = async ({
  taskId,
  subtaskId,
  completedParts,
  setCompletedParts,
  loadingParts,
  setLoadingParts,
  notifyTaskUpdate,
  notifyStatsChange,
  onAction,
}: {
  taskId: string;
  subtaskId: string;
  completedParts: Set<string>;
  setCompletedParts: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadingParts: Set<string>;
  setLoadingParts: React.Dispatch<React.SetStateAction<Set<string>>>;
  notifyTaskUpdate: (params: { taskId: string }, delayMs?: number) => void;
  notifyStatsChange?: (gamification?: GamificationResult) => void;
  onAction?: (action: string, data: any) => void;
}) => {
  const isCompleted = completedParts.has(subtaskId);
  const nextCompleted = !isCompleted;

  // Optimistically update UI state
  setCompletedParts((prev) => {
    const updated = new Set(prev);
    if (nextCompleted) updated.add(subtaskId);
    else updated.delete(subtaskId);
    return updated;
  });

  // Set loading state for this subtask
  setLoadingParts((prev) => new Set(prev).add(subtaskId));

  try {
    // Persist change to server
    const result = await updateSubTask(taskId, subtaskId, { status: nextCompleted ? "done" : "todo" });
    if (!result.success) throw new Error("Update failed");

    // Notify other components of task update
    notifyTaskUpdate({ taskId });
    // Also schedule a delayed notify to give backend time to settle and ensure list widgets refresh
    notifyTaskUpdate({ taskId }, 300);

    // If gamification data was returned, notify stats context
    if (result.gamification && notifyStatsChange) {
      notifyStatsChange(result.gamification);
    }

    // Trigger action callback for widget interactions
    onAction?.("subtask_toggled", { taskId, subtaskId, completed: nextCompleted, gamification: result.gamification });
  } catch (error) {
    // Revert optimistic update on failure
    setCompletedParts((prev) => {
      const updated = new Set(prev);
      if (isCompleted) updated.add(subtaskId);
      else updated.delete(subtaskId);
      return updated;
    });
  } finally {
    // Clear loading state
    setLoadingParts((prev) => {
      const updated = new Set(prev);
      updated.delete(subtaskId);
      return updated;
    });
  }
};

/**
 * toggleSession
 * Handles toggling the completion state of a session by finding its associated subtask.
 * Used in TaskDetailWidget where sessions are directly tied to subtasks.
 * Delegates to toggleSubtask after extracting the subtask ID.
 * @param params - Object containing session details and state management functions
 */
export const toggleSession = async ({
  taskId,
  session,
  index,
  subtasks,
  completedParts,
  setCompletedParts,
  loadingParts,
  setLoadingParts,
  notifyTaskUpdate,
  notifyStatsChange,
  onAction,
}: {
  taskId: string;
  session: ScheduledSession;
  index: number;
  subtasks?: Subtask[];
  completedParts: Set<string>;
  setCompletedParts: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadingParts: Set<string>;
  setLoadingParts: React.Dispatch<React.SetStateAction<Set<string>>>;
  notifyTaskUpdate: (params: { taskId: string }, delayMs?: number) => void;
  notifyStatsChange?: (gamification?: GamificationResult) => void;
  onAction?: (action: string, data: any) => void;
}) => {
  // Find the subtask ID associated with this session
  const subtaskId = getSubtaskIdFromSession(session, subtasks);
  if (!subtaskId) return;
  // Delegate to subtask toggle logic
  await toggleSubtask({
    taskId,
    subtaskId,
    completedParts,
    setCompletedParts,
    loadingParts,
    setLoadingParts,
    notifyTaskUpdate,
    onAction,
  });
};
