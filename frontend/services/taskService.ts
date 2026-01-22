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
  try {
    const response = await get<TaskProgressResponse>(`/tasks/${id}/progress`);
    return response.data || null;
  } catch (error) {
    console.warn("Failed to fetch task progress:", error);
    return null;
  }
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
 */
export function calculateTaskProgress(tasks: Task[], days: number = 14): TaskProgress {
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

    // Get tasks that were due on this day (if they have dueDate)
    const dayTasksWithDue = tasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= date && dueDate < nextDate;
    });

    // Get tasks created on this specific day (as fallback)
    const tasksCreatedOnDay = tasks.filter((task) => {
      const createdAt = new Date(task.createdAt);
      createdAt.setHours(0, 0, 0, 0);
      return createdAt >= date && createdAt < nextDate;
    });

    // Use tasks with due dates if available, otherwise use created tasks
    const dayTasks = dayTasksWithDue.length > 0 ? dayTasksWithDue : tasksCreatedOnDay;

    // Calculate completion rate
    const total = dayTasks.length;
    const completed = dayTasks.filter((t) => t.status === "done" || t.completed === true).length;

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    dailyProgress.push(percentage);

    // Format label (e.g., "Mon", "Tue")
    labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));
  }

  // Calculate today's progress - include ALL tasks (with or without dueDate)
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Tasks due today OR tasks without dueDate that were created today
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

  // Only count tasks that are actually due today (or created today with no due date)
  const todayTotal = todayTasks.length;
  const todayCompleted = todayTasks.filter((t) => t.status === "done" || t.completed === true).length;

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
 */
export async function updateSubTask(
  taskId: string,
  subtaskId: string,
  updates: Partial<{ status: SubTaskStatus; title?: string; description?: string; minutes?: number }>,
): Promise<boolean> {
  try {
    await patch<{ success: boolean }>(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);
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
