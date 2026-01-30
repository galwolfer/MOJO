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
};

export type Task = {
  _id: string;
  userId: string;
  taskname: string;
  description?: string;
  category?: string;
  tags?: string[] | null;
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
    console.log("[getTasks] Tasks count:", tasks.length);
    tasks.forEach((task: any) => {
      console.log(`\n[getTasks] Task:`, {
        id: task._id,
        name: task.taskname,
        taskType: task.taskType,
        hasSubTasks: !!task.subTasks,
        subTasksCount: task.subTasks?.length || 0,
        subTasksArray: task.subTasks,
      });
    });
    return tasks;
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
  tags: string[];
  dueDate: string;
  description: string;
  completed: boolean;
  color: string;
  category?: string;
  subtasks?: CalendarSubtask[];
  dateString?: string; // Date in YYYY-MM-DD format for filtering
  // Optional authoritative progress percentage provided by server (0-100)
  progressPercentage?: number;
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
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

/**
 * Get date string in YYYY-MM-DD format (for filtering)
 */
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const subtasks = apiTask.subTasks
    ? apiTask.subTasks.map(transformSubtask)
    : undefined;
  
  console.log(`[transformTaskToCalendarFormat] Task ${apiTask._id} (${apiTask.taskname}): subTasks=${apiTask.subTasks?.length || 0}, transformed subtasks=${subtasks?.length || 0}`);
  
  return {
    id: apiTask._id,
    time,
    title: apiTask.taskname,
    emoji,
    tags: apiTask.tags || [],
    dueDate,
    description: apiTask.description || "",
    completed: apiTask.status === "done" || apiTask.completed === true,
    color,
    category: apiTask.category,
    subtasks,
    dateString,
    // expose server progress percentage (0-100) for Calendar UI
    progressPercentage: typeof apiTask.progressPercentage === 'number' ? apiTask.progressPercentage : undefined,
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
export async function getTasksForDateRange(
  startDate: Date,
  endDate: Date
): Promise<CalendarTaskGroup[]> {
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
      const taskId = session.taskId?._id || 'unknown';
      taskSessionCounts[taskId] = (taskSessionCounts[taskId] || 0) + 1;

      if (!taskSessionDates[taskId]) {
        taskSessionDates[taskId] = new Set();
      }
      // Use local date string (YYYY-MM-DD) to avoid UTC shift issues when grouping by date
      const sDate = new Date(session.start);
      const sessionDate = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
      taskSessionDates[taskId].add(sessionDate);

      if (!taskSessionMapForDebug[taskId]) taskSessionMapForDebug[taskId] = [];
      taskSessionMapForDebug[taskId].push(sessionDate);
    });

    // Diagnostics: detect 'perfect' (single-part) tasks that have scheduled sessions on dates different from their dueDate
    Object.keys(taskSessionMapForDebug).forEach((taskId) => {
      const scheduledDates = Array.from(new Set(taskSessionMapForDebug[taskId]));
      // Find the task object in this month's sessions list
      const anySession = allSessions.find((s: any) => (s.taskId?._id || '') === taskId);
      const taskObj = anySession?.taskId;
      if (taskObj && taskObj.taskType === 'perfect' && taskObj.dueDate) {
        const dueDate = (() => {
          try { const d = new Date(taskObj.dueDate); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch { return null; }
        })();
        if (dueDate && scheduledDates.some((d) => d !== dueDate)) {
          console.warn('[getScheduledSessionsForDate] Warning: perfect task has schedule on different date(s) than dueDate', { taskId, dueDate, scheduledDates });
        }
      }
    });
    
    // Create a map of sessions per task for calculating part numbers
    const taskSessionMap: Record<string, any[]> = {};
    allSessions.forEach((session: any) => {
      const taskId = session.taskId?._id || 'unknown';
      if (!taskSessionMap[taskId]) {
        taskSessionMap[taskId] = [];
      }
      taskSessionMap[taskId].push(session);
    });
    
    // Transform sessions from TODAY and add part information
    const calendarTasks = response.sessions.map((session: any) => {
      const task = session.taskId || {};
      const taskId = task._id || 'unknown';
      const categoryMeta = task.category ? getCategoryMeta(task.category) : getCategoryMeta(undefined);
      
      const startTime = new Date(session.start);
      const endTime = new Date(session.end);
      
      // Format times
      const timeStr = startTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      const endTimeStr = endTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
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
          actualSubtaskDescription = subtask.description || '';
        }
      }
      
      // Calculate progress percentage from task (use server value when present, fallback to calculating from subtasks)
      const taskProgress = (typeof task.progressPercentage === 'number')
        ? task.progressPercentage
        : (task.subTasks ? Math.round((task.subTasks.filter((st: any) => st.status === 'done').length / (task.subTasks.length || 1)) * 100) : 0);
      const progressStr = '';
      
      // Format title based on whether it's multi-day and has subtask
      // For multi-day tasks, show parent task name as the main title and keep the subtask title separately
      let title: string;
      if (isMultiDay && subtaskTitle) {
        // Multi-day: show parent task name as title
        title = `${task.taskname || 'Scheduled Session'}${progressStr}`;
      } else {
        // Single-day or no subtask: show task name (or subtask inferred)
        title = `${task.taskname || 'Scheduled Session'}${progressStr}`;
      }
      
      return {
        id: session._id,
        time: timeStr,
        endTime: endTimeStr,
        title,
        // Include subtaskTitle explicitly for the UI to show as subtitle
        subtaskTitle: subtaskTitle || null,
        emoji: iconEmoji,
        tags: task.tags || [],
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
        // For multi-day tasks, description should show the actual subtask description; otherwise show task/subtask description
        description: isMultiDay ? (actualSubtaskDescription || '') : (subtaskDescription || task.description || ''),
        mainTaskDescription: isMultiDay ? (task.description || '') : '',
        completed: false,
        color: categoryMeta.color || '#3498db',
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
              unique.push({ id: st._id, title: st.title, description: st.description, completed: st.status === 'done', index: st.index });
            } else {
              console.warn('[getScheduledSessionsForDate] Duplicate subtask entry ignored for task', taskId, 'index', idx, 'id', st._id);
            }
          }
          return unique;
        })(),
        // Expose authoritative progress percentage for frontend to use (0-100)
        // Use the computed taskProgress so the UI (title + icon) are consistent
        progressPercentage: taskProgress,
        // Use local date string (YYYY-MM-DD) so grouping aligns with user local date selection
        dateString: `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`,
        isScheduled: true,
        taskId: taskId,
        partNumber,
        totalParts,
        parentTaskName: task.taskname,
        subtaskIndex: session.subtaskIndex,
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
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      return hours * 60 + minutes;
    };
    
    // Now transform grouped sessions into combined cards when multiple parts on same day
    Object.values(sessionsByTaskAndDate).forEach((sessionsGroup: any[]) => {
      if (sessionsGroup.length > 1) {
        // Multiple sessions of the same task on the same day - combine them
        const firstSession = sessionsGroup[0];
        const dateKey = firstSession.dateString; // already in local YYYY-MM-DD format
        
        // Get all subtask info with full details (description and time interval) from the calendar task object
        console.log(`[getScheduledSessionsForDate] Creating grouped subtasks for task ${firstSession.taskId}, has subtasks array length: ${firstSession.subtasks?.length}`);
        // Only include subtasks that are actually scheduled for this day (by subtaskIndex)
        const scheduledIndices = Array.from(new Set(sessionsGroup.map((s: any) => s.subtaskIndex).filter((i: any) => i !== undefined && i !== null))).sort((a: number, b: number) => a - b);
        const subtasksInfo = scheduledIndices.map((idx: number) => {
            const st = firstSession.subtasks ? firstSession.subtasks[idx - 1] : undefined;
            const timeRange = sessionsGroup.find((s: any) => s.subtaskIndex === idx)
              ? `${sessionsGroup.find((s: any) => s.subtaskIndex === idx).time} - ${sessionsGroup.find((s: any) => s.subtaskIndex === idx).endTime}`
              : undefined;

            return {
              id: st ? st.id : `unknown-${idx}`,
              title: st ? st.title : `Part ${idx}`,
              description: st ? (st.description || '') : '',
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
          completed: (typeof firstSession.progressPercentage === 'number' && firstSession.progressPercentage === 100) ? true : firstSession.completed,
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
        if (session.totalParts && session.totalParts > 1 && session.subtaskIndex !== undefined && session.subtaskIndex !== null) {
          // Get the current subtask
          const currentSubtaskIndex = session.subtaskIndex - 1; // Convert to 0-indexed
          if (session.subtasks && session.subtasks[currentSubtaskIndex]) {
            const currentSubtask = session.subtasks[currentSubtaskIndex];
            session.subtasks = [{
              id: currentSubtask.id,
              title: currentSubtask.title,
              description: currentSubtask.description || '', // Use actual subtask description
              completed: currentSubtask.completed,
            }];
          }
        }
        
        // Override completed based on progressPercentage (100% = completed)
        session = {
          ...session,
          completed: (typeof session.progressPercentage === 'number' && session.progressPercentage === 100) ? true : session.completed,
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
      date: new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
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
    study: '📚',
    skills: '🎯',
    workout: '💪',
    reflection: '🧘',
    home: '🏠',
    family: '👨‍👩‍👧‍👦',
    settings: '⚙️',
    work: '💼',
    creative: '🎨',
    hobbies: '🎭',
    heart: '❤️',
    goals: '🎯',
    mindfulness: '🧘',
    health: '🏥',
    friends: '👥',
    explore: '🔍',
    repeat: '🔄',
    other: '📋',
  };
  
  return iconMap[icon] || '📋';
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
  }
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
        scheduledCount: response.scheduledCount,
        plan: response.plan,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to create task schedule:", error);
    return null;
  }
}

/**
 * Get subtasks for a task
 * GET /api/tasks/:taskId/subtasks
 */
export async function getSubTasksForTask(taskId: string): Promise<ApiSubTask[]> {
  try {
    const response = await get<{ success: boolean; count: number; subtasks: ApiSubTask[] }>(`/tasks/${taskId}/subtasks`);
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
export async function markSubTaskComplete(taskId: string, subTaskId: string): Promise<{ success: boolean; subtask?: ApiSubTask; message?: string }> {
  try {
    console.log(`[markSubTaskComplete] Marking subtask complete - taskId: ${taskId}, subTaskId: ${subTaskId}`);
    console.log(`[markSubTaskComplete] Full request URL will be: /tasks/${taskId}/subtasks/${subTaskId}/complete`);
    const response = await post<{ success: boolean; subtask: ApiSubTask; message: string }>(`/tasks/${taskId}/subtasks/${subTaskId}/complete`);
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
export async function markSubTaskTodo(taskId: string, subTaskId: string): Promise<{ success: boolean; subtask?: ApiSubTask; message?: string }> {
  try {
    const response = await post<{ success: boolean; subtask: ApiSubTask; message: string }>(`/tasks/${taskId}/subtasks/${subTaskId}/todo`);
    return response;
  } catch (error) {
    console.error("Failed to mark subtask todo:", error);
    return { success: false };
  }
}

/**
 * Update subtask status
 * PATCH /api/tasks/:taskId/subtasks/:subId/status
 */
export async function updateSubTaskStatus(
  taskId: string, 
  subTaskId: string, 
  status: "todo" | "done"
): Promise<{ success: boolean; subtask?: ApiSubTask; message?: string }> {
  try {
    const response = await patch<{ success: boolean; subtask: ApiSubTask; message: string }>(`/tasks/${taskId}/subtasks/${subTaskId}/status`, { status });
    return response;
  } catch (error) {
    console.error("Failed to update subtask status:", error);
    return { success: false };
  }
}
