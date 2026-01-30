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
}

/**
 * TaskGroup interface for date-based organization
 */
export interface TaskGroup {
  date: string;
  tasks: Task[];
}
