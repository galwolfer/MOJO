/**
 * Calendar Types
 *
 * Type definitions for the Calendar screen and its components.
 */

/**
 * Subtask interface
 */
export interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  timeRange?: string; // Time interval for scheduled sessions (e.g., "09:00 AM - 10:30 AM")
}

/**
 * Task interface with category support
 */
export interface Task {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  emoji: string;
  tags: string[];
  dueDate: string;
  description: string;
  completed: boolean;
  color: string;
  category?: string;
  subtasks?: Subtask[];
  dateString?: string; // Date in YYYY-MM-DD format for filtering
  partNumber?: number; // Part number for multi-day tasks
  totalParts?: number; // Total parts for multi-day tasks
  parentTaskName?: string; // Parent task name for multi-day subtasks
  // --- Scheduled-session fields (populated by getScheduledSessionsForDate) ---
  taskId?: string; // Actual MongoDB task _id (session id lives in `id`)
  status?: string; // "todo" | "in_progress" | "done"
  isScheduled?: boolean; // True when sourced from a TaskSchedule document
  progressPercentage?: number; // Server-side completion 0-100
  mainTaskDescription?: string; // Parent task description for multi-part sessions
  importance?: number; // 1-5 importance level
  effort?: number; // 1-5 effort level
  subcategoryDisplay?: string;
  subCategory?: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    parent?: string;
    source?: string;
  } | null;
  estimatedDuration?: number;
  earliestStart?: string; // ISO date string
  deadline?: string; // ISO date string (from dueDate)
}

/**
 * TaskGroup interface for date-based organization
 */
export interface TaskGroup {
  date: string;
  tasks: Task[];
}
