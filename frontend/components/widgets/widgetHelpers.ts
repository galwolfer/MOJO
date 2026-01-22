import { COLORS } from "../../theme";
import { SVG_DATA_URIS } from "../icons/svg-data-uris";

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

export function getSubtaskIdFromSession(session?: ScheduledSession, subtasks?: Subtask[]) {
  if (!session) return undefined;
  if ((session as any).subtaskId) return (session as any).subtaskId;
  if (typeof session.subtaskIndex === "number" && subtasks) {
    const found = subtasks.find((st) => st.order === session.subtaskIndex || st.order === session.subtaskIndex);
    return found?.id;
  }
  return undefined;
}

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

export const getStatusStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "done":
    case "completed":
      return COLORS.primary6;
    case "in_progress":
    case "in progress":
      return COLORS.primary1;
    case "pending":
    case "todo":
      return COLORS.primary5;
    default:
      return COLORS.darkGray;
  }
};

export const getImportanceLabel = (importance?: number) => {
  if (!importance) return "Not set";
  const labels = ["", "Low ", "Medium-Low ", "Medium ", "High ", "Critical"];
  return labels[importance] || `Priority ${importance}`;
};

export const getEffortLabel = (effort?: number) => {
  if (!effort) return "Not set";
  const labels = ["", "Minimal ", "Light ", "Moderate ", "Heavy ", "Extensive "];
  return labels[effort] || `Level ${effort}`;
};

export const formatDuration = (minutes?: number) => {
  if (!minutes) return "Not set";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const getTaskTypeLabel = (taskType?: string, canSplit?: boolean) => {
  if (taskType === "in_parts") return "Split into parts";
  if (taskType === "leaky") return "Flexible timing";
  if (canSplit) return "Can be split";
  return "Single block";
};

export const getSessionLabel = (session: ScheduledSession, index?: number) => {
  if (session.subtaskTitle) return session.subtaskTitle;
  if (session.subtaskIndex) return `Part ${session.subtaskIndex}`;
  if (typeof index === "number") return `Session ${index + 1}`;
  return `Session`;
};

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
 * sessionRowData
 * Extracts the display-friendly pieces for a scheduled session row.
 * Keeps rendering logic in components clean and testable.
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
