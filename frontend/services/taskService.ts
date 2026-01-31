/**
 * Task Service
 *
 * Handles task-related API calls and progress calculations.
 */

import { get, post, patch, del } from "./httpClient";

// Types
export type TaskStatus = "todo" | "in_progress" | "done";
export type SubTaskStatus = "todo" | "done";

export type ScheduledSession = {
  id?: string;
  taskId?: string;
  start?: string;
  end?: string;
  minutes?: number;
  status?: string;
  subtaskIndex?: number;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskStatus?: string;
};

export type SubTask = {
  _id: string;
  taskId: string;
  index?: number;
  title: string;
  description?: string;
  status?: SubTaskStatus;
  minutes?: number;
  scheduledSessions?: ScheduledSession[];
  completedAt?: string | null;
};

export type Task = {
  _id: string;
  userId: string;
  taskname: string;
  description?: string;
  category?: string;
  subCategory?: {
    label: string;
    source: string;
    confidence: number;
    updatedAt?: string;
  };
  status: TaskStatus;
  completed?: boolean;
  completedAt?: string | null;
  importance?: number;
  effort?: number;
  dueDate?: string;
  estimatedDuration?: number;
  taskType?: "perfect" | "in_parts" | "leaky";
  canSplit?: boolean;
  minChunk?: number | null;
  chunkCount?: number | null;
  chunkMinutes?: number | null;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  earliestStart?: string | null;
  priorityScore?: number;
  progressPercentage?: number;
  tags?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type TasksResponse = {
  success: boolean;
  count: number;
  tasks: Task[];
};

export type TaskProgress = {
  today: {
    total: number;
    completed: number;
    percentage: number;
  };
  week: {
    total: number;
    completed: number;
    percentage: number;
  };
  dailyProgress: number[]; // Last 14 days of completion percentages
  labels: string[];
};

export type TaskProgressData = {
  task: Task;
  subtasks: SubTask[];
  scheduledSessions?: ScheduledSession[];
  completedParts: number;
  totalParts: number;
  overallProgress: number;
  progressPercentage: number;
};

export type TaskProgressResponse = {
  success: boolean;
  data: TaskProgressData;
};

export type ScheduledDayGroup = {
  date: string | null;
  tasks: Array<{
    id: string;
    title: string;
    status?: TaskStatus;
    dueDate?: string | null;
    importance?: number;
    effort?: number;
    progressPercentage?: number;
    taskType?: string | null;
    category?: string | null;
    subcategory?: string | null;
    description?: string;
    estimatedDuration?: number;
    canSplit?: boolean;
    scheduledSessions?: ScheduledSession[];
  }>;
};

export type ScheduledTasksResponse = {
  success: boolean;
  days: number;
  today: ScheduledDayGroup;
  upcoming: ScheduledDayGroup[];
};

/**
 * Get all tasks for current user
 * GET /api/tasks
 */
export async function getTasks(filters?: {
  category?: string;
  completed?: boolean;
  dueBefore?: string;
  dueAfter?: string;
  search?: string;
}): Promise<Task[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.completed !== undefined) params.append("completed", String(filters.completed));
    if (filters?.dueBefore) params.append("dueBefore", filters.dueBefore);
    if (filters?.dueAfter) params.append("dueAfter", filters.dueAfter);
    if (filters?.search) params.append("search", filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `/tasks?${queryString}` : "/tasks";

    const response = await get<TasksResponse>(endpoint);
    return response.tasks || [];
  } catch (error) {
    console.warn("Failed to fetch tasks:", error);
    return [];
  }
}

/**
 * Get a single task by ID
 * GET /api/tasks/:id
 */
export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const response = await get<{ success: boolean; task: Task }>(`/tasks/${id}`);
    return response.task || null;
  } catch (error) {
    console.warn("Failed to fetch task:", error);
    return null;
  }
}

/**
 * Get overdue tasks
 * GET /api/tasks/overdue
 */
export async function getOverdueTasks(): Promise<Task[]> {
  try {
    const response = await get<{ success: boolean; tasks: Task[] }>(`/tasks/overdue`);
    return response.tasks || [];
  } catch (error) {
    console.warn("Failed to fetch overdue tasks:", error);
    return [];
  }
}

/**
 * Get task progress with subtasks and schedule
 * GET /api/tasks/:id/progress
 */
export async function getTaskProgress(id: string): Promise<TaskProgressData | null> {
  const maxRetries = 2; // number of retries after first failure

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await get<TaskProgressResponse>(`/tasks/${id}/progress`);
      return response.data || null;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      const isNotFound = error?.name === "ServerError" && (msg.includes("Task not found") || msg.includes("404"));

      // Retry a couple of times for transient 404s (eventual consistency after updates)
      if (isNotFound && attempt < maxRetries) {
        const delay = 150 * (attempt + 1);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // Otherwise log at debug level for diagnostics and return null
      console.debug(`Failed to fetch task progress for ${id}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * Get scheduled tasks grouped by day
 * GET /api/tasks/scheduled/:days?
 */
export async function getScheduledTasksByDay(days: number = 7): Promise<ScheduledTasksResponse | null> {
  try {
    const response = await get<ScheduledTasksResponse>(`/tasks/scheduled/${days}`);
    return response || null;
  } catch (error) {
    console.warn("Failed to fetch scheduled tasks:", error);
    return null;
  }
}

/**
 * Calculate task progress from tasks
 * Returns daily completion percentages for the progress graph
 *
 * If `scheduledTodayIds` is provided, today's task counts are taken from the scheduled tasks
 * (i.e., tasks that have scheduled sessions for today) instead of checking `dueDate`.
 */
export function calculateTaskProgress(tasks: Task[], days: number = 14, scheduledInfo?: { taskIds?: Set<string>; subtaskKeys?: Set<string> }): TaskProgress {
  const now = new Date();
  const dailyProgress: number[] = [];
  const labels: string[] = [];

  // Calculate progress for each of the last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    // For historical days, count completed units (tasks and subtasks completed on that day)
    // and approximate total units as tasks due that day (tasks without subtasks) plus subtasks
    // whose parent task is due that day or which were completed that day.

    // Tasks due that day (only count tasks without subtasks)
    const tasksDueNoSubtasks = tasks.filter((task) => {
      if (task.subCategory || (task as any).subTasks) {
        // don't rely on subCategory; check subTasks explicitly
      }
      const hasSubtasks = Array.isArray((task as any).subTasks) && (task as any).subTasks.length > 0;
      if (hasSubtasks) return false;
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= date && dueDate < nextDate;
    });

    // Subtasks completed on this day
    let subtasksCompletedOnDay = 0;
    // Subtasks whose parent task's due date is this day (treat as scheduled for the day)
    let subtasksWithParentDueOnDay = 0;

    for (const task of tasks) {
      const subTasks = (task as any).subTasks || [];
      if (!Array.isArray(subTasks) || subTasks.length === 0) continue;

      for (const st of subTasks) {
        // completedAt wins for counting completion day
        if (st?.completedAt) {
          const completedAt = new Date(st.completedAt);
          if (completedAt >= date && completedAt < nextDate) subtasksCompletedOnDay += 1;
        }
        // if parent task has dueDate matching the day, count subtask as a scheduled unit
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          if (dueDate >= date && dueDate < nextDate) subtasksWithParentDueOnDay += 1;
        }
      }
    }

    // Total units for the day: tasks without subtasks due that day + subtasks scheduled (by parent due) + subtasks completed that day (if not already counted)
    // To avoid double-counting, ensure we count unique subtasks only once.
    const totalUnits = tasksDueNoSubtasks.length + Math.max(subtasksWithParentDueOnDay, subtasksCompletedOnDay);
    const completedUnits =
      // tasks completed on this day
      tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= date && new Date(t.completedAt) < nextDate).length +
      subtasksCompletedOnDay;

    const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
    dailyProgress.push(percentage);

    // Format label (e.g., "Mon", "Tue")
    labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));
  }

  // Calculate today's progress - include ALL tasks (with or without dueDate)
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Determine today's units. If scheduledInfo is provided, prefer scheduled tasks and subtasks for today
  let todayTotal = 0;
  let todayCompleted = 0;

  if (scheduledInfo && (scheduledInfo.taskIds?.size || scheduledInfo.subtaskKeys?.size)) {
    const taskIds = scheduledInfo.taskIds || new Set<string>();
    const subtaskKeys = scheduledInfo.subtaskKeys || new Set<string>();

    // Count scheduled subtasks as individual units
    for (const task of tasks) {
      const subs: any[] = (task as any).subTasks || [];
      // count subtasks scheduled today
      for (let idx = 0; idx < subs.length; idx++) {
        const key = `${task._id}:${subs[idx].index ?? idx}`;
        if (subtaskKeys.has(key)) {
          todayTotal += 1;
          // completed if status done or completedAt within today
          const completedAt = subs[idx]?.completedAt ? new Date(subs[idx].completedAt) : null;
          if (subs[idx].status === "done" && completedAt && completedAt >= todayStart && completedAt < todayEnd) {
            todayCompleted += 1;
          }
        }
      }

      // If task has no subtasks but is scheduled today, treat the task as a unit
      const hasSubtasks = Array.isArray((task as any).subTasks) && (task as any).subTasks.length > 0;
      if (!hasSubtasks && taskIds.has(task._id)) {
        todayTotal += 1;
        const completedAt = task?.completedAt ? new Date(task.completedAt) : null;
        if ((task.status === "done" || task.completed) && completedAt && completedAt >= todayStart && completedAt < todayEnd) {
          todayCompleted += 1;
        }
      }
    }
  } else {
    // Fallback: Tasks due today OR tasks without dueDate that were created today
    const todayTasks = tasks.filter((task) => {
      // If has dueDate, check if it's today
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        return dueDate >= todayStart && dueDate < todayEnd;
      }
      // If no dueDate, check if created today (consider it a "today" task)
      const createdAt = new Date(task.createdAt);
      return createdAt >= todayStart && createdAt < todayEnd;
    });

    // Count tasks and subtasks: tasks without subtasks count as 1, tasks with subtasks count each subtask as a unit
    for (const task of todayTasks) {
      const subs: any[] = (task as any).subTasks || [];
      if (subs.length > 0) {
        todayTotal += subs.length;
        for (const st of subs) {
          const completedAt = st?.completedAt ? new Date(st.completedAt) : null;
          if (st.status === "done" && completedAt && completedAt >= todayStart && completedAt < todayEnd) {
            todayCompleted += 1;
          }
        }
      } else {
        todayTotal += 1;
        const completedAt = task?.completedAt ? new Date(task.completedAt) : null;
        if ((task.status === "done" || task.completed) && completedAt && completedAt >= todayStart && completedAt < todayEnd) {
          todayCompleted += 1;
        }
      }
    }
  }

  // Calculate week's progress using Sunday -> Saturday boundaries
  // Determine the start of the current week (Sunday 00:00)
  const today = new Date(now);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const sundayStart = new Date(today);
  sundayStart.setDate(today.getDate() - dayOfWeek);
  sundayStart.setHours(0, 0, 0, 0);

  // End of week (exclusive) is next Sunday 00:00 (i.e., Saturday inclusive)
  const weekEndExclusive = new Date(sundayStart);
  weekEndExclusive.setDate(sundayStart.getDate() + 7);

  const weekTasks = tasks.filter((task) => {
    // If has dueDate, check if it's within [sundayStart, weekEndExclusive)
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      return dueDate >= sundayStart && dueDate < weekEndExclusive;
    }
    // If no dueDate, check if created within the week range
    const createdAt = new Date(task.createdAt);
    return createdAt >= sundayStart && createdAt < weekEndExclusive;
  });

  // If no tasks in the week range, use all tasks as a fallback
  const effectiveWeekTasks = weekTasks.length > 0 ? weekTasks : tasks;
  const weekCompleted = effectiveWeekTasks.filter((t) => t.status === "done" || t.completed === true).length;

  return {
    today: {
      total: todayTotal,
      completed: todayCompleted,
      percentage: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
    },
    week: {
      total: effectiveWeekTasks.length,
      completed: weekCompleted,
      percentage: effectiveWeekTasks.length > 0 ? Math.round((weekCompleted / effectiveWeekTasks.length) * 100) : 0,
    },
    dailyProgress,
    labels,
  };
}

/**
 * Create a new task
 * POST /api/tasks
 */
export async function createTask(taskData: {
  taskname: string;
  description?: string;
  category?: string;
  importance?: number;
  effort?: number;
  deadline?: string; // Backend expects 'deadline' not 'dueDate'
  estimatedMinutes?: number;
  tags?: string[];
  subtasks?: Array<{
    title: string;
    description?: string;
    minutes?: number;
  }>;
}): Promise<Task | null> {
  try {
    const response = await post<{ success: boolean; task: Task }>("/tasks", taskData);
    return response.task || null;
  } catch (error) {
    console.warn("Failed to create task:", error);
    throw error;
  }
}

/**
 * Suggest category and subcategory based on task name
 * POST /api/tasks/suggest-category
 */
export async function suggestCategory(taskname: string): Promise<{
  category: string;
  subCategory: string | null;
} | null> {
  try {
    const response = await post<{
      success: boolean;
      category: string;
      subCategory: string | null;
    }>("/tasks/suggest-category", { taskname });

    if (response.success) {
      return {
        category: response.category,
        subCategory: response.subCategory,
      };
    }
    return null;
  } catch (error) {
    console.warn("Failed to suggest category:", error);
    return null;
  }
}

/**
 * Complete a task
 * POST /api/tasks/:id/complete
 */
export async function completeTask(id: string): Promise<Task | null> {
  try {
    console.log(`[taskService] Completing task: ${id}`);
    const response = await post<{ success: boolean; task: Task; gamification?: any }>(`/tasks/${id}/complete`, {});
    console.log(`[taskService] Complete response:`, response);
    if (response.gamification) {
      console.log(`[taskService] Gamification updated:`, response.gamification);
    }
    return response.task || null;
  } catch (error) {
    console.error("[taskService] Failed to complete task:", error);
    return null;
  }
}

/**
 * Toggle task completion
 * POST /api/tasks/:id/toggle
 */
export async function toggleTaskCompletion(id: string): Promise<Task | null> {
  try {
    const response = await post<{ success: boolean; task: Task }>(`/tasks/${id}/toggle`, {});
    return response.task || null;
  } catch (error) {
    console.warn("Failed to toggle task:", error);
    return null;
  }
}

/**
 * Update a task
 * PATCH /api/tasks/:id
 */
export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, "_id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<Task | null> {
  try {
    const response = await patch<{ success: boolean; task: Task }>(`/tasks/${id}`, updates);
    return response.task || null;
  } catch (error) {
    console.warn("Failed to update task:", error);
    return null;
  }
}

/**
 * Update a subtask
 * PATCH /api/tasks/:taskId/subtasks/:subId
 * Returns gamification data when subtask is completed
 */
export async function updateSubTask(
  taskId: string,
  subtaskId: string,
  updates: Partial<{ status: SubTaskStatus; title?: string; description?: string; minutes?: number }>,
): Promise<boolean> {
  try {
    const response = await patch<{
      success: boolean;
      gamification?: { points: number; currentStreak: number };
      pointsAwarded?: number;
      parentTaskCompleted?: boolean;
    }>(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);

    // Log gamification data if subtask was completed
    if (response.gamification) {
      console.log("[taskService] Subtask completion gamification:", {
        pointsAwarded: response.pointsAwarded,
        totalPoints: response.gamification.points,
        streak: response.gamification.currentStreak,
        parentTaskCompleted: response.parentTaskCompleted,
      });
    }

    return true;
  } catch (error) {
    console.warn("Failed to update subtask:", error);
    return false;
  }
}

/**
 * Update a subtask status (deprecated) — use updateSubTask instead
 */
export async function updateSubTaskStatus(taskId: string, subtaskId: string, status: SubTaskStatus): Promise<boolean> {
  return updateSubTask(taskId, subtaskId, { status });
}

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
export async function deleteTask(id: string): Promise<boolean> {
  try {
    await del<{ success: boolean }>(`/tasks/${id}`);
    return true;
  } catch (error) {
    console.warn("Failed to delete task:", error);
    return false;
  }
}

export default {
  createTask,
  getTasks,
  getTaskById,
  getOverdueTasks,
  getTaskProgress,
  getScheduledTasksByDay,
  calculateTaskProgress,
  completeTask,
  toggleTaskCompletion,
  updateTask,
  updateSubTask,
  updateSubTaskStatus,
  deleteTask,
  suggestCategory,
};
