/**
 * Task Service
 *
 * Handles task-related API calls and progress calculations.
 * Also provides transformations for converting API tasks to Calendar format.
 */

import { get, post, patch, del } from "./httpClient";
import { getCategoryMeta } from "../config/categoryMeta";

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

export type SubcategoryRef = {
  _id?: string;
  id?: string;
  name?: string;
  label?: string;
  parent?: string;
  icon?: string | null;
  color?: string | null;
  source?: string;
  confidence?: number;
  updatedAt?: string;
};

export type Task = {
  _id: string;
  userId: string;
  taskname: string;
  description?: string;
  category?: string;
  subCategory?: SubcategoryRef | null;
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
  tags?: string[];
  progressPercentage?: number;
  subtasks?: SubTask[];
  scheduledSessions?: ScheduledSession[];
  createdAt: string;
  updatedAt: string;
};

export type TasksResponse = {
  success: boolean;
  count: number;
  tasks: TaskWithSubtasks[];
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

// Scheduling helpers are defined later in the file alongside other API calls
// ─────────────────────────────────────────────────────────────────────────

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
    subCategory?: SubcategoryRef | null;
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
}): Promise<TaskWithSubtasks[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.completed !== undefined) params.append("completed", String(filters.completed));
    if (filters?.dueBefore) params.append("dueBefore", filters.dueBefore);
    if (filters?.dueAfter) params.append("dueAfter", filters.dueAfter);
    if (filters?.search) params.append("search", filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `/tasks?${queryString}` : "/tasks";

    console.log("[getTasks] Fetching from:", endpoint);
    const response = await get<TasksResponse>(endpoint);
    console.log("[getTasks] Raw response:", JSON.stringify(response, null, 2));
    const tasks = response.tasks || [];

    // Map subTasks to subtasks for consistent naming across frontend
    return tasks.map((task: any) => ({
      ...task,
      subtasks: task.subTasks || task.subtasks || [],
    }));
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
    const raw = response.task || null;
    if (raw) {
      const subTasks: any[] = (raw as any).subTasks || raw.subtasks || [];

      // Aggregate scheduledSessions from each subTask when the API doesn't include
      // a top-level array (single-task endpoint may omit it).
      const topSessions: any[] = (raw as any).scheduledSessions || [];
      const aggregatedSessions: any[] =
        topSessions.length > 0
          ? topSessions
          : subTasks.flatMap((st: any) =>
              (st.scheduledSessions || []).map((s: any) => ({
                ...s,
                subtaskIndex: st.index ?? st.order,
                subtaskTitle: st.title,
                subtaskId: st._id || st.id,
              })),
            );

      // Guard: subCategory may be an unpopulated ObjectId string
      const subCatRaw = (raw as any).subCategory;
      const subCategory = subCatRaw && typeof subCatRaw === "object" ? subCatRaw : undefined;

      return {
        ...raw,
        subCategory,
        subtasks: subTasks,
        scheduledSessions: aggregatedSessions,
      } as Task;
    }
    return null;
  } catch (error) {
    console.warn("Failed to fetch task:", error);
    return null;
  }
}

/**
 * Decline overdue tasks – increments the dismiss counter for each task.
 * After 3 declines a task will no longer appear in the overdue popup.
 * POST /api/tasks/overdue/decline
 */
export async function declineOverdueTasks(taskIds: string[]): Promise<boolean> {
  try {
    await post<{ success: boolean }>(`/tasks/overdue/decline`, { taskIds });
    return true;
  } catch (error) {
    console.warn("Failed to register overdue decline:", error);
    return false;
  }
}

/**
 * Get overdue tasks
 * GET /api/tasks/overdue
 */
export async function getOverdueTasks(): Promise<Task[]> {
  try {
    const response = await get<{ success: boolean; tasks: Task[] }>(`/tasks/overdue`);
    const tasks = response.tasks || [];

    // Map subTasks to subtasks for consistent naming across frontend
    return tasks.map((task: any) => ({
      ...task,
      subtasks: task.subTasks || task.subtasks || [],
    }));
  } catch (error) {
    console.warn("Failed to fetch overdue tasks:", error);
    return [];
  }
}

/**
 * Extend a task's deadline
 * PATCH /api/tasks/expired/:id/extend
 */
export async function extendTaskDeadline(id: string, newDeadline: string): Promise<boolean> {
  try {
    await patch<{ success: boolean }>(`/tasks/expired/${id}/extend`, { newDeadline });
    return true;
  } catch (error) {
    console.warn("Failed to extend task deadline:", error);
    return false;
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
export function calculateTaskProgress(
  tasks: Task[],
  days: number = 14,
  scheduledInfo?: { taskIds?: Set<string>; subtaskKeys?: Set<string> },
): TaskProgress {
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
    return sessions.some((session) => {
      if (!session?.start) return false;
      const sessionStart = new Date(session.start);
      return sessionStart >= dayStart && sessionStart < dayEnd;
    });
  };

  // Helper to check if a task's deadline falls within a day range
  const hasDueDateOnDay = (dueDate: Date | string | null | undefined, dayStart: Date, dayEnd: Date): boolean => {
    if (!dueDate) return false;
    const d = new Date(dueDate);
    // Normalize to midnight for comparison (deadline date only, ignoring time)
    d.setHours(0, 0, 0, 0);
    const dayStartNorm = new Date(dayStart);
    dayStartNorm.setHours(0, 0, 0, 0);
    return d.getTime() === dayStartNorm.getTime();
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
      const subTasks: any[] = task.subtasks || [];
      const hasSubtasks = subTasks.length > 0;
      const taskDueDate = (task as any).dueDate || (task as any).deadline;

      if (hasSubtasks) {
        // For tasks with subtasks, each subtask is a unit
        for (const st of subTasks) {
          const stCompletedAt = st?.completedAt;
          const stIsDone = st?.status === "done";
          const wasCompletedOnThisDay = isWithinDay(stCompletedAt, dayStart, dayEnd);
          const assumeCompletedToday = isToday && stIsDone && !stCompletedAt;

          // Check if subtask has a scheduled session on this day
          const isSubtaskScheduledForDay = hasScheduledSessionOnDay(st?.scheduledSessions, dayStart, dayEnd);

          // Fallback: if task is due on this day, count subtasks as planned work
          const isTaskDueThisDay = hasDueDateOnDay(taskDueDate, dayStart, dayEnd);

          // Count in total if:
          // 1. Scheduled for this day AND not completed before this day started, OR
          // 2. Was completed on this day (so it shows as work done on this day), OR
          // 3. Task is due this day AND not completed before this day (fallback for no sessions)
          if (isSubtaskScheduledForDay && !isCompletedBefore(stCompletedAt, dayStart)) {
            totalUnits += 1;
            if (wasCompletedOnThisDay || assumeCompletedToday) {
              completedUnits += 1;
            }
          } else if (wasCompletedOnThisDay || assumeCompletedToday) {
            // Completed on this day but wasn't scheduled for it - count as both total and completed
            totalUnits += 1;
            completedUnits += 1;
          } else if (
            isToday &&
            isTaskDueThisDay &&
            !isCompletedBefore(stCompletedAt, dayStart) &&
            !isSubtaskScheduledForDay
          ) {
            // Today only: task due today with no scheduled session - count as pending work
            totalUnits += 1;
            if (stIsDone) {
              completedUnits += 1;
            }
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

        // Fallback: check if task is due on this day
        const isTaskDueThisDay = hasDueDateOnDay(taskDueDate, dayStart, dayEnd);

        // Count in total if:
        // 1. Scheduled for this day AND not completed before this day started, OR
        // 2. Was completed on this day (so it shows as work done on this day), OR
        // 3. Task is due this day AND not completed before this day (fallback for no sessions)
        if (isTaskScheduledForDay && !isCompletedBefore(taskCompletedAt, dayStart)) {
          totalUnits += 1;
          if (wasCompletedOnThisDay || assumeCompletedToday) {
            completedUnits += 1;
          }
        } else if (wasCompletedOnThisDay || assumeCompletedToday) {
          // Completed on this day but wasn't scheduled for it - count as both total and completed
          totalUnits += 1;
          completedUnits += 1;
        } else if (
          isToday &&
          isTaskDueThisDay &&
          !isCompletedBefore(taskCompletedAt, dayStart) &&
          !isTaskScheduledForDay
        ) {
          // Today only: task due today with no scheduled session - count as pending work
          totalUnits += 1;
          if (taskIsDone) {
            completedUnits += 1;
          }
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
    // Also include tasks due today that aren't in the scheduled set
    const taskIds = scheduledInfo.taskIds || new Set<string>();
    const subtaskKeys = scheduledInfo.subtaskKeys || new Set<string>();

    for (const task of tasks) {
      const subs: any[] = task.subtasks || [];
      const taskId = task._id || (task as any).id;
      const hasSubtasks = subs.length > 0;
      const taskDueDate = (task as any).dueDate || (task as any).deadline;
      const isTaskDueToday = hasDueDateOnDay(taskDueDate, todayStart, todayEnd);

      if (hasSubtasks) {
        // Check each subtask
        for (let idx = 0; idx < subs.length; idx++) {
          const st = subs[idx];
          const keyWithUnderscore = `${task._id}:${st.index ?? idx}`;
          const keyWithId = `${(task as any).id}:${st.index ?? idx}`;
          const isScheduledToday = subtaskKeys.has(keyWithUnderscore) || subtaskKeys.has(keyWithId);

          const stCompletedAt = st?.completedAt;
          const stIsDone = st?.status === "done";

          if (isScheduledToday) {
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
          } else if (isTaskDueToday && !isCompletedBefore(stCompletedAt, todayStart)) {
            // Fallback: Task due today but not in scheduled set - count as pending
            todayTotal += 1;
            if (isWithinDay(stCompletedAt, todayStart, todayEnd)) {
              todayCompleted += 1;
            } else if (stIsDone && !stCompletedAt) {
              todayCompleted += 1;
            }
          }
        }
      } else {
        // Task without subtasks
        const isScheduledToday = taskIds.has(task._id) || taskIds.has(taskId);

        const taskCompletedAt = task.completedAt;
        const taskIsDone = task.status === "done" || task.completed === true;

        if (isScheduledToday) {
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
        } else if (isTaskDueToday && !isCompletedBefore(taskCompletedAt, todayStart)) {
          // Fallback: Task due today but not in scheduled set - count as pending
          todayTotal += 1;
          if (isWithinDay(taskCompletedAt, todayStart, todayEnd)) {
            todayCompleted += 1;
          } else if (taskIsDone && !taskCompletedAt) {
            todayCompleted += 1;
          }
        }
      }
    }
  } else {
    // Fallback: use scheduledSessions to determine what's scheduled for today
    // Also include tasks due today that have no sessions
    for (const task of tasks) {
      const subs: any[] = task.subtasks || [];
      const hasSubtasks = subs.length > 0;
      const taskDueDate = (task as any).dueDate || (task as any).deadline;
      const isTaskDueToday = hasDueDateOnDay(taskDueDate, todayStart, todayEnd);

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
          } else if (isTaskDueToday && !isCompletedBefore(stCompletedAt, todayStart) && !isSubtaskScheduledToday) {
            // Task due today with no scheduled session - count as pending work
            todayTotal += 1;
            if (stIsDone) {
              todayCompleted += 1;
            }
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
        } else if (isTaskDueToday && !isCompletedBefore(taskCompletedAt, todayStart) && !isTaskScheduledToday) {
          // Task due today with no scheduled session - count as pending work
          todayTotal += 1;
          if (taskIsDone) {
            todayCompleted += 1;
          }
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
    return sessions.some((session) => {
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

  const result = {
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

  return result;
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
  /** Subcategory MongoDB ObjectId string or name string */
  subcategoryId?: string;
  subtasks?: Array<{
    title: string;
    description?: string;
    minutes?: number;
  }>;
  taskType?: "perfect" | "in_parts" | "leaky";
  chunkCount?: number;
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
export type CompleteTaskResult = {
  task: Task | null;
  gamification?: GamificationResult;
};

export async function completeTask(id: string): Promise<CompleteTaskResult> {
  try {
    console.log(`[taskService] Completing task: ${id}`);
    const response = await post<{
      success: boolean;
      task: Task;
      gamification?: { points?: number; currentStreak?: number; completedTasks?: number };
      pointsAwarded?: number;
    }>(`/tasks/${id}/complete`, {});
    console.log(`[taskService] Complete response:`, response);
    if (response.gamification) {
      console.log(`[taskService] Gamification updated:`, response.gamification);
    }
    return {
      task: response.task || null,
      gamification: response.gamification
        ? {
            points: response.gamification.points,
            currentStreak: response.gamification.currentStreak,
            completedTasks: response.gamification.completedTasks,
            pointsAwarded: response.pointsAwarded,
            wasCompletion: true,
          }
        : undefined,
    };
  } catch (error) {
    console.error("[taskService] Failed to complete task:", error);
    return { task: null };
  }
}

/**
 * Result from toggling a task completion
 */
export type ToggleTaskResult = {
  success: boolean;
  task: Task | null;
  gamification?: GamificationResult;
  wasCompletion?: boolean;
  wasUncompletion?: boolean;
};

/**
 * Toggle task completion
 * POST /api/tasks/:id/toggle
 */
export async function toggleTaskCompletion(id: string): Promise<ToggleTaskResult> {
  try {
    const response = await post<{
      success: boolean;
      task: Task;
      gamification?: {
        points?: number;
        currentStreak?: number;
        completedTasks?: number;
      };
      pointsAwarded?: number;
      pointsSubtracted?: number;
      wasCompletion?: boolean;
      wasUncompletion?: boolean;
    }>(`/tasks/${id}/toggle`, {});

    console.log("[taskService] toggleTaskCompletion response:", {
      success: response.success,
      hasGamification: !!response.gamification,
      gamification: response.gamification,
      wasCompletion: response.wasCompletion,
      wasUncompletion: response.wasUncompletion,
    });

    return {
      success: response.success,
      task: response.task || null,
      gamification: response.gamification
        ? {
            points: response.gamification.points,
            currentStreak: response.gamification.currentStreak,
            completedTasks: response.gamification.completedTasks,
            pointsAwarded: response.pointsAwarded,
            pointsSubtracted: response.pointsSubtracted,
            wasCompletion: response.wasCompletion,
            wasUncompletion: response.wasUncompletion,
          }
        : undefined,
      wasCompletion: response.wasCompletion,
      wasUncompletion: response.wasUncompletion,
    };
  } catch (error) {
    console.warn("Failed to toggle task:", error);
    return { success: false, task: null };
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
  const response = await patch<{ success: boolean; task: Task }>(`/tasks/${id}`, updates);
  return response.task || null;
}

/**
 * Gamification result returned from task/subtask completion or reversal
 */
export type GamificationResult = {
  points?: number;
  currentStreak?: number;
  completedTasks?: number;
  pointsAwarded?: number;
  pointsSubtracted?: number;
  taskBonusSubtracted?: number;
  parentTaskCompleted?: boolean;
  parentTaskUncompleted?: boolean;
  wasCompletion?: boolean;
  wasUncompletion?: boolean;
};

/**
 * Result from updating a subtask
 */
export type UpdateSubTaskResult = {
  success: boolean;
  gamification?: GamificationResult;
};

/**
 * Update a subtask
 * PATCH /api/tasks/:taskId/subtasks/:subId
 * Returns gamification data when subtask is completed or reverted
 */
export async function updateSubTask(
  taskId: string,
  subtaskId: string,
  updates: Partial<{ status: SubTaskStatus; title?: string; description?: string; minutes?: number }>,
): Promise<UpdateSubTaskResult> {
  try {
    const response = await patch<{
      success: boolean;
      gamification?: { points: number; currentStreak: number; completedTasks?: number };
      pointsAwarded?: number;
      pointsSubtracted?: number;
      taskBonusSubtracted?: number;
      parentTaskCompleted?: boolean;
      parentTaskUncompleted?: boolean;
      wasCompletion?: boolean;
      wasUncompletion?: boolean;
    }>(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);

    // Log gamification data if subtask was completed or reverted
    if (response.gamification) {
      console.log("[taskService] Subtask gamification:", {
        pointsAwarded: response.pointsAwarded,
        pointsSubtracted: response.pointsSubtracted,
        totalPoints: response.gamification.points,
        completedTasks: response.gamification.completedTasks,
        streak: response.gamification.currentStreak,
        parentTaskCompleted: response.parentTaskCompleted,
        parentTaskUncompleted: response.parentTaskUncompleted,
        wasCompletion: response.wasCompletion,
        wasUncompletion: response.wasUncompletion,
      });
    }

    return {
      success: true,
      gamification: response.gamification
        ? {
            points: response.gamification.points,
            currentStreak: response.gamification.currentStreak,
            completedTasks: response.gamification.completedTasks,
            pointsAwarded: response.pointsAwarded,
            pointsSubtracted: response.pointsSubtracted,
            taskBonusSubtracted: response.taskBonusSubtracted,
            parentTaskCompleted: response.parentTaskCompleted,
            parentTaskUncompleted: response.parentTaskUncompleted,
            wasCompletion: response.wasCompletion,
            wasUncompletion: response.wasUncompletion,
          }
        : undefined,
    };
  } catch (error) {
    console.warn("Failed to update subtask:", error);
    return { success: false };
  }
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
  declineOverdueTasks,
  getTaskProgress,
  getScheduledTasksByDay,
  calculateTaskProgress,
  completeTask,
  toggleTaskCompletion,
  updateTask,
  updateSubTask,
  deleteTask,
  suggestCategory,
};

/**
 * =============================================================================
 * CALENDAR-SPECIFIC TYPES AND TRANSFORMATIONS
 * =============================================================================
 * These helpers transform API Task objects into the Calendar screen's format.
 * This keeps the Calendar screen independent of API changes.
 */

/**
 * Calendar Subtask interface (matches Calendar.tsx expectations)
 */
export interface CalendarSubtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
}

/**
 * Calendar Task interface (matches Calendar.tsx expectations)
 */
export interface CalendarTask {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  emoji: string;
  dueDate: string;
  description: string;
  completed: boolean;
  color: string;
  category?: string;
  subtasks?: CalendarSubtask[];
  dateString?: string; // Date in YYYY-MM-DD format for filtering
  // Optional authoritative progress percentage provided by server (0-100)
  progressPercentage?: number;
  // Detail fields for expanded TaskCard view
  importance?: number;
  effort?: number;
  subcategoryDisplay?: string;
  subCategory?: { name?: string; icon?: string | null; color?: string | null; parent?: string; source?: string } | null;
  estimatedDuration?: number;
  earliestStart?: string;
  deadline?: string;
}

/**
 * Calendar Task Group (organized by date)
 */
export interface CalendarTaskGroup {
  date: string;
  tasks: CalendarTask[];
}

/**
 * API SubTask response (from backend)
 */
export interface ApiSubTask {
  _id: string;
  taskId: string;
  userId: string;
  index: number;
  title: string;
  description?: string;
  minutes?: number;
  status: "todo" | "done";
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended Task type that includes populated subtasks
 */
export interface TaskWithSubtasks extends Task {
  subTasks?: ApiSubTask[];
  // Optional authoritative progress percentage provided by server (0-100)
  progressPercentage?: number;
}

/**
 * Get locale-specific day and date string (e.g., "WEDNESDAY, DECEMBER 10, 2025")
 */
function getFormattedDateString(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

// getLocalDateString imported from shared utils
import { getLocalDateString } from "../utils/dateUtils";

/**
 * Extract time from dueDate (or return default if no time available)
 * Since API doesn't store explicit time, we use dueDate hour or default to "09:00"
 */
function extractTimeFromDate(dueDate?: string): string {
  if (!dueDate) return "09:00";
  try {
    const date = new Date(dueDate);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "09:00";
  }
}

/**
 * Transform API SubTask to Calendar Subtask
 */
function transformSubtask(subTask: ApiSubTask): CalendarSubtask {
  return {
    id: subTask._id,
    title: subTask.title || "",
    description: subTask.description,
    completed: subTask.status === "done",
  };
}

/**
 * Transform API Task to Calendar Task format
 * Handles emoji selection from category, time extraction, etc.
 */
export function transformTaskToCalendarFormat(apiTask: TaskWithSubtasks): CalendarTask {
  const categoryMeta = apiTask.category ? getCategoryMeta(apiTask.category) : null;

  // Use category emoji or fallback to default
  const emoji = categoryMeta ? "📌" : "📝"; // Placeholder - you may have emojis in categoryMeta

  // Get color from category metadata
  const color = categoryMeta?.color || "#999999";

  // Extract time from dueDate or use default
  const time = extractTimeFromDate(apiTask.dueDate);

  // Format due date for display
  const dueDateObj = apiTask.dueDate ? new Date(apiTask.dueDate) : null;
  const dueDate = dueDateObj
    ? `Due to: ${dueDateObj.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })}`
    : "No due date";

  // Get date string in YYYY-MM-DD format for filtering
  const dateString = dueDateObj ? getLocalDateString(dueDateObj) : getLocalDateString(new Date());

  // Transform subtasks if they exist
  const subtasks = apiTask.subTasks ? apiTask.subTasks.map(transformSubtask) : undefined;

  console.log(
    `[transformTaskToCalendarFormat] Task ${apiTask._id} (${apiTask.taskname}): subTasks=${apiTask.subTasks?.length || 0}, transformed subtasks=${subtasks?.length || 0}`,
  );

  return {
    id: apiTask._id,
    time,
    title: apiTask.taskname,
    emoji,
    dueDate,
    description: apiTask.description || "",
    completed: apiTask.status === "done" || apiTask.completed === true,
    color,
    category: apiTask.category,
    subtasks,
    dateString,
    // expose server progress percentage (0-100) for Calendar UI
    progressPercentage: typeof apiTask.progressPercentage === "number" ? apiTask.progressPercentage : undefined,
  };
}

/**
 * Transform multiple API Tasks and group by date
 * Returns tasks organized in TaskGroup format ready for Calendar display
 */
export function transformTasksToCalendarGroups(apiTasks: TaskWithSubtasks[]): CalendarTaskGroup[] {
  // First, transform all tasks
  const calendarTasks = apiTasks.map(transformTaskToCalendarFormat);

  // Group by dateString
  const groups: Record<string, CalendarTask[]> = {};
  const dateOrder: string[] = [];

  calendarTasks.forEach((task) => {
    const dateStr = task.dateString || getLocalDateString(new Date());

    if (!groups[dateStr]) {
      groups[dateStr] = [];
      dateOrder.push(dateStr);
    }
    groups[dateStr].push(task);
  });

  // Sort dates chronologically and convert to TaskGroup array
  return dateOrder
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((dateStr) => {
      const dateObj = new Date(dateStr);
      return {
        date: getFormattedDateString(dateObj),
        tasks: groups[dateStr],
      };
    });
}

/**
 * Get tasks for a specific date range, transformed to Calendar format
 * Useful for fetching tasks for a specific week or month
 */
export async function getTasksForDateRange(startDate: Date, endDate: Date): Promise<CalendarTaskGroup[]> {
  try {
    const dueAfter = startDate.toISOString();
    const dueBefore = endDate.toISOString();

    const tasks = await getTasks({
      dueAfter,
      dueBefore,
    });

    return transformTasksToCalendarGroups(tasks);
  } catch (error) {
    console.warn("Failed to fetch tasks for date range:", error);
    return [];
  }
}

/**
 * Get tasks for a single date, transformed to Calendar format
 */
export async function getTasksForDate(date: Date): Promise<CalendarTaskGroup[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return getTasksForDateRange(startOfDay, endOfDay);
}

/**
 * Get raw scheduled sessions for a specific task (for the manual schedule editor).
 * GET /api/tasks/:id/sessions
 */
export async function getTaskSessions(taskId: string): Promise<{
  manualSchedule: boolean;
  sessions: Array<{
    _id: string;
    start: string;
    end: string;
    minutes: number;
    subtaskIndex: number | null;
    subtaskTitle: string | null;
    status: string;
    manuallyScheduled: boolean;
  }>;
} | null> {
  try {
    const response = await get<any>(`/tasks/${taskId}/sessions`);
    return {
      manualSchedule: response.manualSchedule ?? false,
      sessions: response.sessions ?? [],
    };
  } catch (error) {
    console.warn("Failed to fetch task sessions:", error);
    return null;
  }
}

/**
 * Replace a task's planned sessions with a manually-defined set.
 * PATCH /api/tasks/:id/sessions
 *
 * On success the task is flagged `manualSchedule = true` so the
 * auto-scheduler will not overwrite these sessions.
 */
export async function updateTaskSchedule(
  taskId: string,
  sessions: Array<{
    id?: string;
    start: string; // ISO string
    end: string; // ISO string
    subtaskIndex?: number | null;
  }>,
): Promise<{
  success: boolean;
  error?: string;
  sessions: Array<{
    _id: string;
    start: string;
    end: string;
    minutes: number;
    subtaskIndex: number | null;
    subtaskTitle: string | null;
    status: string;
  }>;
}> {
  try {
    const response = await patch<any>(`/tasks/${taskId}/sessions`, { sessions });
    return { success: true, sessions: response.sessions ?? [] };
  } catch (error: any) {
    const message = error?.response?.data?.error ?? error?.message ?? "Failed to update schedule";
    return { success: false, error: message, sessions: [] };
  }
}

/**
 * Get scheduled sessions for a specific date
 * Fetches TaskSchedule documents and transforms them to Calendar format
 * Shows what the user is scheduled to work on for that day
 * For multi-day tasks, shows subtask name with parent task context and progress
 */
export async function getScheduledSessionsForDate(date: Date): Promise<CalendarTaskGroup[]> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Build URL with query parameters for THIS DATE
    const params = new URLSearchParams({
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    });

    // Fetch scheduled sessions for this date from the API
    const response = await get<any>(`/tasks/schedule/sessions?${params.toString()}`);

    if (!response || !response.sessions) {
      return [];
    }

    // For each task in the response, we need to get its total session count across all dates
    // To do this efficiently, we'll fetch a broader date range to count all sessions per task
    const allSessionsParams = new URLSearchParams({
      startDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(), // Start of month
      endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(), // End of month
    });

    const allSessionsResponse = await get<any>(`/tasks/schedule/sessions?${allSessionsParams.toString()}`);
    const allSessions = allSessionsResponse?.sessions || [];

    // Count total sessions per task across the month
    const taskSessionCounts: Record<string, number> = {};
    const taskSessionDates: Record<string, Set<string>> = {}; // Track unique dates per task
    const taskSessionMapForDebug: Record<string, string[]> = {};

    allSessions.forEach((session: any) => {
      const taskId = session.taskId?._id || "unknown";
      taskSessionCounts[taskId] = (taskSessionCounts[taskId] || 0) + 1;

      if (!taskSessionDates[taskId]) {
        taskSessionDates[taskId] = new Set();
      }
      // Use local date string (YYYY-MM-DD) to avoid UTC shift issues when grouping by date
      const sDate = new Date(session.start);
      const sessionDate = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, "0")}-${String(sDate.getDate()).padStart(2, "0")}`;
      taskSessionDates[taskId].add(sessionDate);

      if (!taskSessionMapForDebug[taskId]) taskSessionMapForDebug[taskId] = [];
      taskSessionMapForDebug[taskId].push(sessionDate);
    });

    // Diagnostics: detect 'perfect' (single-part) tasks that have scheduled sessions on dates different from their dueDate
    Object.keys(taskSessionMapForDebug).forEach((taskId) => {
      const scheduledDates = Array.from(new Set(taskSessionMapForDebug[taskId]));
      // Find the task object in this month's sessions list
      const anySession = allSessions.find((s: any) => (s.taskId?._id || "") === taskId);
      const taskObj = anySession?.taskId;
      if (taskObj && taskObj.taskType === "perfect" && taskObj.dueDate) {
        const dueDate = (() => {
          try {
            const d = new Date(taskObj.dueDate);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          } catch {
            return null;
          }
        })();
        if (dueDate && scheduledDates.some((d) => d !== dueDate)) {
          console.warn(
            "[getScheduledSessionsForDate] Warning: perfect task has schedule on different date(s) than dueDate",
            { taskId, dueDate, scheduledDates },
          );
        }
      }
    });

    // Create a map of sessions per task for calculating part numbers
    const taskSessionMap: Record<string, any[]> = {};
    allSessions.forEach((session: any) => {
      const taskId = session.taskId?._id || "unknown";
      if (!taskSessionMap[taskId]) {
        taskSessionMap[taskId] = [];
      }
      taskSessionMap[taskId].push(session);
    });

    // Transform sessions from TODAY and add part information
    const calendarTasks = response.sessions.map((session: any) => {
      const task = session.taskId || {};
      const taskId = task._id || "unknown";
      const categoryMeta = task.category ? getCategoryMeta(task.category) : getCategoryMeta(undefined);

      const startTime = new Date(session.start);
      const endTime = new Date(session.end);

      // Format times
      const timeStr = startTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const endTimeStr = endTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Map icon to emoji
      const iconEmoji = mapIconToEmoji(categoryMeta.icon);

      // Find which part this session is (based on all sessions of this task, sorted by date)
      const taskSessions = taskSessionMap[taskId] || [];
      taskSessions.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

      const partNumber = taskSessions.findIndex((s: any) => s._id === session._id) + 1;
      const totalParts = taskSessionCounts[taskId] || 1;
      const uniqueDatesCount = taskSessionDates[taskId]?.size || 1;

      // Check if this is a multi-day task (sessions on different days)
      const isMultiDay = uniqueDatesCount > 1;

      // Get subtask info if available
      // For multi-day tasks, the subtask info comes from session.subtaskTitle and session.description
      const subtaskIndex = session.subtaskIndex;
      let subtaskTitle = session.subtaskTitle || null;
      let subtaskDescription = session.description || null;

      // Fallback: try to get from task.subTasks array if not in session
      if (!subtaskTitle && subtaskIndex !== undefined && subtaskIndex !== null) {
        const subtask = task.subTasks?.[subtaskIndex - 1]; // subtaskIndex is 1-indexed
        if (subtask) {
          subtaskTitle = subtask.title;
          subtaskDescription = subtask.description;
        }
      }

      // For multi-day tasks, get the actual subtask description from the task's subTasks array
      let actualSubtaskDescription = null;
      if (isMultiDay && subtaskIndex !== undefined && subtaskIndex !== null) {
        const subtask = task.subTasks?.[subtaskIndex - 1]; // subtaskIndex is 1-indexed
        if (subtask) {
          actualSubtaskDescription = subtask.description || "";
        }
      }

      // Calculate progress percentage from task (use server value when present, fallback to calculating from subtasks)
      const taskProgress =
        typeof task.progressPercentage === "number"
          ? task.progressPercentage
          : task.subTasks
            ? Math.round(
                (task.subTasks.filter((st: any) => st.status === "done").length / (task.subTasks.length || 1)) * 100,
              )
            : 0;
      const progressStr = "";

      // Format title based on whether it's multi-day and has subtask
      // For multi-day tasks, show parent task name as the main title and keep the subtask title separately
      let title: string;
      if (isMultiDay && subtaskTitle) {
        // Multi-day: show parent task name as title
        title = `${task.taskname || "Scheduled Session"}${progressStr}`;
      } else {
        // Single-day or no subtask: show task name (or subtask inferred)
        title = `${task.taskname || "Scheduled Session"}${progressStr}`;
      }

      return {
        id: session._id,
        time: timeStr,
        endTime: endTimeStr,
        title,
        // Include subtaskTitle explicitly for the UI to show as subtitle
        subtaskTitle: subtaskTitle || null,
        emoji: iconEmoji,
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "",
        // For multi-day tasks, description should show the actual subtask description; otherwise show task/subtask description
        description: isMultiDay ? actualSubtaskDescription || "" : subtaskDescription || task.description || "",
        mainTaskDescription: isMultiDay ? task.description || "" : "",
        // reflect the actual session status so the calendar can mark it done
        completed: session.status === "completed" || session.status === "done" || task.status === "done",
        // preserve status too in case other logic needs it
        status: session.status || task.status || "",
        color: categoryMeta.color || "#3498db",
        category: task.category,
        // For multi-day tasks, use session data; for single-day tasks, use task.subTasks
        // Deduplicate subtask list by index to protect against duplicate DB rows
        subtasks: (() => {
          if (!task.subTasks || task.subTasks.length === 0) return [];
          const seenIdx = new Set<number>();
          const unique: any[] = [];
          // Ensure order by index if available
          const sorted = [...task.subTasks].sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
          for (const st of sorted) {
            const idx = st.index ?? -1;
            const key = idx;
            if (!seenIdx.has(key)) {
              seenIdx.add(key);
              unique.push({
                id: st._id,
                title: st.title,
                description: st.description,
                completed: st.status === "done",
                index: st.index,
              });
            } else {
              console.warn(
                "[getScheduledSessionsForDate] Duplicate subtask entry ignored for task",
                taskId,
                "index",
                idx,
                "id",
                st._id,
              );
            }
          }
          return unique;
        })(),
        // Expose authoritative progress percentage for frontend to use (0-100)
        // Use the computed taskProgress so the UI (title + icon) are consistent
        progressPercentage: taskProgress,
        // Use local date string (YYYY-MM-DD) so grouping aligns with user local date selection
        dateString: `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, "0")}-${String(startTime.getDate()).padStart(2, "0")}`,
        isScheduled: true,
        taskId: taskId,
        partNumber,
        totalParts,
        parentTaskName: task.taskname,
        subtaskIndex: session.subtaskIndex,
        // Detail fields for expanded TaskCard view
        importance: task.importance ?? undefined,
        effort: task.effort ?? undefined,
        // Guard: subCategory may arrive as a raw ObjectId string (not populated).
        // Only extract display fields when it's a real object.
        ...(() => {
          const subCat = task.subCategory && typeof task.subCategory === "object" ? task.subCategory : null;
          return {
            subcategoryDisplay: subCat?.name ?? subCat?.label ?? undefined,
            subCategory: subCat,
          };
        })(),
        estimatedDuration: task.estimatedDuration ?? undefined,
        earliestStart: task.earliestStart ?? undefined,
        deadline: task.dueDate ?? undefined,
      } as CalendarTask & { taskId: string; partNumber: number; totalParts: number; parentTaskName: string };
    });

    // Group by date
    const groupedByDate: Record<string, CalendarTask[]> = {};

    // First, group sessions by task + date
    const sessionsByTaskAndDate: Record<string, any[]> = {};
    calendarTasks.forEach((task: any) => {
      const key = `${task.taskId}-${task.dateString}`;
      if (!sessionsByTaskAndDate[key]) {
        sessionsByTaskAndDate[key] = [];
      }
      sessionsByTaskAndDate[key].push(task);
    });

    // Helper function to parse time string to minutes since midnight
    const parseTimeToMinutes = (timeStr: string): number => {
      // timeStr is formatted like "09:00 AM" or "9:00 AM"
      const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!parts) return 0;

      let hours = parseInt(parts[1], 10);
      const minutes = parseInt(parts[2], 10);
      const period = parts[3]?.toUpperCase();

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    // Now transform grouped sessions into combined cards when multiple parts on same day
    Object.values(sessionsByTaskAndDate).forEach((sessionsGroup: any[]) => {
      if (sessionsGroup.length > 1) {
        // Multiple sessions of the same task on the same day - combine them
        const firstSession = sessionsGroup[0];
        const dateKey = firstSession.dateString; // already in local YYYY-MM-DD format

        // Get all subtask info with full details (description and time interval) from the calendar task object
        console.log(
          `[getScheduledSessionsForDate] Creating grouped subtasks for task ${firstSession.taskId}, has subtasks array length: ${firstSession.subtasks?.length}`,
        );
        // Only include subtasks that are actually scheduled for this day (by subtaskIndex)
        const scheduledIndices = Array.from(
          new Set(sessionsGroup.map((s: any) => s.subtaskIndex).filter((i: any) => i !== undefined && i !== null)),
        ).sort((a: number, b: number) => a - b);
        const subtasksInfo = scheduledIndices.map((idx: number) => {
          const st = firstSession.subtasks ? firstSession.subtasks[idx - 1] : undefined;
          const timeRange = sessionsGroup.find((s: any) => s.subtaskIndex === idx)
            ? `${sessionsGroup.find((s: any) => s.subtaskIndex === idx).time} - ${sessionsGroup.find((s: any) => s.subtaskIndex === idx).endTime}`
            : undefined;

          return {
            id: st ? st.id : `unknown-${idx}`,
            title: st ? st.title : `Part ${idx}`,
            description: st ? st.description || "" : "",
            completed: !!st?.completed,
            index: idx,
            timeRange,
          };
        });

        // Sort sessions by time to get earliest start and latest end
        const sortedSessions = [...sessionsGroup].sort((a: any, b: any) => {
          return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
        });

        const earliestSession = sortedSessions[0];
        const latestSession = sortedSessions[sortedSessions.length - 1];

        // Create combined card
        // The firstSession.title is already just the subtask title (no part info)
        // parentTaskName is already set from firstSession
        const combinedTask = {
          ...firstSession,
          time: earliestSession.time,
          endTime: latestSession.endTime,
          title: firstSession.title, // Already the subtask title
          subtasks: subtasksInfo,
          isGrouped: true,
          groupedSessions: sessionsGroup,
          parentTaskName: firstSession.parentTaskName, // Already set correctly
          partNumber: firstSession.partNumber,
          totalParts: firstSession.totalParts,
          // Override completed based on progressPercentage (100% = completed)
          completed:
            typeof firstSession.progressPercentage === "number" && firstSession.progressPercentage === 100
              ? true
              : firstSession.completed,
        };

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(combinedTask);
      } else {
        // Single session - add as-is
        let session = sessionsGroup[0];
        const dateKey = session.dateString; // session.dateString now uses local date format (YYYY-MM-DD)

        // For multi-day tasks (totalParts > 1), only show the current subtask in the details
        if (
          session.totalParts &&
          session.totalParts > 1 &&
          session.subtaskIndex !== undefined &&
          session.subtaskIndex !== null
        ) {
          // Get the current subtask
          const currentSubtaskIndex = session.subtaskIndex - 1; // Convert to 0-indexed
          if (session.subtasks && session.subtasks[currentSubtaskIndex]) {
            const currentSubtask = session.subtasks[currentSubtaskIndex];
            session.subtasks = [
              {
                id: currentSubtask.id,
                title: currentSubtask.title,
                description: currentSubtask.description || "", // Use actual subtask description
                completed: currentSubtask.completed,
                timeRange: session.time && session.endTime ? `${session.time} - ${session.endTime}` : undefined,
              },
            ];
          }
        }

        // Override completed based on progressPercentage (100% = completed)
        session = {
          ...session,
          completed:
            typeof session.progressPercentage === "number" && session.progressPercentage === 100
              ? true
              : session.completed,
        };

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(session);
      }
    });

    // Sort sessions by time within each date
    Object.keys(groupedByDate).forEach((key) => {
      groupedByDate[key].sort((a: any, b: any) => {
        const timeA = parseTimeToMinutes(a.time);
        const timeB = parseTimeToMinutes(b.time);
        return timeA - timeB;
      });
    });

    return Object.entries(groupedByDate).map(([dateString, tasks]) => ({
      date: new Date(dateString).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      tasks,
    }));
  } catch (error) {
    console.warn("Failed to fetch scheduled sessions:", error);
    return [];
  }
}

/**
 * Helper function to map icon key to emoji
 * This provides a visual representation for the scheduled session
 */
function mapIconToEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    study: "📚",
    skills: "🎯",
    workout: "💪",
    reflection: "🧘",
    home: "🏠",
    family: "👨‍👩‍👧‍👦",
    settings: "⚙️",
    work: "💼",
    creative: "🎨",
    hobbies: "🎭",
    heart: "❤️",
    goals: "🎯",
    mindfulness: "🧘",
    health: "🏥",
    friends: "👥",
    explore: "🔍",
    repeat: "🔄",
    other: "📋",
  };

  return iconMap[icon] || "📋";
}

/**
 * Create an automatic schedule/plan for a task
 * POST /api/tasks/:id/schedule
 *
 * Generates an optimal schedule using CSP algorithm
 */
export async function createTaskSchedule(
  taskId: string,
  options?: {
    planningHorizonDays?: number;
  },
): Promise<{
  success: boolean;
  message: string;
  scheduledCount: number;
  plan?: Array<{
    start: string;
    end: string;
    minutes: number;
    taskId: string;
    subtaskIndex?: number;
  }>;
} | null> {
  try {
    const response = await post<any>(`/tasks/${taskId}/schedule`, {
      planningHorizonDays: options?.planningHorizonDays || 14,
    });

    if (response.success) {
      return {
        success: true,
        message: response.message,
        scheduledCount: response.scheduledCount ?? 0,
        plan: response.plan,
      };
    }
    // Backend returned success:false — scheduler ran but produced no slots
    return { success: false, message: response.message ?? "No slots found", scheduledCount: 0 };
  } catch (error: any) {
    console.error("Failed to create task schedule:", error);
    // Return null to signal a network/server error (distinct from scheduler returning empty)
    return null;
  }
}

/**
 * Get subtasks for a task
 * GET /api/tasks/:taskId/subtasks
 */
export async function getSubTasksForTask(taskId: string): Promise<ApiSubTask[]> {
  try {
    const response = await get<{ success: boolean; count: number; subtasks: ApiSubTask[] }>(
      `/tasks/${taskId}/subtasks`,
    );
    return response.subtasks || [];
  } catch (error) {
    console.warn("Failed to fetch subtasks:", error);
    return [];
  }
}

/**
 * Mark a subtask as complete
 * POST /api/tasks/:taskId/subtasks/:subId/complete
 */
export async function markSubTaskComplete(
  taskId: string,
  subTaskId: string,
): Promise<{ success: boolean; subtask?: ApiSubTask; message?: string }> {
  try {
    console.log(`[markSubTaskComplete] Marking subtask complete - taskId: ${taskId}, subTaskId: ${subTaskId}`);
    console.log(`[markSubTaskComplete] Full request URL will be: /tasks/${taskId}/subtasks/${subTaskId}/complete`);
    const response = await post<{ success: boolean; subtask: ApiSubTask; message: string }>(
      `/tasks/${taskId}/subtasks/${subTaskId}/complete`,
    );
    console.log(`[markSubTaskComplete] Response:`, response);
    return response;
  } catch (error) {
    console.error("Failed to mark subtask complete:", error);
    console.error("[markSubTaskComplete] Error details:", error);
    return { success: false };
  }
}

/**
 * Mark a subtask as todo
 * POST /api/tasks/:taskId/subtasks/:subId/todo
 */
export async function markSubTaskTodo(
  taskId: string,
  subTaskId: string,
): Promise<{ success: boolean; subtask?: ApiSubTask; message?: string }> {
  try {
    const response = await post<{ success: boolean; subtask: ApiSubTask; message: string }>(
      `/tasks/${taskId}/subtasks/${subTaskId}/todo`,
    );
    return response;
  } catch (error) {
    console.error("Failed to mark subtask todo:", error);
    return { success: false };
  }
}

/**
 * Delete a single subtask and its corresponding TaskSchedule entries
 * DELETE /api/tasks/:taskId/subtasks/:subId
 */
export async function deleteSubTask(taskId: string, subtaskId: string): Promise<boolean> {
  try {
    await del<{ success: boolean }>(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return true;
  } catch (error) {
    console.warn("Failed to delete subtask:", error);
    return false;
  }
}
