/**
 * Shared types for task create/edit forms.
 * Consumed by EditTask, CreateTask, and the extracted section components.
 */

export interface Subtask {
  id: string;
  title: string;
  description: string;
  /** Estimated minutes as a string (matches controlled <Input type="number"> value) */
  minutes: string;
  /** 1-based order within the parent task */
  index?: number;
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
  /** YYYY-MM-DD in user local time */
  date: string;
  /** HH:MM in user local time (24-hour) */
  startTime: string;
  /** HH:MM in user local time (24-hour) */
  endTime: string;
  subtaskIndex?: number | null;
}
