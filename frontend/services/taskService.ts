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

  // Helper to check if a date falls within a day range
  const isWithinDay = (date: Date | string | null | undefined, dayStart: Date, dayEnd: Date): boolean => {
    if (!date) return false;
    const d = new Date(date);
    return d >= dayStart && d < dayEnd;
  };

  // Helper to check if completed before a day started
  const isCompletedBefore = (completedAt: Date | string | null | undefined, dayStart: Date): boolean => {
    if (!completedAt) return false;
    return new Date(completedAt) < dayStart;
  };

  // Helper to check if a task/subtask has a scheduled session on a specific day
  const hasScheduledSessionOnDay = (sessions: any[] | undefined, dayStart: Date, dayEnd: Date): boolean => {
    if (!sessions || !Array.isArray(sessions)) return false;
    return sessions.some(session => {
      if (!session?.start) return false;
      const sessionStart = new Date(session.start);
      return sessionStart >= dayStart && sessionStart < dayEnd;
    });
  };

  // Calculate progress for each of the last N days
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const isToday = i === 0;

    let totalUnits = 0;
    let completedUnits = 0;

    for (const task of tasks) {
      const subTasks: any[] = (task as any).subTasks || [];
      const hasSubtasks = subTasks.length > 0;

      if (hasSubtasks) {
        // For tasks with subtasks, each subtask is a unit
        for (const st of subTasks) {
          const stCompletedAt = st?.completedAt;
          const stIsDone = st?.status === "done";
          const wasCompletedOnThisDay = isWithinDay(stCompletedAt, dayStart, dayEnd);
          const assumeCompletedToday = isToday && stIsDone && !stCompletedAt;
          
          // Check if subtask has a scheduled session on this day
          const isSubtaskScheduledForDay = hasScheduledSessionOnDay(st?.scheduledSessions, dayStart, dayEnd);
          
          // Count in total if:
          // 1. Scheduled for this day AND not completed before this day started, OR
          // 2. Was completed on this day (so it shows as work done on this day)
          if (isSubtaskScheduledForDay && !isCompletedBefore(stCompletedAt, dayStart)) {
            totalUnits += 1;
            if (wasCompletedOnThisDay || assumeCompletedToday) {
              completedUnits += 1;
            }
          } else if (wasCompletedOnThisDay || assumeCompletedToday) {
            // Completed on this day but wasn't scheduled for it - count as both total and completed
            totalUnits += 1;
            completedUnits += 1;
          }
        }
      } else {
        // Task without subtasks - check task-level scheduled sessions
        const taskCompletedAt = task.completedAt;
        const taskIsDone = task.status === "done" || task.completed === true;
        const wasCompletedOnThisDay = isWithinDay(taskCompletedAt, dayStart, dayEnd);
        const assumeCompletedToday = isToday && taskIsDone && !taskCompletedAt;
        
        // Check if task has a scheduled session on this day
        const isTaskScheduledForDay = hasScheduledSessionOnDay((task as any).scheduledSessions, dayStart, dayEnd);

        // Count in total if:
        // 1. Scheduled for this day AND not completed before this day started, OR
        // 2. Was completed on this day (so it shows as work done on this day)
        if (isTaskScheduledForDay && !isCompletedBefore(taskCompletedAt, dayStart)) {
          totalUnits += 1;
          if (wasCompletedOnThisDay || assumeCompletedToday) {
            completedUnits += 1;
          }
        } else if (wasCompletedOnThisDay || assumeCompletedToday) {
          // Completed on this day but wasn't scheduled for it - count as both total and completed
          totalUnits += 1;
          completedUnits += 1;
        }
      }
    }

    // Calculate percentage - cap at 100% to handle edge cases
    const percentage = totalUnits > 0 ? Math.min(100, Math.round((completedUnits / totalUnits) * 100)) : 0;
    dailyProgress.push(percentage);

    // Format label (e.g., "Mon", "Tue")
    labels.push(dayStart.toLocaleDateString("en-US", { weekday: "short" }));
  }

  // Calculate today's progress using scheduled info if available
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let todayTotal = 0;
  let todayCompleted = 0;

  if (scheduledInfo && (scheduledInfo.taskIds?.size || scheduledInfo.subtaskKeys?.size)) {
    // Use scheduled info for more accurate today calculations
    const taskIds = scheduledInfo.taskIds || new Set<string>();
    const subtaskKeys = scheduledInfo.subtaskKeys || new Set<string>();

    for (const task of tasks) {
      const subs: any[] = (task as any).subTasks || [];
      const taskId = task._id || (task as any).id;
      const hasSubtasks = subs.length > 0;

      if (hasSubtasks) {
        // Check each subtask
        for (let idx = 0; idx < subs.length; idx++) {
          const st = subs[idx];
          const keyWithUnderscore = `${task._id}:${st.index ?? idx}`;
          const keyWithId = `${(task as any).id}:${st.index ?? idx}`;
          const isScheduledToday = subtaskKeys.has(keyWithUnderscore) || subtaskKeys.has(keyWithId);

          if (isScheduledToday) {
            const stCompletedAt = st?.completedAt;
            const stIsDone = st?.status === "done";

            // Only count in total if NOT completed before today
            if (!isCompletedBefore(stCompletedAt, todayStart)) {
              todayTotal += 1;

              // Count as completed only if completed TODAY
              if (isWithinDay(stCompletedAt, todayStart, todayEnd)) {
                todayCompleted += 1;
              } else if (stIsDone && !stCompletedAt) {
                // Done but no timestamp - assume today
                todayCompleted += 1;
              }
            }
          }
        }
      } else {
        // Task without subtasks
        const isScheduledToday = taskIds.has(task._id) || taskIds.has(taskId);

        if (isScheduledToday) {
          const taskCompletedAt = task.completedAt;
          const taskIsDone = task.status === "done" || task.completed === true;

          // Only count in total if NOT completed before today
          if (!isCompletedBefore(taskCompletedAt, todayStart)) {
            todayTotal += 1;

            // Count as completed only if completed TODAY
            if (isWithinDay(taskCompletedAt, todayStart, todayEnd)) {
              todayCompleted += 1;
            } else if (taskIsDone && !taskCompletedAt) {
              // Done but no timestamp - assume today
              todayCompleted += 1;
            }
          }
        }
      }
    }
  } else {
    // Fallback: use scheduledSessions to determine what's scheduled for today
    for (const task of tasks) {
      const subs: any[] = (task as any).subTasks || [];
      const hasSubtasks = subs.length > 0;

      if (hasSubtasks) {
        for (const st of subs) {
          const stCompletedAt = st?.completedAt;
          const stIsDone = st?.status === "done";
          const isSubtaskScheduledToday = hasScheduledSessionOnDay(st?.scheduledSessions, todayStart, todayEnd);
          const wasCompletedToday = isWithinDay(stCompletedAt, todayStart, todayEnd);
          const assumeCompletedToday = stIsDone && !stCompletedAt;

          // Count if scheduled today and not completed before today, OR completed today
          if (isSubtaskScheduledToday && !isCompletedBefore(stCompletedAt, todayStart)) {
            todayTotal += 1;
            if (wasCompletedToday || assumeCompletedToday) {
              todayCompleted += 1;
            }
          } else if (wasCompletedToday || assumeCompletedToday) {
            // Completed today but wasn't scheduled - count as both
            todayTotal += 1;
            todayCompleted += 1;
          }
        }
      } else {
        const taskCompletedAt = task.completedAt;
        const taskIsDone = task.status === "done" || task.completed === true;
        const isTaskScheduledToday = hasScheduledSessionOnDay((task as any).scheduledSessions, todayStart, todayEnd);
        const wasCompletedToday = isWithinDay(taskCompletedAt, todayStart, todayEnd);
        const assumeCompletedToday = taskIsDone && !taskCompletedAt;

        // Count if scheduled today and not completed before today, OR completed today
        if (isTaskScheduledToday && !isCompletedBefore(taskCompletedAt, todayStart)) {
          todayTotal += 1;
          if (wasCompletedToday || assumeCompletedToday) {
            todayCompleted += 1;
          }
        } else if (wasCompletedToday || assumeCompletedToday) {
          // Completed today but wasn't scheduled - count as both
          todayTotal += 1;
          todayCompleted += 1;
        }
      }
    }
  }

  // Calculate today's percentage
  const todayPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // Update the last element of dailyProgress to match today's calculated values
  if (dailyProgress.length > 0) {
    dailyProgress[dailyProgress.length - 1] = todayPercentage;
  }

  // Calculate week's progress
  const today = new Date(now);
  const dayOfWeek = today.getDay();
  const sundayStart = new Date(today);
  sundayStart.setDate(today.getDate() - dayOfWeek);
  sundayStart.setHours(0, 0, 0, 0);

  const weekEndExclusive = new Date(sundayStart);
  weekEndExclusive.setDate(sundayStart.getDate() + 7);

  // Count tasks scheduled for this week and their completion status
  let weekTotal = 0;
  let weekCompleted = 0;

  // Helper to check if any scheduled session falls within the week
  const hasScheduledSessionInWeek = (sessions: any[] | undefined): boolean => {
    if (!sessions || !Array.isArray(sessions)) return false;
    return sessions.some(session => {
      if (!session?.start) return false;
      const sessionStart = new Date(session.start);
      return sessionStart >= sundayStart && sessionStart < weekEndExclusive;
    });
  };

  for (const task of tasks) {
    const subs: any[] = (task as any).subTasks || [];
    const hasSubtasks = subs.length > 0;

    if (hasSubtasks) {
      for (const st of subs) {
        const isScheduledThisWeek = hasScheduledSessionInWeek(st?.scheduledSessions);
        const wasCompletedThisWeek = st?.completedAt && isWithinDay(st.completedAt, sundayStart, weekEndExclusive);
        
        if (isScheduledThisWeek || wasCompletedThisWeek) {
          weekTotal += 1;
          if (st?.status === "done") {
            weekCompleted += 1;
          }
        }
      }
    } else {
      const isScheduledThisWeek = hasScheduledSessionInWeek((task as any).scheduledSessions);
      const wasCompletedThisWeek = task.completedAt && isWithinDay(task.completedAt, sundayStart, weekEndExclusive);
      
      if (isScheduledThisWeek || wasCompletedThisWeek) {
        weekTotal += 1;
        if (task.status === "done" || task.completed === true) {
          weekCompleted += 1;
        }
      }
    }
  }

  return {
    today: {
      total: todayTotal,
      completed: todayCompleted,
      percentage: todayPercentage,
    },
    week: {
      total: weekTotal,
      completed: weekCompleted,
      percentage: weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0,
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
