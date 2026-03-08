/**
 * Shared types for task create/edit forms.
 * Consumed by EditTask, CreateTask, and the extracted section components.
 */

// Shared types used by create/edit task screens

export interface Subtask {
  id: string;
  title: string;
  description: string;
  /** Estimated minutes as a string (matches controlled <Input type="number"> value) */
  minutes: string;
  /** 1-based order within the parent task */
  index?: number;

  // ── Schedule fields (populated in edit mode) ──────────────────────────────
  /** "auto" = scheduler decides the time; "manual" = user picks date/time */
  scheduleMode?: "auto" | "manual";
  /** Backend session _id when a session already exists */
  sessionId?: string;
  /** YYYY-MM-DD in user local time */
  sessionDate?: string;
  /** HH:MM (24-hour) in user local time */
  sessionStartTime?: string;
  /** HH:MM (24-hour) in user local time */
  sessionEndTime?: string;
}

export interface TaskFormState {
  taskName: string;
  timeToComplete: string;
  effort: number;
  importance: number;
  category: string;
  /** Selected subcategory ID (MongoDB ObjectId string) or null if none selected */
  subCategoryId: string | null;
  description: string;
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];
}

/** One row in the manual schedule editor */
export interface EditableSession {
  /** Backend _id when the session already exists in the DB */
  id?: string;
  /** YYYY-MM-DD in user local time — the day the session starts */
  date: string;
  /** HH:MM in user local time (24-hour) */
  startTime: string;
  /**
   * YYYY-MM-DD in user local time — the day the session ends.
   * Defaults to `date` (same day) when undefined.
   * Set explicitly for overnight sessions (e.g. 21:00 → 05:00 next day).
   */
  endDate?: string;
  /** HH:MM in user local time (24-hour) */
  endTime: string;
  subtaskIndex?: number | null;
}
