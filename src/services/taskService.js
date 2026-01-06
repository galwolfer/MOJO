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
import { BusyBlock } from "../models/BusyBlock.js";
import { logEvent, recordSubCategoryGeneration } from "./telemetryService.js";
import { categoryForTag } from "../algorithms/priority/tagging.js";
import { logger } from "../utils/logger.js";
import { startOfDay } from "../utils/dateUtils.js";

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
  tags = [],
  recurrence = null,
}) {
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
    tags,
    recurrence,
  });

  await logEvent({
    type: "task_created",
    userId,
    payload: {
      taskId: created._id.toString(),
      taskname: created.taskname,
      tags: created.tags || [],
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
    tags: created.tags || [],
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

  const taskCategories = new Set((task.tags || []).map((tag) => categoryForTag(tag)));
  if (!taskCategories.has(lastSuggestion.category)) return false;

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
    "taskname", "description", "importance", "effort", "estimatedDuration",
    "canSplit", "minChunk", "taskType", "chunkCount", "chunkMinutes",
    "minMinutes", "maxMinutes", "dueDate", "status", "tags",
  ];

  const sanitizedUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return { success: false, error: "No valid fields to update." };
  }

  const updated = await Task.findByIdAndUpdate(
    taskId,
    { $set: sanitizedUpdates },
    { new: true }
  ).lean();

  await logEvent({
    type: "task_updated",
    userId,
    payload: {
      taskId: taskId.toString(),
      updatedFields: Object.keys(sanitizedUpdates),
      changes: sanitizedUpdates,
    },
  });

  return { success: true, task: updated };
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
