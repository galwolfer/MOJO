/**
 * @fileoverview Task Service
 * @module services/tasks/taskService
 * 
 * Core business logic for task management in Mojo Coacher.
 * Handles all CRUD operations, status synchronization, and task-related telemetry.
 * 
 * Key responsibilities:
 * - Create, read, update, delete tasks
 * - Sync task status with scheduled sessions
 * - Generate and manage task subcategories
 * - Record task-related telemetry events
 * - Category tagging and classification
 * 
 * Task types supported: perfect, in_parts, leaky
 * 
 * @requires models/Task - Task database model
 * @requires models/TaskSchedule - Schedule database model
 */

import Task from "../../models/Task.js";
import { TaskSchedule } from "../../models/TaskSchedule.js";
import { logEvent } from "../telemetry/telemetry.js";
import { recordSubCategoryGeneration } from "../telemetry/subcategoryTelemetry.js";
import { categoryForTag } from "../../algorithms/priority/tagging.js";

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
 * @param {object} params
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
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @param {object} [filter={}]
 * @returns {Promise<object[]>}
 */
export async function getTasksForUser(userId, filter = {}) {
  return Task.find({ userId, ...filter }).lean();
}

/**
 * Sync a task's status based on its scheduled sessions.
 * - All sessions completed → done
 * - Some sessions completed → in_progress
 * - Otherwise → todo
 * @param {string | import("mongoose").Types.ObjectId} taskId
 * @returns {Promise<string>} The new status.
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
 * @param {object} params
 * @returns {Promise<{ sessionStatus: string, taskStatus: string }>}
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
 * Only provided fields will be updated (partial update).
 * @param {object} params
 * @param {string} params.userId - The user ID (for authorization)
 * @param {string} params.taskId - The task ID to update
 * @param {object} params.updates - Object containing fields to update
 * @returns {Promise<{ success: boolean, task?: object, error?: string }>}
 */
export async function updateTask({ userId, taskId, updates }) {
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  // Find the task and verify ownership
  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    return { success: false, error: "Task not found or you don't have permission to edit it." };
  }

  // Allowed fields for update
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
    "dueDate",
    "status",
    "tags",
  ];

  // Filter updates to only allowed fields
  const sanitizedUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return { success: false, error: "No valid fields to update." };
  }

  // Apply the update
  const updated = await Task.findByIdAndUpdate(
    taskId,
    { $set: sanitizedUpdates },
    { new: true }
  ).lean();

  // Log the update event
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
