// Shared types used by create/edit task screens

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  minutes?: string;
  index?: number;
  scheduleMode?: "auto" | "manual";
  sessionId?: string;
  sessionDate?: string;
  sessionStartTime?: string;
  sessionEndTime?: string;
}

export interface TaskFormState {
  taskName: string;
  timeToComplete: string;
  effort: number;
  importance: number;
  category: string;
  subCategoryId: string | null;
  description: string;
  estimatedMinutes: string;
  numSubtasks: number;
  subtasks: Subtask[];
}

// Editable session used in EditTask when editing schedules
export interface EditableSession {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  // extend as needed
}
