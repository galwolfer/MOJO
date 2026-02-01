import { COLORS } from "../../theme";
import { SVG_DATA_URIS } from "../icons/svg-data-uris";
import { ScheduledSession, Subtask, toggleSession } from "./taskHelpers";

export {
  Subtask,
  ScheduledSession,
  getSubtaskIdFromSession,
  formatDate,
  formatDateTime,
  formatTimeRange,
  getStatusStyle,
  getImportanceLabel,
  getEffortLabel,
  formatDuration,
  importanceColorIndex,
  importanceIcon,
  effortColor,
  effortIcon,
  getTaskTypeLabel,
  getSessionLabel,
  getSessionKey,
  getTimeParts,
  getColoredDataUri,
  getCategoryDisplay,
  computeTaskProgress,
  sessionRowData,
  toggleSubtask,
  toggleSession,
} from "./taskHelpers";

export type WidgetEntranceProps = {
  entranceEnabled?: boolean;
  entranceDelay?: number;
  entranceDuration?: number;
  skipAnimation?: boolean;
};

export const getWidgetEntranceProps = (
  { entranceEnabled, entranceDelay, entranceDuration, skipAnimation }: WidgetEntranceProps,
  options?: { skipAnimation?: boolean },
) => ({
  // Default entranceEnabled to true so widgets animate in by default unless explicitly disabled
  entranceEnabled: entranceEnabled ?? true,
  entranceDelay,
  entranceDuration,
  skipAnimation: skipAnimation ?? options?.skipAnimation ?? false,
});

/**
 * handleTaskPress
 * Centralized handler for selecting/collapsing tasks from list widgets
 */
export const handleTaskPress = ({
  taskId,
  selectedTaskId,
  setSelectedTaskId,
  onAction,
}: {
  taskId: string;
  selectedTaskId: string | null;
  setSelectedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  onAction?: (action: string, data: any) => void;
}) => {
  // Ensure only one task is selected at a time; tapping same task collapses it
  setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  onAction?.("task_selected", { taskId });
};

/**
 * toggleSessionSmart
 * Wrapper to toggle a scheduled session:
 * - If the session maps to a real subtask (via subtaskId or subtaskIndex), delegate to `toggleSession` so the subtask is persisted.
 * - If no subtask exists, `toggleSession` will toggle the entire task completion.
 */
export const toggleSessionSmart = async ({
  taskId,
  session,
  index,
  subtasks,
  completedParts,
  setCompletedParts,
  loadingParts,
  setLoadingParts,
  notifyTaskUpdate,
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
  onAction?: (action: string, data: any) => void;
}) => {
  // Delegate to toggleSession which handles both subtask and no-subtask cases
  await toggleSession({
    taskId,
    session,
    index,
    subtasks,
    completedParts,
    setCompletedParts,
    loadingParts,
    setLoadingParts,
    notifyTaskUpdate,
    onAction,
  });
};
