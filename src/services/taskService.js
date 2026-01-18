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
import { User } from "../models/User.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { SubTask } from "../models/SubTask.js";
import { BusyBlock } from "../models/BusyBlock.js";
import { CATEGORIES, getCategoryIndex } from "../config/categories.js";
import { logEvent, recordSubCategoryGeneration, recordSubCategoryOverride } from "./telemetryService.js";
import { mapCategoryToLifecycle } from "../algorithms/priority/categorizing.js";
import { trainTask } from "./mlPredictionService.js";
import { logger } from "../utils/logger.js";
import { startOfDay } from "../utils/dateUtils.js";
import { getIllegalDisplayFields, getIllegalCharsErrorMessage } from "../utils/illegalChars.js";

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

  const subName = typeof subCategory === "string" ? subCategory : subCategory.label || subCategory.name;
  if (!subName) return;

  try {
    const idx = getCategoryIndex(categoryName);
    // Add to user's subCategories set if not exists
    await User.updateOne(
      { _id: userId },
      {
        $addToSet: {
          subCategories: { name: subName, category: idx },
        },
      }
    );
  } catch (err) {
    // Silent fail if category invalid or user not found, just log warning
    logger.warn(`Failed to sync subcategory "${subName}" for user ${userId}: ${err.message}`);
  }
}

function getSubCategoryLabel(subCategory) {
  if (!subCategory) return "";
  if (typeof subCategory === "string") return subCategory;
  if (typeof subCategory === "object") return subCategory.label || subCategory.name || "";
  return "";
}

function buildIllegalCharsError(fields) {
  return getIllegalCharsErrorMessage(fields);
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
}) {
  const illegalFields = getIllegalDisplayFields({
    taskname,
    description,
    subcategory: getSubCategoryLabel(subCategory),
  });
  if (illegalFields.length > 0) {
    throw new Error(buildIllegalCharsError(illegalFields));
  }

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
    subCategory,
    recurrence,
  });

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
      subCategory: created.subCategory || null,
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
    subCategory: created.subCategory || null,
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
  return Task.find({ userId, ...filter }).lean();
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
  return Task.find(q).lean();
}

/**
 * Fetch upcoming tasks for a user.
 */
export async function getUpcomingTasks(userId, days = 7) {
  return Task.findUpcoming(userId, days).lean();
}

/**
 * Fetch overdue tasks for a user.
 */
export async function getOverdueTasks(userId) {
  return Task.findOverdue(userId).lean();
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
    subcategory: getSubCategoryLabel(sanitizedUpdates.subCategory),
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

  // If user provided a subCategory, save it to the user profile and record generation/override telemetry
  if (sanitizedUpdates.subCategory) {
    const newSub = sanitizedUpdates.subCategory;

    // Persist to user profile
    try {
      await _saveUserSubCategory(userId, cat, newSub);
    } catch (err) {
      logger.warn(`Failed to persist subcategory during update: ${err.message}`);
    }

    if (existing && existing.subCategory && existing.subCategory.label && existing.subCategory.label !== newSub.label) {
      // User replaced an existing subcategory
      await recordSubCategoryOverride({
        userId,
        taskId: taskId.toString(),
        previous: existing.subCategory,
        replacement: newSub,
        context: "service_update",
      });
    } else {
      // New subcategory created for this user/task
      await recordSubCategoryGeneration({
        userId,
        taskId: taskId.toString(),
        categories: [sanitizedUpdates.category || existing?.category || ""],
        subCategory: newSub,
        context: "service_update",
      });
    }
  }

  const updated = await Task.findByIdAndUpdate(taskId, { $set: sanitizedUpdates }, { new: true }).lean();

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
  const splitFields = ["taskType", "chunkCount", "chunkMinutes", "minMinutes", "maxMinutes", "minChunk", "estimatedDuration"];
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
  const desiredCount = task.chunkCount && Number.isInteger(task.chunkCount) && task.chunkCount > 0
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
      { new: true }
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

    await Task.findByIdAndDelete(taskId);

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

    const updated = await Task.findByIdAndUpdate(
      taskId,
      {
        $set: {
          status: "done",
          actualCompletionMinutes,
        },
      },
      { new: true }
    ).lean(); // Get plain object directly

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
      console.log(`🎯 Training ML model for completed task: ${task.taskname}`);

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

    return { success: true, task: updated, actualCompletionMinutes };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

  // If marking done, set completedAt
  if (sanitized.status === "done") sanitized.completedAt = new Date();
  if (sanitized.status === "todo") sanitized.completedAt = null;

  const updated = await SubTask.findOneAndUpdate({ _id: subTaskId, userId }, { $set: sanitized }, { new: true }).lean();

  if (!updated) return { success: false, error: "SubTask not found or access denied" };

  // If all subtasks are done, optionally mark parent task as done. If some done -> in_progress
  try {
    const remaining = await SubTask.countDocuments({ taskId: updated.taskId, status: { $ne: "done" } });
    const total = await SubTask.countDocuments({ taskId: updated.taskId });
    if (total > 0) {
      let newStatus = "todo";
      if (remaining === 0) newStatus = "done";
      else if (remaining < total) newStatus = "in_progress";
      await Task.updateOne({ _id: updated.taskId }, { $set: { status: newStatus } });
    }
  } catch (err) {
    // Non-fatal
    console.warn("Failed to sync parent task status after subtask update:", err && err.message);
  }

  return { success: true, subtask: updated };
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
