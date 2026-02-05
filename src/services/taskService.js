/**
 * @fileoverview Task Service
 * @module services/taskService
 *
 * Consolidated service for task management, busy blocks, and expiration checking.
 * Handles all CRUD operations, status synchronization, and task-related telemetry.
 *
 * Key responsibilities:
 * - Create, read, update, delete tasks
 * - Sync task status with scheduled sessions
 * - Generate and manage task subcategories
 * - Manage busy blocks (user unavailability)
 * - Check and handle expired tasks
 * - Record task-related telemetry events
 *
 * @requires models/Task - Task database model
 * @requires models/TaskSchedule - Schedule database model
 * @requires models/BusyBlock - BusyBlock database model
 */

import cron from "node-cron";
/*
 * File: src/services/taskService.js
 * Purpose: Business logic for task persistence and expired checks
 */
import { Task } from "../models/Task.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { SubTask } from "../models/SubTask.js";
import { BusyBlock } from "../models/BusyBlock.js";
import { CATEGORIES } from "../config/categories.js";
import { logEvent, recordSubCategoryGeneration, recordSubCategoryOverride } from "./telemetryService.js";
import { mapCategoryToLifecycle } from "../algorithms/priority/categorizing.js";
import { trainTask } from "./mlPredictionService.js";
import { logger } from "../utils/logger.js";
import { addDays, formatLocalDate, startOfDay } from "../utils/dateUtils.js";
import { getIllegalDisplayFields, getIllegalCharsErrorMessage } from "../utils/illegalChars.js";
import {
  addSubcategoryToUser,
  findOrCreateSubcategory,
  findSubcategoryById,
  getSubcategoryLabel,
  resolveSubcategoryId,
} from "./subcategoryService.js";

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Helper to ensure subcategory is saved to User profile
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name (string key)
 * @param {string|object} subCategory - Subcategory name or object
 */
async function _saveUserSubCategory(userId, categoryName, subCategory) {
  if (!userId || !categoryName || !subCategory) return;

  if (typeof subCategory === "string" && /^[a-fA-F0-9]{24}$/.test(subCategory)) {
    return;
  }

  const subName = typeof subCategory === "string" ? subCategory : subCategory.label || subCategory.name;
  if (!subName) return;

  try {
    await findOrCreateSubcategory({
      userId,
      name: subName,
      parent: categoryName,
      source: "user",
      confidence: 1,
    });
  } catch (err) {
    // Silent fail if category invalid or user not found, just log warning
    logger.warn(`Failed to sync subcategory "${subName}" for user ${userId}: ${err.message}`);
  }
}

function buildIllegalCharsError(fields) {
  return getIllegalCharsErrorMessage(fields);
}

function toId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.toString();
}

function buildSubtaskMap(subtasks) {
  const map = new Map();
  for (const sub of subtasks) {
    if (!sub?.taskId || !sub?.index) continue;
    map.set(`${toId(sub.taskId)}:${sub.index}`, sub);
  }
  return map;
}

function normalizeScheduleSession(session, subtaskMap) {
  const taskId = toId(session.taskId);
  const subtaskKey = session.subtaskIndex ? `${taskId}:${session.subtaskIndex}` : null;
  const subtask = subtaskKey ? subtaskMap.get(subtaskKey) : null;

  return {
    taskId,
    id: toId(session._id),
    start: session.start ? new Date(session.start).toISOString() : null,
    end: session.end ? new Date(session.end).toISOString() : null,
    minutes: session.minutes ?? null,
    status: session.status || null,
    subtaskIndex: session.subtaskIndex ?? null,
    subtaskId: subtask ? toId(subtask._id) : null,
    subtaskTitle: subtask ? subtask.title || null : null,
    subtaskStatus: subtask ? subtask.status || null : null,
  };
}

// =============================================================================
// TASK CRUD OPERATIONS
// =============================================================================

/**
 * Create a new task for a user.
 * @param {object} params
 * @returns {Promise<object>} The created task document.
 */
export async function createTask({
  userId,
  taskname,
  description = "",
  importance = 3,
  effort = 3,
  estimatedDuration = 60,
  canSplit = true,
  minChunk = 30,
  taskType = "perfect",
  chunkCount = null,
  chunkMinutes = null,
  minMinutes = null,
  maxMinutes = null,
  dueDate = null,
  category = "",
  subCategory = null,
  recurrence = null,
  tags = [],
  subtasks = [],
}) {
  const illegalFields = getIllegalDisplayFields({
    taskname,
    description,
    subcategory: getSubcategoryLabel(subCategory),
  });
  if (illegalFields.length > 0) {
    throw new Error(buildIllegalCharsError(illegalFields));
  }

  const isSubcategoryIdString = typeof subCategory === "string" && /^[a-fA-F0-9]{24}$/.test(subCategory);
  const resolvedSubCategoryId = subCategory
    ? await resolveSubcategoryId({
        userId,
        subcategory: subCategory,
        subcategoryName: typeof subCategory === "string" && !isSubcategoryIdString ? subCategory : undefined,
        parent: category,
        icon: typeof subCategory === "object" ? subCategory.icon : null,
        source: typeof subCategory === "object" ? subCategory.source || "user" : "user",
        confidence: typeof subCategory === "object" ? (subCategory.confidence ?? 1) : 1,
      })
    : null;

  const subCategoryForLog =
    typeof subCategory === "string" && !isSubcategoryIdString
      ? { label: subCategory, source: "user", confidence: 1 }
      : typeof subCategory === "object"
        ? subCategory
        : null;

  const created = await Task.create({
    userId,
    taskname,
    description,
    importance,
    effort,
    estimatedDuration,
    canSplit,
    minChunk,
    taskType,
    chunkCount,
    chunkMinutes,
    minMinutes,
    maxMinutes,
    dueDate,
    category,
    subCategory: resolvedSubCategoryId,
    recurrence,
    tags: tags || [],
    _pendingSubtasks: subtasks && subtasks.length > 0 ? subtasks : undefined,
  });

  // Note: SubTask documents are automatically created by the Task model's post-save hook
  // based on taskType and chunkCount. No need to create them manually here.

  if (resolvedSubCategoryId) {
    await addSubcategoryToUser(userId, resolvedSubCategoryId);
  }

  if (category && subCategory) {
    await _saveUserSubCategory(userId, category, subCategory);
  }

  await logEvent({
    type: "task_created",
    userId,
    payload: {
      taskId: created._id.toString(),
      taskname: created.taskname,
      category: created.category || "",
      subCategory: subCategoryForLog,
      importance: created.importance,
      effort: created.effort,
      estimatedDuration: created.estimatedDuration,
      canSplit: created.canSplit,
      minChunk: created.minChunk,
    },
  });

  await recordSubCategoryGeneration({
    userId,
    taskId: created._id.toString(),
    category: created.category || "",
    subCategory: subCategoryForLog,
    context: "service_create",
  });

  return created;
}

/**
 * Check if a newly created task matches a recent suggestion and log if so.
 */
export async function checkSuggestionFollowed({ userId, task, lastSuggestion, windowMs = 30 * 60 * 1000 }) {
  if (!lastSuggestion) return false;

  const withinWindow = Date.now() - lastSuggestion.at <= windowMs;
  if (!withinWindow) return false;

  const taskCategory = mapCategoryToLifecycle(task.category || "");
  if (taskCategory !== lastSuggestion.category) return false;

  await logEvent({
    type: "suggestion_followed",
    userId,
    payload: {
      trackingId: lastSuggestion.trackingId,
      taskId: task._id.toString(),
      category: lastSuggestion.category,
    },
  });

  return true;
}

/**
 * Fetch all tasks for a user.
 */
export async function getTasksForUser(userId, filter = {}) {
  const tasks = await Task.find({ userId, ...filter })
    .populate("subCategory")
    .lean();
  tasks.forEach(attachSubcategoryLabel);
  return tasks;
}

function attachSubcategoryLabel(task) {
  if (task && task.subCategory && typeof task.subCategory === "object") {
    if (!task.subCategory.label && task.subCategory.name) {
      task.subCategory.label = task.subCategory.name;
    }
  }
  return task;
}

/**
 * Backwards-compatible helper used by HTTP controllers
 * Accepts filters: tag, completed (boolean), dueBefore, dueAfter, search
 */
export async function getTasks(userId, filters = {}) {
  const q = { userId };
  if (filters.tag) q.category = filters.tag; // Map tag filter to category
  if (filters.category) q.category = filters.category;
  if (filters.completed !== undefined) q.status = filters.completed ? "done" : { $ne: "done" };
  if (filters.dueBefore) q.dueDate = { ...q.dueDate, $lte: new Date(filters.dueBefore) };
  if (filters.dueAfter) q.dueDate = { ...q.dueDate, $gte: new Date(filters.dueAfter) };
  if (filters.search) q.taskname = { $regex: filters.search, $options: "i" };

  const tasks = await Task.find(q).populate("subCategory").lean();
  tasks.forEach(attachSubcategoryLabel);
  console.log(`[getTasks] Query: ${JSON.stringify(q)}`);
  console.log(`[getTasks] Found ${tasks.length} tasks matching filters`);
  tasks.forEach((t) => {
    console.log(`  - ${t._id} (${t.taskname}) taskType: ${t.taskType}`);
  });

  // For ALL tasks, fetch their subtasks (not just split tasks)
  // This ensures we always have subtask data when needed
  const taskIds = tasks.map((task) => task._id);
  if (taskIds.length > 0) {
    const subtasks = await SubTask.find({ userId, taskId: { $in: taskIds } }).lean();
    console.log(`[getTasks] Query subtasks: { userId: ${userId}, taskId: { $in: [${taskIds.length} ids] } }`);
    console.log(`[getTasks] Found ${subtasks.length} subtasks for ${taskIds.length} tasks`);
    if (subtasks.length > 0) {
      subtasks.forEach((st) => {
        console.log(`  - SubTask ${st._id} for Task ${st.taskId} (title: ${st.title}) status: ${st.status}`);
      });
    }

    // Fetch scheduled sessions for all tasks (last 14 days + future)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const schedules = await TaskSchedule.find({
      userId,
      taskId: { $in: taskIds },
      start: { $gte: fourteenDaysAgo },
    }).lean();
    console.log(`[getTasks] Found ${schedules.length} scheduled sessions for tasks`);

    // Group subtasks by taskId
    const subtasksByTaskId = {};
    subtasks.forEach((subtask) => {
      if (!subtasksByTaskId[subtask.taskId]) {
        subtasksByTaskId[subtask.taskId] = [];
      }
      subtasksByTaskId[subtask.taskId].push(subtask);
    });

    // Group schedules by taskId (and also track subtask schedules)
    const schedulesByTaskId = {};
    const schedulesBySubtaskKey = {}; // key: "taskId:subtaskIndex"
    schedules.forEach((sched) => {
      const taskIdStr = sched.taskId.toString();
      if (!schedulesByTaskId[taskIdStr]) {
        schedulesByTaskId[taskIdStr] = [];
      }
      schedulesByTaskId[taskIdStr].push({
        id: sched._id,
        start: sched.start,
        end: sched.end,
        minutes: sched.minutes,
        status: sched.status,
        subtaskIndex: sched.subtaskIndex,
        subtaskTitle: sched.subtaskTitle,
      });

      // Also track by subtask key for attaching to subtasks
      if (sched.subtaskIndex !== undefined && sched.subtaskIndex !== null) {
        const key = `${taskIdStr}:${sched.subtaskIndex}`;
        if (!schedulesBySubtaskKey[key]) {
          schedulesBySubtaskKey[key] = [];
        }
        schedulesBySubtaskKey[key].push({
          id: sched._id,
          start: sched.start,
          end: sched.end,
          minutes: sched.minutes,
          status: sched.status,
        });
      }
    });

    // Attach subtasks and schedules to tasks
    tasks.forEach((task) => {
      const taskIdStr = task._id.toString();

      // Attach subtasks
      if (subtasksByTaskId[task._id]) {
        task.subTasks = subtasksByTaskId[task._id].map((st) => ({
          ...st,
          // Attach scheduled sessions to each subtask
          scheduledSessions: schedulesBySubtaskKey[`${taskIdStr}:${st.index}`] || [],
        }));
        console.log(`[getTasks] Task ${task._id} (${task.taskname}) has ${task.subTasks.length} subtasks`);
      } else {
        task.subTasks = []; // Ensure empty array if no subtasks
        console.log(`[getTasks] Task ${task._id} (${task.taskname}) has NO subtasks`);
      }

      // Attach scheduled sessions to task (for tasks without subtasks or for task-level view)
      task.scheduledSessions = schedulesByTaskId[taskIdStr] || [];
    });
  }

  return tasks;
}

/**
 * Fetch a single task by ID (with subcategory populated).
 */
export async function getTaskById(taskId, userId) {
  if (!taskId) return null;
  const query = userId ? { _id: taskId, userId } : { _id: taskId };
  const task = await Task.findOne(query).populate("subCategory").lean();
  return attachSubcategoryLabel(task);
}

/**
 * Fetch upcoming tasks for a user.
 */
export async function getUpcomingTasks(userId, days = 7) {
  const tasks = await Task.findUpcoming(userId, days).populate("subCategory").lean();
  tasks.forEach(attachSubcategoryLabel);
  return tasks;
}

/**
 * Fetch overdue tasks for a user.
 */
export async function getOverdueTasks(userId) {
  const tasks = await Task.findOverdue(userId).populate("subCategory").lean();
  tasks.forEach(attachSubcategoryLabel);
  return tasks;
}

/**
 * Fetch scheduled tasks grouped by day (today + upcoming).
 * Returns task details with scheduled sessions and subtask metadata.
 */
export async function getScheduledTasksByDay(userId, days = 7) {
  const windowStart = startOfDay(new Date());
  const windowEnd = addDays(windowStart, days);
  const todayKey = formatLocalDate(windowStart);

  const sessions = await TaskSchedule.find({
    userId,
    start: { $gte: windowStart, $lt: windowEnd },
  })
    .sort({ start: 1 })
    .lean();

  if (!sessions.length) {
    return { days, today: { date: todayKey, tasks: [] }, upcoming: [] };
  }

  const taskIds = Array.from(new Set(sessions.map((s) => toId(s.taskId)).filter(Boolean)));
  const tasks = await Task.find({ userId, _id: { $in: taskIds } })
    .populate("subCategory")
    .lean();
  tasks.forEach(attachSubcategoryLabel);
  const taskMap = new Map(tasks.map((t) => [toId(t._id), t]));

  const subtasks = await SubTask.find({ taskId: { $in: taskIds } })
    .select({ taskId: 1, index: 1, title: 1, status: 1 })
    .lean();
  const subtaskMap = buildSubtaskMap(subtasks);

  const groups = new Map();
  for (const session of sessions) {
    const taskId = toId(session.taskId);
    if (!taskId) continue;

    const task = taskMap.get(taskId);
    if (!task) continue;

    const dateKey = session.start ? formatLocalDate(new Date(session.start)) : null;
    if (!dateKey) continue;

    if (!groups.has(dateKey)) groups.set(dateKey, new Map());
    const groupTasks = groups.get(dateKey);

    if (!groupTasks.has(taskId)) {
      groupTasks.set(taskId, {
        id: taskId,
        title: task.taskname,
        status: task.status,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
        importance: task.importance,
        effort: task.effort,
        progressPercentage: task.progressPercentage ?? 0,
        taskType: task.taskType || null,
        subCategory: task.subCategory || null,
        subcategory: task.subCategory ? task.subCategory.label || task.subCategory.name : null,
        category: task.category || null,
        description: task.description,
        estimatedDuration: task.estimatedDuration,
        canSplit: task.canSplit,
        scheduledSessions: [],
      });
    }

    groupTasks.get(taskId).scheduledSessions.push(normalizeScheduleSession(session, subtaskMap));
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  const today = {
    date: todayKey,
    tasks: groups.has(todayKey) ? Array.from(groups.get(todayKey).values()) : [],
  };
  const upcoming = sortedKeys
    .filter((key) => key !== todayKey)
    .map((key) => ({
      date: key,
      tasks: Array.from(groups.get(key).values()),
    }));

  return { days, today, upcoming };
}

/**
 * Get detailed progress for a task with split parts.
 * Returns the task, all its subtasks, and their associated schedule blocks.
 *
 * @param {string} userId - User ID
 * @param {string} taskId - Task ID
 * @returns {Promise<object>} Task with subtasks and schedule info
 *
 * Example response:
 * {
 *   task: { _id, taskname, taskType, chunkCount, estimatedDuration, ... },
 *   subtasks: [
 *     { _id, index: 1, title, status, minutes, scheduledAt: {...schedule...} },
 *     { _id, index: 2, title, status, minutes, scheduledAt: {...schedule...} }
 *   ],
 *   completedParts: 2,
 *   totalParts: 4,
 *   overallProgress: 0.5
 * }
 */
export async function getTaskProgress(userId, taskId) {
  // Get the task
  const task = await Task.findOne({
    _id: taskId,
    userId,
  })
    .populate("subCategory")
    .lean();

  attachSubcategoryLabel(task);

  if (!task) {
    return null;
  }

  // Get all subtasks for this task
  const subtasks = await SubTask.find({
    taskId,
  })
    .sort({ index: 1 })
    .lean();

  // Get all schedule blocks for this task
  const schedules = await TaskSchedule.find({
    taskId,
  })
    .sort({ start: 1 })
    .lean();

  // Map subtask index to schedule info
  const subtaskMap = buildSubtaskMap(subtasks);
  const normalizedSessions = schedules.map((schedule) => normalizeScheduleSession(schedule, subtaskMap));
  const schedulesBySubtaskIndex = new Map();

  for (const session of normalizedSessions) {
    if (session.subtaskIndex) {
      if (!schedulesBySubtaskIndex.has(session.subtaskIndex)) {
        schedulesBySubtaskIndex.set(session.subtaskIndex, []);
      }
      schedulesBySubtaskIndex.get(session.subtaskIndex).push(session);
    }
  }

  // Enrich subtasks with schedule info
  const enrichedSubtasks = subtasks.map((st) => ({
    ...st,
    scheduledSessions: schedulesBySubtaskIndex.get(st.index) || [],
  }));

  // Calculate progress (using cached progressPercentage from task)
  const completedParts = subtasks.filter((st) => st.status === "done").length;
  const totalParts = subtasks.length;
  const overallProgress = totalParts > 0 ? completedParts / totalParts : 0;
  const progressPercentage = task.progressPercentage || 0; // Cached value from Task model

  return {
    task,
    subtasks: enrichedSubtasks,
    scheduledSessions: normalizedSessions,
    completedParts,
    totalParts,
    overallProgress,
    progressPercentage, // 0-100 format
  };
}

/**
 * Sync a task's status based on its scheduled sessions.
 */
export async function syncTaskStatusFromSessions(taskId) {
  const sessions = await TaskSchedule.find({ taskId }).lean();
  if (!sessions.length) return "todo";

  const allCompleted = sessions.every((s) => s.status === "completed");
  const someCompleted = sessions.some((s) => s.status === "completed");

  let newStatus;
  if (allCompleted) {
    newStatus = "done";
  } else if (someCompleted) {
    newStatus = "in_progress";
  } else {
    newStatus = "todo";
  }

  await Task.updateOne({ _id: taskId }, { $set: { status: newStatus } });
  return newStatus;
}

/**
 * Update a schedule entry's status and sync the parent task.
 */
export async function updateScheduleEntryStatus({ userId, sessionId, newStatus }) {
  const session = await TaskSchedule.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new Error("Session not found.");
  }

  await TaskSchedule.updateOne({ _id: sessionId }, { $set: { status: newStatus } });

  await logEvent({
    type: "schedule_updated",
    userId,
    payload: {
      sessionId: sessionId.toString(),
      status: newStatus,
    },
  });

  let taskStatus = "todo";
  if (session.taskId) {
    taskStatus = await syncTaskStatusFromSessions(session.taskId);
  }

  return { sessionStatus: newStatus, taskStatus };
}

/**
 * Update an existing task's fields.
 */
export async function updateTask({ userId, taskId, updates }) {
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    return { success: false, error: "Task not found or you don't have permission to edit it." };
  }

  const allowedFields = [
    "taskname",
    "description",
    "importance",
    "effort",
    "estimatedDuration",
    "canSplit",
    "minChunk",
    "taskType",
    "chunkCount",
    "chunkMinutes",
    "minMinutes",
    "maxMinutes",
    "recurrence",
    "dueDate",
    "status",
    "category",
    "subCategory",
    "actualCompletionMinutes",
    "tags",
    "subtasks",
  ];

  const sanitizedUpdates = {};
  for (const field of allowedFields) {
    // Ignore undefined to avoid clearing fields unintentionally
    if (updates[field] !== undefined && updates[field] !== null) {
      sanitizedUpdates[field] = updates[field];
    } else if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] === null) {
      // Allow explicit null for splitting-related fields so updates can intentionally clear them
      if (["minChunk", "chunkCount", "chunkMinutes", "minMinutes", "maxMinutes"].includes(field)) {
        sanitizedUpdates[field] = null;
      }
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return { success: false, error: "No valid fields to update." };
  }

  const illegalFields = getIllegalDisplayFields({
    taskname: sanitizedUpdates.taskname,
    description: sanitizedUpdates.description,
    subcategory: getSubcategoryLabel(sanitizedUpdates.subCategory),
  });
  if (illegalFields.length > 0) {
    return { success: false, error: buildIllegalCharsError(illegalFields) };
  }

  // Validate numeric fields when provided
  if (sanitizedUpdates.estimatedDuration !== undefined) {
    const d = sanitizedUpdates.estimatedDuration;
    if (typeof d !== "number" || isNaN(d) || d <= 0) {
      return { success: false, error: "Invalid estimatedDuration. Provide minutes as a positive number." };
    }
  }

  if (sanitizedUpdates.effort !== undefined) {
    const e = sanitizedUpdates.effort;
    if (!Number.isInteger(e) || e < 1 || e > 5) {
      return { success: false, error: "Effort must be an integer between 1 and 5." };
    }
  }

  // Fetch existing task to detect subcategory changes
  const existing = await Task.findOne({ _id: taskId, userId }).lean();
  const cat = sanitizedUpdates.category || existing?.category || "";

  // If user provided a subCategory, resolve to ID and record telemetry
  if (sanitizedUpdates.subCategory) {
    const rawSub = sanitizedUpdates.subCategory;
    const isSubIdString = typeof rawSub === "string" && /^[a-fA-F0-9]{24}$/.test(rawSub);

    const resolvedSubCategoryId = await resolveSubcategoryId({
      userId,
      subcategory: rawSub,
      subcategoryName: typeof rawSub === "string" && !isSubIdString ? rawSub : undefined,
      parent: cat,
      icon: typeof rawSub === "object" ? rawSub.icon : null,
      source: typeof rawSub === "object" ? rawSub.source || "user" : "user",
      confidence: typeof rawSub === "object" ? (rawSub.confidence ?? 1) : 1,
    });

    if (!resolvedSubCategoryId) {
      return { success: false, error: "Invalid subcategory selection." };
    }

    sanitizedUpdates.subCategory = resolvedSubCategoryId;

    await addSubcategoryToUser(userId, resolvedSubCategoryId);

    // Persist to user profile only when a name is provided
    if (!isSubIdString || typeof rawSub === "object") {
      try {
        await _saveUserSubCategory(userId, cat, rawSub);
      } catch (err) {
        logger.warn(`Failed to persist subcategory during update: ${err.message}`);
      }
    }

    const existingSub = existing?.subCategory
      ? await findSubcategoryById({ userId, subcategoryId: existing.subCategory })
      : null;
    const existingLabel = existingSub?.name || existingSub?.label || "";

    const subCategoryForLog =
      typeof rawSub === "string" && !isSubIdString
        ? { label: rawSub, source: "user", confidence: 1 }
        : typeof rawSub === "object"
          ? rawSub
          : await findSubcategoryById({ userId, subcategoryId: resolvedSubCategoryId });
    const newLabel = subCategoryForLog?.label || subCategoryForLog?.name || "";

    if (existingLabel && newLabel && existingLabel !== newLabel) {
      // User replaced an existing subcategory
      await recordSubCategoryOverride({
        userId,
        taskId: taskId.toString(),
        previous: existingSub || existing?.subCategory,
        replacement: subCategoryForLog,
        context: "service_update",
      });
    } else {
      // New subcategory created for this user/task
      await recordSubCategoryGeneration({
        userId,
        taskId: taskId.toString(),
        categories: [sanitizedUpdates.category || existing?.category || ""],
        subCategory: subCategoryForLog,
        context: "service_update",
      });
    }
  }

  const updated = await Task.findByIdAndUpdate(taskId, { $set: sanitizedUpdates }, { new: true }).lean();

  // If subtasks were provided as part of the update, apply them to SubTask documents
  if (sanitizedUpdates.subtasks !== undefined) {
    try {
      for (const s of sanitizedUpdates.subtasks) {
        // If an id was provided, update the existing subtask
        if (s.id) {
          const updateFields = {};
          if (s.title !== undefined) updateFields.title = String(s.title).trim();
          if (s.description !== undefined) updateFields.description = String(s.description);
          if (s.minutes !== undefined) updateFields.minutes = Number(s.minutes);
          if (s.index !== undefined) updateFields.index = Number(s.index);

          if (Object.keys(updateFields).length > 0) {
            await SubTask.findOneAndUpdate({ _id: s.id, userId, taskId }, { $set: updateFields }, { new: true }).lean();
          }
        } else if (s.title && s.title.trim().length > 0) {
          // Create a new subtask if no id provided
          const count = await SubTask.countDocuments({ taskId });
          const idx = s.index !== undefined ? Number(s.index) : count + 1;
          await SubTask.create({
            taskId,
            userId,
            index: idx,
            title: s.title.trim(),
            description: s.description || "",
            minutes: s.minutes ? Number(s.minutes) : 0,
          });
        }
      }

      // Recompute progress percentage after modifying subtasks (avoid relying on local helper scope)
      const updatedSubtasks = await SubTask.find({ taskId }).lean();
      let progressPercentage = 0;
      if (updatedSubtasks.length > 0) {
        const completedCount = updatedSubtasks.filter((st) => st.status === "done").length;
        progressPercentage = Math.round((completedCount / updatedSubtasks.length) * 100);
      }
      await Task.updateOne({ _id: taskId }, { $set: { progressPercentage } });
    } catch (err) {
      logger.warn("Failed to apply subtask updates:", err && err.message);
    }
  }

  await logEvent({
    type: "task_updated",
    userId,
    payload: {
      taskId: taskId.toString(),
      updatedFields: Object.keys(sanitizedUpdates),
      changes: sanitizedUpdates,
    },
  });

  // If splitting-related fields changed, ensure subtask sync
  const splitFields = [
    "taskType",
    "chunkCount",
    "chunkMinutes",
    "minMinutes",
    "maxMinutes",
    "minChunk",
    "estimatedDuration",
  ];
  if (Object.keys(sanitizedUpdates).some((f) => splitFields.includes(f))) {
    try {
      await syncSubTasksForTask({ taskId });
    } catch (err) {
      logger.warn("Failed to sync subtasks after task update:", err && err.message);
    }
  }

  return { success: true, task: updated };
}

/**
 * Ensure subtasks exist/are removed to match task settings
 */
export async function syncSubTasksForTask({ taskId }) {
  if (!taskId) return;
  const task = await Task.findById(taskId).lean();
  if (!task) return;

  // Only relevant for "in_parts" / "leaky"
  if (!["in_parts", "leaky"].includes(task.taskType)) {
    await SubTask.deleteMany({ taskId }).catch(() => {});
    return;
  }

  const minChunk = task.minChunk || 30;
  const desiredCount =
    task.chunkCount && Number.isInteger(task.chunkCount) && task.chunkCount > 0
      ? task.chunkCount
      : Math.max(1, Math.ceil((task.estimatedDuration || minChunk) / minChunk));

  const existing = await SubTask.find({ taskId }).sort({ index: 1 }).lean();

  if (existing.length < desiredCount) {
    const toCreate = desiredCount - existing.length;
    const startIndex = existing.length + 1;
    const createOps = [];
    for (let i = 0; i < toCreate; i++) {
      const idx = startIndex + i;
      createOps.push({
        taskId,
        userId: task.userId,
        index: idx,
        title: `Part ${idx}`,
        minutes: task.chunkMinutes || Math.round((task.estimatedDuration || minChunk) / desiredCount),
      });
    }
    if (createOps.length) {
      await SubTask.insertMany(createOps);
    }
  }

  if (existing.length > desiredCount) {
    const toRemove = existing.slice(desiredCount).map((s) => s._id);
    if (toRemove.length) {
      await SubTask.deleteMany({ _id: { $in: toRemove } });
    }
  }

  // Fix up indexes/titles
  const updatedList = await SubTask.find({ taskId }).sort({ index: 1 });
  for (let i = 0; i < updatedList.length; i++) {
    const desiredIndex = i + 1;
    const s = updatedList[i];
    let changed = false;
    if (s.index !== desiredIndex) {
      s.index = desiredIndex;
      changed = true;
    }
    if (!s.title || s.title.trim() === "") {
      s.title = `Part ${desiredIndex}`;
      changed = true;
    }
    if (changed) await s.save();
  }
}

/**
 * Extend the deadline of a task.
 */
export async function extendTaskDeadline({ taskId, userId, newDeadline }) {
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  if (!newDeadline || !(newDeadline instanceof Date) || isNaN(newDeadline.getTime())) {
    return { success: false, error: "Valid new deadline is required." };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (newDeadline <= now) {
    return { success: false, error: "New deadline must be in the future." };
  }

  try {
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId },
      { $set: { dueDate: newDeadline } },
      { new: true },
    ).lean();

    if (!task) {
      return { success: false, error: "Task not found or you don't have permission." };
    }

    await logEvent({
      type: "task_deadline_extended",
      userId,
      payload: {
        taskId: taskId.toString(),
        newDeadline: newDeadline.toISOString(),
      },
    });

    return { success: true, task };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete/forfeit a task and its scheduled sessions.
 */
export async function deleteTask({ taskId, userId }) {
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  try {
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      return { success: false, error: "Task not found or you don't have permission." };
    }

    const taskname = task.taskname;

    // Use a safety-aware findOneAndDelete that includes userId so we never delete across users
    const deleted = await Task.findOneAndDelete({ _id: taskId, userId });

    if (!deleted) {
      // If deletion didn't occur, log and return failure so callers don't assume success
      try {
        const { logger } = await import("../utils/logger.js");
        logger.error(`[taskService] Deletion failed: Task ${taskId} still present for user ${userId}`);
      } catch (e) {
        // ignore logging failures
      }
      return { success: false, error: "Task deletion failed" };
    }

    // Verify deletion actually removed the document (defensive check)
    const stillExists = await Task.findById(taskId);
    if (stillExists) {
      try {
        const { logger } = await import("../utils/logger.js");
        logger.error(`[taskService] Post-delete verification failed: Task ${taskId} still exists after delete call`);
      } catch (e) {
        // ignore logging failures
      }
      return { success: false, error: "Task deletion did not complete" };
    }

    try {
      await TaskSchedule.deleteMany({ taskId });
    } catch {
      // Ignore if no schedules exist
    }

    // Remove subtasks associated with this task
    try {
      await SubTask.deleteMany({ taskId });
    } catch {
      // Ignore if none exist
    }

    await logEvent({
      type: "task_deleted",
      userId,
      payload: {
        taskId: taskId.toString(),
        taskname,
      },
    });

    return { success: true, taskname };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark a task as complete and trigger ML model training
 *
 * ⭐ CRITICAL FUNCTION FOR ML LEARNING ⭐
 *
 * This is where the ML model learns from actual user behavior:
 * 1. Calculates actual work time from completed TaskSchedule sessions
 * 2. Saves actualCompletionMinutes to the task
 * 3. Triggers ML model training with reward based on estimation accuracy
 *
 * The ML model learns:
 * - How accurate the user's time estimates were (reward calculation)
 * - Task characteristics (importance, effort, category, deadline pressure)
 * - User-specific patterns across similar tasks (per-user models)
 *
 * @param {object} params - { taskId, userId }
 * @returns {Promise<object>} { success, task, actualCompletionMinutes }
 */
export async function completeTask({ taskId, userId }) {
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  try {
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      return { success: false, error: "Task not found or you don't have permission." };
    }

    // Check if task was already completed
    const wasAlreadyCompleted = task.status === "done";

    // Calculate actual completion time by summing all completed work sessions
    const completedSessions = await TaskSchedule.find({
      taskId,
      status: "completed",
    }).lean();

    const actualCompletionMinutes = completedSessions.reduce((total, session) => total + (session.minutes || 0), 0);

    // ========================================================================
    // VALIDATION: Warn if no work sessions tracked (edge case)
    // ========================================================================
    if (actualCompletionMinutes === 0) {
      console.warn(`⚠️  Task completed with 0 minutes tracked:`, {
        taskId: taskId.toString(),
        taskname: task.taskname,
        estimatedDuration: task.estimatedDuration,
        sessionCount: completedSessions.length,
      });
      // Still proceed - user might have completed task without tracking sessions
    }

    const now = new Date();

    const updated = await Task.findByIdAndUpdate(
      taskId,
      {
        $set: {
          status: "done",
          actualCompletionMinutes,
          completedAt: now,
        },
      },
      { new: true },
    ).lean(); // Get plain object directly

    // Mark any remaining subtasks as completed (set status and completedAt)
    try {
      await SubTask.updateMany({ taskId, status: { $ne: "done" } }, { $set: { status: "done", completedAt: now } });
    } catch (err) {
      console.warn(`[completeTask] Failed to mark subtasks completed for task ${taskId}:`, err && err.message);
    }

    // Mark all planned TaskSchedule sessions for this task as completed
    try {
      await TaskSchedule.updateMany({ taskId, status: "planned" }, { $set: { status: "completed" } });
      console.log(`[completeTask] Marked TaskSchedule sessions as completed for task ${taskId}`);
    } catch (schedErr) {
      console.warn(`[completeTask] Failed to update TaskSchedule status:`, schedErr && schedErr.message);
    }

    await logEvent({
      type: "task_completed",
      userId,
      payload: {
        taskId: taskId.toString(),
        taskname: task.taskname,
        actualCompletionMinutes,
        estimatedDuration: task.estimatedDuration,
      },
    });

    // ========================================================================
    // ML TRAINING: Train with completion data (with comprehensive error handling)
    // ========================================================================
    try {
      // Structured log before training
      try {
        console.log(
          JSON.stringify({
            event: "task_completed_training_start",
            taskId: taskId.toString(),
            userId,
            taskname: task.taskname,
            estimatedDuration: task.estimatedDuration,
            actualCompletionMinutes,
            sessionCount: completedSessions.length,
          }),
        );
      } catch (err) {
        console.log(
          "[task_completed_training_start] taskId=%s userId=%s estimated=%s actual=%s",
          taskId.toString(),
          userId,
          task.estimatedDuration,
          actualCompletionMinutes,
        );
      }

      const trainingResult = await trainTask(updated);

      if (trainingResult.success) {
        console.log(`✅ ML model trained successfully (reward: ${trainingResult.reward?.toFixed(3)})`);
      } else {
        console.error(`❌ ML training failed:`, {
          taskId: taskId.toString(),
          taskname: task.taskname,
          error: trainingResult.error,
          actualMinutes: actualCompletionMinutes,
          estimatedMinutes: task.estimatedDuration,
        });
      }
    } catch (mlError) {
      // Don't fail task completion if ML training fails
      console.error(`❌ ML training error (task still completed):`, {
        taskId: taskId.toString(),
        taskname: task.taskname,
        error: mlError.message,
        stack: mlError.stack?.split("\n")[0],
      });
    }

    return { success: true, task: updated, actualCompletionMinutes, wasAlreadyCompleted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Toggle task completion status.
 * If marking as done, set status="done"; if already done, revert to "todo".
 * Returns { task, wasNewCompletion, wasNewUncompletion } where:
 * - wasNewCompletion indicates if this toggle resulted in a new completion
 * - wasNewUncompletion indicates if this toggle reverted a completion (for point subtraction)
 */
export async function toggleTaskCompletion(taskId, userId) {
  if (!taskId) {
    return null;
  }

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) return null;

  const wasCompleted = task.status === "done";
  const wasIncomplete = task.status !== "done";
  const nextStatus = task.status === "done" ? "todo" : "done";

  const updatePayload = { status: nextStatus };
  if (nextStatus === "done") {
    updatePayload.completedAt = new Date();
  } else {
    updatePayload.completedAt = null;
    // Reset earnedPoints when marking as incomplete (the controller will use this value first)
    updatePayload.earnedPoints = 0;
  }

  // Store the earnedPoints before resetting (for reversal calculation)
  const previousEarnedPoints = task.earnedPoints || 0;

  const updated = await Task.findByIdAndUpdate(
    taskId,
    {
      $set: updatePayload,
    },
    { new: true },
  ).lean();

  // Attach previousEarnedPoints to the returned task for reversal calculation
  updated.previousEarnedPoints = previousEarnedPoints;

  // Update TaskSchedule entries for this task
  // When completing: mark all planned sessions as completed
  // When uncompleting: mark all completed sessions as planned (so they don't get deleted)
  try {
    if (nextStatus === "done") {
      // Mark all planned sessions for this task as completed
      await TaskSchedule.updateMany({ taskId, status: "planned" }, { $set: { status: "completed" } });
      console.log(`[toggleTaskCompletion] Marked TaskSchedule sessions as completed for task ${taskId}`);
    } else {
      // Mark all completed sessions for this task as planned (reverting)
      await TaskSchedule.updateMany({ taskId, status: "completed" }, { $set: { status: "planned" } });
      console.log(`[toggleTaskCompletion] Reverted TaskSchedule sessions to planned for task ${taskId}`);
    }
  } catch (schedErr) {
    console.warn(`[toggleTaskCompletion] Failed to update TaskSchedule status:`, schedErr && schedErr.message);
  }

  await logEvent({
    type: nextStatus === "done" ? "task_completed_toggle" : "task_uncompleted_toggle",
    userId,
    payload: {
      taskId: taskId.toString(),
      taskname: task.taskname,
      status: nextStatus,
    },
  });

  // Return both the task and completion state flags
  return {
    task: updated,
    wasNewCompletion: wasIncomplete && nextStatus === "done",
    wasNewUncompletion: wasCompleted && nextStatus === "todo",
  };
}

/**
 * Update a task's earnedPoints field
 * Called after awarding points to store how many points were earned
 */
export async function updateTaskEarnedPoints(taskId, earnedPoints) {
  if (!taskId) return null;
  return Task.findByIdAndUpdate(taskId, { $set: { earnedPoints } }, { new: true }).lean();
}

/**
 * Update a subtask's earnedPoints field
 * Called after awarding points to store how many points were earned
 */
export async function updateSubTaskEarnedPoints(subTaskId, earnedPoints) {
  if (!subTaskId) return null;
  return SubTask.findByIdAndUpdate(subTaskId, { $set: { earnedPoints } }, { new: true }).lean();
}

// -----------------------------
// Subtask helpers
// -----------------------------

/**
 * Get all subtasks for a task (ensures user access)
 */
export async function getSubTasksForTask({ userId, taskId }) {
  if (!taskId) return [];
  return SubTask.find({ userId, taskId }).sort({ index: 1 }).lean();
}

/**
 * Get a single subtask by id (ensures user access)
 */
export async function getSubTaskById({ userId, subTaskId }) {
  if (!subTaskId) return null;
  return SubTask.findOne({ _id: subTaskId, userId }).lean();
}

/**
 * Update a subtask fields (title, description, status)
 * Returns wasAlreadyCompleted and isNewUncompletion flags to help callers decide on points
 */
export async function updateSubTask({ userId, subTaskId, updates }) {
  if (!subTaskId) return { success: false, error: "SubTask ID is required" };

  const allowed = ["title", "description", "minutes", "status"];
  const sanitized = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) sanitized[k] = updates[k];
  }

  if (Object.keys(sanitized).length === 0) return { success: false, error: "No valid fields to update" };

  const illegalFields = getIllegalDisplayFields({
    title: sanitized.title,
    description: sanitized.description,
  });
  if (illegalFields.length > 0) {
    return { success: false, error: buildIllegalCharsError(illegalFields) };
  }

  // Use find + save instead of findOneAndUpdate to trigger Mongoose hooks
  console.log(`[updateSubTask] Querying SubTask with:`, { _id: subTaskId, userId });
  const subtask = await SubTask.findOne({ _id: subTaskId, userId });
  console.log(`[updateSubTask] Query result:`, {
    found: !!subtask,
    subtaskId: subtask?._id,
    subtaskUserId: subtask?.userId,
  });

  if (!subtask) {
    console.error(`[updateSubTask] SubTask not found! Queried with _id=${subTaskId}, userId=${userId}`);
    // Debug: try to find without userId to see if it exists for other users
    const anySubtask = await SubTask.findOne({ _id: subTaskId });
    if (anySubtask) {
      console.error(
        `[updateSubTask] SubTask exists with different userId! Expected userId=${userId}, actual userId=${anySubtask.userId}`,
      );
    } else {
      console.error(`[updateSubTask] SubTask with _id=${subTaskId} doesn't exist in database at all`);
    }
    return { success: false, error: "SubTask not found or access denied" };
  }

  // Track completion state changes
  const wasAlreadyCompleted = subtask.status === "done";
  const isNewCompletion = sanitized.status === "done" && !wasAlreadyCompleted;
  const isNewUncompletion = sanitized.status === "todo" && wasAlreadyCompleted;

  // Store previous earned points for reversal calculation
  const previousEarnedPoints = subtask.earnedPoints || 0;

  // If marking done, set completedAt
  if (sanitized.status === "done") {
    sanitized.completedAt = new Date();
  }
  // If marking todo (uncompleting), reset completedAt and earnedPoints
  if (sanitized.status === "todo") {
    sanitized.completedAt = null;
    sanitized.earnedPoints = 0;
  }

  // Update TaskSchedule entries for this subtask
  // When completing: mark sessions for this subtask as completed
  // When uncompleting: mark sessions for this subtask as planned
  try {
    if (isNewCompletion) {
      // Mark scheduled sessions for this subtask as completed
      await TaskSchedule.updateMany(
        { taskId: subtask.taskId, subtaskIndex: subtask.index, status: "planned" },
        { $set: { status: "completed" } },
      );
      console.log(
        `[updateSubTask] Marked TaskSchedule sessions as completed for subtask index ${subtask.index} of task ${subtask.taskId}`,
      );
    } else if (isNewUncompletion) {
      // Mark scheduled sessions for this subtask as planned (reverting)
      await TaskSchedule.updateMany(
        { taskId: subtask.taskId, subtaskIndex: subtask.index, status: "completed" },
        { $set: { status: "planned" } },
      );
      console.log(
        `[updateSubTask] Reverted TaskSchedule sessions to planned for subtask index ${subtask.index} of task ${subtask.taskId}`,
      );
    }
  } catch (schedErr) {
    console.warn(`[updateSubTask] Failed to update TaskSchedule status:`, schedErr && schedErr.message);
  }

  // Apply updates
  Object.assign(subtask, sanitized);

  // Save to trigger post-save hooks (which sync parent Task progress)
  await subtask.save();

  const updated = subtask.toObject();
  // Attach previousEarnedPoints for reversal calculation
  updated.previousEarnedPoints = previousEarnedPoints;

  // Get parent task for context (used for point calculation)
  let parentTask = null;
  let parentTaskWasCompleted = false;
  try {
    parentTask = await Task.findById(updated.taskId).lean();
    parentTaskWasCompleted = parentTask?.status === "done";
  } catch (err) {
    // Non-fatal
  }

  // Store parent task's previous earned points (for task completion bonus reversal)
  const parentTaskPreviousEarnedPoints = parentTask?.earnedPoints || 0;

  // If all subtasks are done, mark parent task as done. If some done -> in_progress. If marking undone, task may become incomplete
  let parentTaskCompleted = false;
  let parentTaskUncompleted = false;
  try {
    const remaining = await SubTask.countDocuments({ taskId: updated.taskId, status: { $ne: "done" } });
    const total = await SubTask.countDocuments({ taskId: updated.taskId });
    if (total > 0) {
      let newStatus = "todo";
      if (remaining === 0) {
        newStatus = "done";
        parentTaskCompleted = true;
      } else if (remaining < total) {
        newStatus = "in_progress";
        // If parent was completed before but now has remaining subtasks, it's been uncompleted
        if (parentTaskWasCompleted) {
          parentTaskUncompleted = true;
        }
      }

      const updatePayload = { status: newStatus };
      // If task is being uncompleted, reset its earnedPoints
      if (parentTaskUncompleted) {
        updatePayload.earnedPoints = 0;
        updatePayload.completedAt = null;
      }
      // If task is being completed, set completedAt
      if (parentTaskCompleted && !parentTaskWasCompleted) {
        updatePayload.completedAt = new Date();
      }

      await Task.updateOne({ _id: updated.taskId }, { $set: updatePayload });
    }
  } catch (err) {
    // Non-fatal
    console.warn("Failed to sync parent task status after subtask update:", err && err.message);
  }

  // Attach parent task info for reversal calculation
  if (parentTask) {
    parentTask.previousEarnedPoints = parentTaskPreviousEarnedPoints;
  }

  return {
    success: true,
    subtask: updated,
    parentTask,
    wasAlreadyCompleted,
    isNewCompletion,
    isNewUncompletion,
    parentTaskCompleted,
    parentTaskUncompleted,
    parentTaskWasCompleted,
  };
}

// =============================================================================
// BUSY BLOCK MANAGEMENT
// =============================================================================

/**
 * Create a busy block for a user.
 */
export async function createBusyBlock({ userId, title = "", start, end }) {
  if (end <= start) {
    throw new Error("End time must be after start time.");
  }
  return BusyBlock.create({ userId, title, start, end });
}

/**
 * Fetch upcoming busy blocks for a user.
 */
export async function getUpcomingBusyBlocks(userId) {
  const now = startOfDay(new Date());
  return BusyBlock.find({
    userId,
    end: { $gte: now },
  })
    .sort({ start: 1 })
    .lean();
}

/**
 * Delete a busy block by ID.
 */
export async function deleteBusyBlock(blockId, userId) {
  const result = await BusyBlock.deleteOne({ _id: blockId, userId });
  return result.deletedCount > 0;
}

// =============================================================================
// EXPIRED TASK CHECKER
// =============================================================================

const DEFAULT_CRON = process.env.EXPIRED_CHECK_CRON || "0 * * * *";

/**
 * Find all expired tasks across all users.
 */
async function findAllExpiredTasks() {
  const now = new Date();
  return Task.find({
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  }).lean();
}

/**
 * Find expired tasks for a specific user.
 */
export async function findExpiredTasksForUser(userId) {
  const now = new Date();

  const tasks = await Task.find({
    userId,
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  })
    .sort({ dueDate: 1 })
    .lean();

  return tasks.map((task) => {
    const dueDate = new Date(task.dueDate);
    const diffMs = now - dueDate;
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return { ...task, daysOverdue };
  });
}

/**
 * Check if a user has any expired tasks.
 */
export async function userHasExpiredTasks(userId) {
  const now = new Date();
  const count = await Task.countDocuments({
    userId,
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  });
  return count > 0;
}

/**
 * Main job: check for expired tasks and log them.
 */
async function runExpiredTaskCheck() {
  logger.info("⏰ Running expired task check...");

  try {
    const expiredTasks = await findAllExpiredTasks();

    if (expiredTasks.length === 0) {
      logger.info("   No expired tasks found");
      return;
    }

    logger.info(`   Found ${expiredTasks.length} expired tasks`);

    const tasksByUser = new Map();
    for (const task of expiredTasks) {
      const userId = task.userId?.toString();
      if (!userId) continue;
      if (!tasksByUser.has(userId)) {
        tasksByUser.set(userId, { tasks: [] });
      }
      tasksByUser.get(userId).tasks.push(task);
    }

    const now = new Date();
    for (const [userId, { tasks }] of tasksByUser) {
      logger.info(`   User ${userId} has ${tasks.length} expired tasks`);
      for (const task of tasks) {
        const dueDate = new Date(task.dueDate);
        const diffMs = now - dueDate;
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        logger.info(`     - "${task.taskname}" (${daysOverdue} days overdue)`);
      }
    }

    logger.info(`✅ Expired task check complete: ${expiredTasks.length} expired tasks found`);
  } catch (error) {
    logger.error(`❌ Expired task check failed: ${error.message}`);
  }
}

let scheduledJob = null;

/**
 * Start the expired task checker scheduler.
 */
export function startExpiredTaskChecker(cronExpression = DEFAULT_CRON) {
  if (scheduledJob) {
    logger.warn("Expired task checker already running");
    return;
  }

  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  logger.info(`⏰ Starting expired task checker with cron: ${cronExpression}`);

  scheduledJob = cron.schedule(cronExpression, runExpiredTaskCheck, {
    timezone: process.env.TZ || "UTC",
  });

  runExpiredTaskCheck();

  logger.info("✅ Expired task checker started");
}

/**
 * Stop the expired task checker.
 */
export function stopExpiredTaskChecker() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    logger.info("🛑 Expired task checker stopped");
  }
}

/**
 * Manually trigger a check (for testing or API).
 */
export async function triggerExpiredTaskCheck() {
  return runExpiredTaskCheck();
}
