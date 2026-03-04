/*
 * File: src/controllers/taskController.js
 * Purpose: Task-related HTTP controllers (create, update, list, expired management)
 */

import * as taskService from "../services/taskService.js";
import { logger } from "../utils/logger.js";
import { Task } from "../models/Task.js";
import { SubTask } from "../models/SubTask.js";
import { isValidCategory } from "../config/categories.js";
import { hasIllegalDisplayChars } from "../utils/illegalChars.js";
import { triggerSchedulerUpdate } from "../services/schedulingService.js";
import { findOrCreateSubcategory } from "../services/subcategoryService.js";

/**
 * Task Controller
 * Handles HTTP requests for task operations
 */

/**
 * DEBUG: Update completedAt for a task (for testing purposes)
 * PATCH /api/tasks/:id/debug/completed-at
 * Body: { completedAt: "2026-01-30T10:00:00Z" } or { completedAt: null }
 */
export async function debugUpdateTaskCompletedAt(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { completedAt, status } = req.body;

    const task = await Task.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const updates = {};
    if (completedAt !== undefined) {
      updates.completedAt = completedAt ? new Date(completedAt) : null;
    }
    if (status !== undefined) {
      updates.status = status;
    }

    const updated = await Task.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    logger.info(`[DEBUG] Updated task ${id} completedAt to ${updates.completedAt}, status to ${updates.status}`);

    return res.status(200).json({
      success: true,
      task: updated,
      message: "Task completedAt updated (DEBUG)",
    });
  } catch (error) {
    logger.error("[DEBUG] Error updating task completedAt:", error);
    return res.status(500).json({ success: false, error: "Failed to update task completedAt" });
  }
}

/**
 * DEBUG: Update completedAt for a subtask (for testing purposes)
 * PATCH /api/tasks/:taskId/subtasks/:subId/debug/completed-at
 * Body: { completedAt: "2026-01-30T10:00:00Z" } or { completedAt: null }
 */
export async function debugUpdateSubtaskCompletedAt(req, res) {
  try {
    const userId = req.user.userId;
    const { taskId, subId } = req.params;
    const { completedAt, status } = req.body;

    const subtask = await SubTask.findOne({ _id: subId, userId, taskId });
    if (!subtask) {
      return res.status(404).json({ success: false, error: "Subtask not found" });
    }

    const updates = {};
    if (completedAt !== undefined) {
      updates.completedAt = completedAt ? new Date(completedAt) : null;
    }
    if (status !== undefined) {
      updates.status = status;
    }

    const updated = await SubTask.findByIdAndUpdate(subId, { $set: updates }, { new: true }).lean();

    logger.info(`[DEBUG] Updated subtask ${subId} completedAt to ${updates.completedAt}, status to ${updates.status}`);

    return res.status(200).json({
      success: true,
      subtask: updated,
      message: "Subtask completedAt updated (DEBUG)",
    });
  } catch (error) {
    logger.error("[DEBUG] Error updating subtask completedAt:", error);
    return res.status(500).json({ success: false, error: "Failed to update subtask completedAt" });
  }
}

/**
 * Auto-save subcategory to user profile
 * Automatically adds new subcategories to user's collection when they create/update tasks
 * Exported as a helper for use in missions and other controllers
 *
 * @param {string} userId - User ID
 * @param {string} subcategoryName - Subcategory name
 * @param {string} categoryKey - Category key (e.g., "work_and_career")
 * @returns {Promise<void>}
 */
export async function autoSaveSubcategory(userId, subcategoryName, categoryKey) {
  try {
    // Validate inputs
    if (!subcategoryName || typeof subcategoryName !== "string" || subcategoryName.trim().length === 0) {
      return; // Skip if invalid
    }

    if (!categoryKey || !isValidCategory(categoryKey)) {
      return; // Skip if invalid category
    }

    const trimmedName = subcategoryName.trim();
    await findOrCreateSubcategory({
      userId,
      name: trimmedName,
      parent: categoryKey,
      source: "user",
      confidence: 1,
    });
    logger.info(`Auto-saved subcategory "${trimmedName}" to category ${categoryKey} for user ${userId}`);
  } catch (error) {
    // Log error but don't fail the task operation
    logger.error(`Failed to auto-save subcategory: ${error.message}`);
  }
}

/**
 * Suggest category and subcategory for a task name
 * POST /api/tasks/suggest-category
 */
export async function suggestCategory(req, res) {
  try {
    const userId = req.user.userId;
    const { taskname } = req.body;

    if (!taskname || !taskname.trim()) {
      return res.status(400).json({
        success: false,
        error: "Task name is required",
      });
    }

    // Import the category detection and subcategory generation functions
    const { detectCategory } = await import("../algorithms/priority/categorizing.js");
    const { generateSubCategory } = await import("../services/ml/subcategoryGenerator.js");
    const { Task } = await import("../models/Task.js");

    // Detect category from task name
    const category = detectCategory({
      title: taskname.trim(),
      description: "",
      category: "",
    });

    // Generate subcategory
    const subCategory = await generateSubCategory({
      userId,
      title: taskname.trim(),
      description: "",
      category,
      current: null,
      TaskModel: Task,
    });

    return res.status(200).json({
      success: true,
      category,
      subCategory: subCategory?.label || null,
    });
  } catch (error) {
    logger.error("Error in suggestCategory controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to suggest category",
    });
  }
}

/**
 * Create a new task
 * POST /api/tasks
 */
export async function createTask(req, res) {
  try {
    const userId = req.user.userId;

    // Log the entire request body for debugging
    console.log("=== CONTROLLER RECEIVED ===");
    console.log("req.body:", JSON.stringify(req.body, null, 2));

    const {
      name,
      taskname,
      category,
      subcategory,
      subcategoryId,
      subCategoryId,
      deadline,
      recurrence,
      importance,
      effort,
      estimatedMinutes,
      estimatedDuration,
      canSplit,
      minChunk,
      description,
      subtasks,
      taskType,
      chunkCount,
      chunkMinutes,
      minMinutes,
      maxMinutes,
    } = req.body;

    console.log("Extracted fields:", {
      importance,
      effort,
      estimatedMinutes,
      estimatedDuration,
      canSplit,
      minChunk,
      description,
      subtasks,
      taskType,
      chunkCount,
      chunkMinutes,
      minMinutes,
      maxMinutes,
    });

    const title = (taskname || name || "").trim();
    const descriptionValue = typeof description === "string" ? description : req.body.description || "";

    // Validation
    if (!title) {
      return res.status(400).json({ success: false, error: "Task title is required" });
    }

    if (hasIllegalDisplayChars(title)) {
      return res.status(400).json({ success: false, error: "Task title cannot include angle brackets." });
    }

    if (!deadline) {
      return res.status(400).json({ success: false, error: "Deadline is required" });
    }

    const rawSubcategory = subcategoryId || subCategoryId || subcategory;
    const isSubcategoryId = typeof rawSubcategory === "string" && /^[a-fA-F0-9]{ICON_SIZES.sm}$/.test(rawSubcategory);

    if (typeof rawSubcategory === "string" && !isSubcategoryId && hasIllegalDisplayChars(rawSubcategory)) {
      return res.status(400).json({ success: false, error: "Subcategory cannot include angle brackets." });
    }

    // Validate recurrence if provided
    if (recurrence) {
      if (!recurrence.type || !["daily", "weekly", "monthly", "yearly"].includes(recurrence.type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid recurrence type. Must be: daily, weekly, monthly, or yearly",
        });
      }

      if (recurrence.interval && recurrence.interval < 1) {
        return res.status(400).json({
          success: false,
          error: "Recurrence interval must be at least 1",
        });
      }

      if (recurrence.count && recurrence.count < 1) {
        return res.status(400).json({
          success: false,
          error: "Recurrence count must be at least 1",
        });
      }
    }

    // Auto-save subcategory to user profile if provided
    const subcategoryName =
      typeof rawSubcategory === "string" && !isSubcategoryId
        ? rawSubcategory
        : typeof rawSubcategory === "object"
          ? rawSubcategory.label || rawSubcategory.name
          : null;

    if (subcategoryName && category) {
      console.log("[taskController.createTask] Auto-saving subcategory:", {
        subcategory: subcategoryName,
        category,
        userId,
      });
      await autoSaveSubcategory(userId, subcategoryName, category);
    }

    // Use estimatedDuration (from agent) OR estimatedMinutes (from frontend)
    const finalEstimatedDuration = estimatedDuration || estimatedMinutes || 60;

    console.log("[taskController.createTask] Creating task with:", {
      taskname: title,
      category,
      subcategory: rawSubcategory,
      subCategoryObject:
        rawSubcategory && !isSubcategoryId
          ? typeof rawSubcategory === "string"
            ? { label: rawSubcategory, source: "user", confidence: 1 }
            : rawSubcategory
          : null,
    });

    // Preserve explicit nulls for minChunk (to allow clearing); only use default when undefined
    const finalMinChunk = minChunk === null ? null : typeof minChunk === "number" && minChunk > 0 ? minChunk : 30;

    const task = await taskService.createTask({
      userId,
      taskname: title,
      description: descriptionValue,
      category: category || "",
      subCategory: rawSubcategory
        ? typeof rawSubcategory === "string" && !isSubcategoryId
          ? { label: rawSubcategory, source: "user", confidence: 1, updatedAt: new Date() }
          : rawSubcategory
        : null,
      dueDate: deadline ? new Date(deadline) : null,
      importance: importance !== undefined ? importance : 3,
      effort: effort !== undefined ? effort : 3,
      estimatedDuration: finalEstimatedDuration,
      canSplit: canSplit !== undefined ? canSplit : true,
      minChunk: finalMinChunk,
      taskType: taskType || "perfect",
      chunkCount: typeof chunkCount === "number" ? chunkCount : undefined,
      chunkMinutes: typeof chunkMinutes === "number" ? chunkMinutes : undefined,
      minMinutes: typeof minMinutes === "number" ? minMinutes : undefined,
      maxMinutes: typeof maxMinutes === "number" ? maxMinutes : undefined,
      recurrence,
      subtasks: subtasks || undefined,
    });

    // Trigger scheduler to update the plan after creating a task
    await triggerSchedulerUpdate(userId, "creation", "API");

    return res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    logger.error("Error in createTask controller:", error);

    if (error.message.includes("Invalid deadline")) {
      return res.status(400).json({
        success: false,
        error: "Invalid deadline format. Use ISO 8601 format (e.g., 2025-11-01T12:00:00Z)",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create task",
    });
  }
}

/**
 * Get all tasks for the current user
 * GET /api/tasks
 */
export async function getTasks(req, res) {
  try {
    const userId = req.user.userId;
    const { tag, category, completed, dueBefore, dueAfter, search } = req.query;

    // Build filters
    const filters = {};

    if (category) {
      filters.category = category;
    } else if (tag) {
      filters.category = tag;
    }

    if (completed !== undefined) {
      filters.completed = completed === "true";
    }

    if (dueBefore) {
      filters.dueBefore = dueBefore;
    }

    if (dueAfter) {
      filters.dueAfter = dueAfter;
    }
    if (search) {
      filters.search = search;
    }

    const tasks = await taskService.getTasks(userId, filters);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    logger.error("Error in getTasks controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve tasks",
    });
  }
}

/**
 * Get a single task by ID
 * GET /api/tasks/:id
 */
export async function getTaskById(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const task = await taskService.getTaskById(id, userId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    logger.error("Error in getTaskById controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve task",
    });
  }
}

/**
 * Update a task
 * PATCH /api/tasks/:id
 *
 * Body fields (all optional):
 * - taskname/name: string
 * - description: string
 * - category: string
 * - subcategory: string
 * - importance: number (1-5)
 * - effort: number (1-5)
 * - estimatedDuration: number (minutes, min 15)
 * - canSplit: boolean
 * - taskType: "perfect" | "in_parts" | "leaky"
 * - chunkCount: number (min 1)
 * - chunkMinutes: number (min 1)
 * - minMinutes: number (min 1)
 * - maxMinutes: number (min 1)
 * - minChunk: number (min 15)
 * - deadline/dueDate: ISO 8601 date string
 * - status: "todo" | "in_progress" | "done"
 * - completed: boolean (alias for status)
 */
export async function updateTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const raw = req.body || {};

    // Map public API fields to service field names
    const updates = {};

    // Task name
    if (raw.taskname !== undefined || raw.name !== undefined) {
      const name = raw.taskname || raw.name;
      if (typeof name === "string") {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
          return res.status(400).json({ success: false, error: "Task name cannot be empty" });
        }
        if (hasIllegalDisplayChars(trimmed)) {
          return res.status(400).json({ success: false, error: "Task name cannot include angle brackets." });
        }
        if (trimmed.length > 200) {
          return res.status(400).json({ success: false, error: "Task name too long (max 200 characters)" });
        }
        updates.taskname = trimmed;
      }
    }

    // Description
    if (raw.description !== undefined) {
      if (typeof raw.description === "string") {
        const trimmed = raw.description.trim();
        if (hasIllegalDisplayChars(trimmed)) {
          return res.status(400).json({ success: false, error: "Description cannot include angle brackets." });
        }
        updates.description = trimmed;
      }
    }

    // Category
    if (raw.category !== undefined) updates.category = raw.category;

    // Subcategory
    const rawSubcategory = raw.subcategoryId || raw.subCategoryId || raw.subcategory;
    if (rawSubcategory !== undefined) {
      const isSubcategoryId = typeof rawSubcategory === "string" && /^[a-fA-F0-9]{ICON_SIZES.sm}$/.test(rawSubcategory);
      if (typeof rawSubcategory === "string" && !isSubcategoryId && hasIllegalDisplayChars(rawSubcategory)) {
        return res.status(400).json({ success: false, error: "Subcategory cannot include angle brackets." });
      }

      updates.subCategory =
        rawSubcategory && !isSubcategoryId
          ? typeof rawSubcategory === "string"
            ? { label: rawSubcategory, source: "user", confidence: 1, updatedAt: new Date() }
            : rawSubcategory
          : rawSubcategory || null;

      // Auto-save subcategory to user profile
      const taskCategory = raw.category || updates.category;
      const subcategoryName =
        typeof rawSubcategory === "string" && !isSubcategoryId
          ? rawSubcategory
          : typeof rawSubcategory === "object"
            ? rawSubcategory.label || rawSubcategory.name
            : null;
      if (taskCategory && subcategoryName) {
        await autoSaveSubcategory(userId, subcategoryName, taskCategory);
      }
    }

    // Importance (1-5)
    if (raw.importance !== undefined) {
      const imp = Number(raw.importance);
      if (!Number.isInteger(imp) || imp < 1 || imp > 5) {
        return res.status(400).json({ success: false, error: "Importance must be an integer between 1 and 5" });
      }
      updates.importance = imp;
    }

    // Effort (1-5)
    if (raw.effort !== undefined) {
      const eff = Number(raw.effort);
      if (!Number.isInteger(eff) || eff < 1 || eff > 5) {
        return res.status(400).json({ success: false, error: "Effort must be an integer between 1 and 5" });
      }
      updates.effort = eff;
    }

    // Estimated Duration
    if (raw.estimatedDuration !== undefined) {
      const dur = Number(raw.estimatedDuration);
      if (isNaN(dur) || dur < 15) {
        return res.status(400).json({ success: false, error: "Estimated duration must be at least 15 minutes" });
      }
      updates.estimatedDuration = Math.round(dur);
    }

    // Task splitting options
    if (raw.canSplit !== undefined) updates.canSplit = Boolean(raw.canSplit);

    // Task type validation
    if (raw.taskType !== undefined) {
      if (!["perfect", "in_parts", "leaky"].includes(raw.taskType)) {
        return res.status(400).json({ success: false, error: "Task type must be 'perfect', 'in_parts', or 'leaky'" });
      }
      updates.taskType = raw.taskType;
    }

    // Chunk settings (for in_parts/leaky tasks)
    if (raw.chunkCount !== undefined) {
      // Accept explicit null to clear stored chunk count when switching types
      if (raw.chunkCount === null) {
        updates.chunkCount = null;
      } else {
        const cc = Number(raw.chunkCount);
        if (!Number.isInteger(cc) || cc < 1) {
          return res.status(400).json({ success: false, error: "Chunk count must be at least 1" });
        }
        updates.chunkCount = cc;
      }
    }

    if (raw.chunkMinutes !== undefined) {
      if (raw.chunkMinutes === null) {
        updates.chunkMinutes = null;
      } else {
        const cm = Number(raw.chunkMinutes);
        if (isNaN(cm) || cm < 1) {
          return res.status(400).json({ success: false, error: "Chunk minutes must be at least 1" });
        }
        updates.chunkMinutes = Math.round(cm);
      }
    }

    if (raw.minMinutes !== undefined) {
      if (raw.minMinutes === null) {
        updates.minMinutes = null;
      } else {
        const min = Number(raw.minMinutes);
        if (isNaN(min) || min < 1) {
          return res.status(400).json({ success: false, error: "Min minutes must be at least 1" });
        }
        updates.minMinutes = Math.round(min);
      }
    }

    if (raw.maxMinutes !== undefined) {
      if (raw.maxMinutes === null) {
        updates.maxMinutes = null;
      } else {
        const max = Number(raw.maxMinutes);
        if (isNaN(max) || max < 1) {
          return res.status(400).json({ success: false, error: "Max minutes must be at least 1" });
        }
        updates.maxMinutes = Math.round(max);
      }
    }

    if (raw.minChunk !== undefined) {
      // Allow explicit null to clear stored minChunk
      if (raw.minChunk === null) {
        updates.minChunk = null;
      } else {
        const mc = Number(raw.minChunk);
        if (isNaN(mc) || mc < 15) {
          return res.status(400).json({ success: false, error: "Min chunk must be at least 15 minutes" });
        }
        updates.minChunk = Math.round(mc);
      }
    }

    // Validate min/max relationship (when both provided and not null)
    if (
      updates.minMinutes !== undefined &&
      updates.maxMinutes !== undefined &&
      updates.minMinutes !== null &&
      updates.maxMinutes !== null &&
      updates.minMinutes > updates.maxMinutes
    ) {
      return res.status(400).json({ success: false, error: "Min minutes cannot exceed max minutes" });
    }

    // Status
    if (raw.status !== undefined) {
      if (!["todo", "in_progress", "done"].includes(raw.status)) {
        return res.status(400).json({ success: false, error: "Status must be 'todo', 'in_progress', or 'done'" });
      }
      updates.status = raw.status;
    }

    // Completed flag (alias for status)
    if (raw.completed !== undefined && raw.status === undefined) {
      updates.status = raw.completed ? "done" : "todo";
    }

    // Validate and map deadline if provided
    if (raw.deadline !== undefined || raw.dueDate !== undefined) {
      const dateValue = raw.deadline || raw.dueDate;
      if (dateValue === null) {
        updates.dueDate = null;
      } else {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ success: false, error: "Invalid deadline format. Use ISO 8601 date." });
        }
        updates.dueDate = d;
      }
    }

    // Recurrence (allow updating recurrence via PATCH)
    if (raw.recurrence !== undefined) {
      if (!raw.recurrence || typeof raw.recurrence !== "object") {
        return res.status(400).json({ success: false, error: "Invalid recurrence format" });
      }

      const rec = {
        type: raw.recurrence.type,
        interval: raw.recurrence.interval || 1,
        endDate: raw.recurrence.endDate ? new Date(raw.recurrence.endDate) : null,
        count: raw.recurrence.count || null,
        completedDates: [],
      };

      if (!rec.type || !["daily", "weekly", "monthly", "yearly"].includes(rec.type)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid recurrence type. Must be: daily, weekly, monthly, or yearly" });
      }

      if (rec.interval && rec.interval < 1) {
        return res.status(400).json({ success: false, error: "Recurrence interval must be at least 1" });
      }

      if (rec.count && rec.count < 1) {
        return res.status(400).json({ success: false, error: "Recurrence count must be at least 1" });
      }

      if (rec.endDate && isNaN(rec.endDate.getTime())) {
        return res.status(400).json({ success: false, error: "Invalid recurrence endDate. Use ISO 8601 date." });
      }

      updates.recurrence = rec;
    }

    // Subtasks
    if (raw.subtasks !== undefined) {
      if (Array.isArray(raw.subtasks)) {
        // Validate each subtask
        const validSubtasks = raw.subtasks
          .filter((sub) => sub && typeof sub === "object")
          .map((sub) => ({
            id: sub.id || undefined,
            title: sub.title ? String(sub.title).trim() : "",
            description: sub.description ? String(sub.description).trim() : "",
            minutes: sub.minutes ? Number(sub.minutes) : 30,
            index: sub.index !== undefined ? Number(sub.index) : undefined,
          }))
          .filter((sub) => sub.title.length > 0);

        if (validSubtasks.length > 0) {
          updates.subtasks = validSubtasks;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const result = await taskService.updateTask({ userId, taskId: id, updates });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Task not found" });
    }

    // Award points when task is completed via update
    const isCompletedUpdate = updates.status === "done" || raw.completed === true;
    let gamification = null;
    if (isCompletedUpdate && result.task) {
      try {
        const { awardTaskCompletionPoints } = await import("./userController.js");
        const reward = await awardTaskCompletionPoints(userId, result.task);
        logger.info(`[updateTask] Awarded ${reward.points} points to user ${userId} for task ${id}`);
        gamification = reward.gamification;
      } catch (pointsError) {
        logger.error("[updateTask] Failed to award points:", pointsError.message);
      }
    }

    // Trigger scheduler to update the plan after task update
    await triggerSchedulerUpdate(userId, "update", "API");

    return res.status(200).json({
      success: true,
      task: result.task,
      gamification: gamification,
      message: "Task updated successfully",
    });
  } catch (error) {
    logger.error("Error in updateTask controller:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to update task",
    });
  }
}

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
export async function deleteTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Call service with explicit named args and respect its return shape
    const result = await taskService.deleteTask({ taskId: id, userId });

    if (!result || !result.success) {
      return res.status(404).json({
        success: false,
        error: result?.error || "Task not found",
      });
    }

    // Trigger scheduler to update the plan after deletion
    await triggerSchedulerUpdate(userId, "deletion", "API");

    return res.status(200).json({
      success: true,
      id,
      taskname: result.taskname || null,
    });
  } catch (error) {
    logger.error("Error in deleteTask controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to delete task",
    });
  }
}

/**
 * Get upcoming tasks
 * GET /api/tasks/upcoming/:days?
 */
export async function getUpcomingTasks(req, res) {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.params.days) || 7;

    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: "Days must be between 1 and 365",
      });
    }

    const tasks = await taskService.getUpcomingTasks(userId, days);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    logger.error("Error in getUpcomingTasks controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve upcoming tasks",
    });
  }
}

/**
 * Get scheduled tasks grouped by day (today + upcoming)
 * GET /api/tasks/scheduled/:days?
 */
export async function getScheduledTasks(req, res) {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.params.days) || 7;

    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: "Days must be between 1 and 365",
      });
    }

    const schedule = await taskService.getScheduledTasksByDay(userId, days);

    return res.status(200).json({
      success: true,
      days: schedule.days,
      today: schedule.today,
      upcoming: schedule.upcoming,
    });
  } catch (error) {
    logger.error("Error in getScheduledTasks controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve scheduled tasks",
    });
  }
}

/**
 * Get overdue tasks
 * GET /api/tasks/overdue
 */
export async function getOverdueTasks(req, res) {
  try {
    const userId = req.user.userId;

    const tasks = await taskService.getOverdueTasks(userId);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    logger.error("Error in getOverdueTasks controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve overdue tasks",
    });
  }
}

/**
 * Decline overdue tasks – increment the decline count for given task IDs.
 * After 3 declines a task no longer appears in the overdue list.
 * POST /api/tasks/overdue/decline
 */
export async function declineOverdueTasks(req, res) {
  try {
    const userId = req.user.userId;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: "taskIds must be a non-empty array" });
    }

    await Task.updateMany({ _id: { $in: taskIds }, userId }, { $inc: { overdueDeclineCount: 1 } });

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error in declineOverdueTasks controller:", error);
    return res.status(500).json({ success: false, error: "Failed to register decline" });
  }
}

/**
 * Toggle task completion
 * POST /api/tasks/:id/toggle
 */
export async function toggleTaskCompletion(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get subtasks BEFORE toggling to know which ones are uncompleted
    // This ensures we don't double-count points for already completed subtasks
    const allSubtasks = await taskService.getSubTasksForTask({ userId, taskId: id });
    const uncompletedSubtasks = allSubtasks.filter((st) => st.status !== "done");
    const hasSubtasks = allSubtasks.length > 0;
    const allSubtasksAlreadyDone = hasSubtasks && uncompletedSubtasks.length === 0;

    logger.info(
      `[toggleTaskCompletion] Task ${id}: ${allSubtasks.length} total subtasks, ${uncompletedSubtasks.length} uncompleted`,
    );

    const result = await taskService.toggleTaskCompletion(id, userId);

    if (!result || !result.task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    const { task, wasNewCompletion, wasNewUncompletion } = result;

    // If toggled to completed (and was a NEW completion), award points and update streak
    let gamification = null;
    let pointsAwarded = 0;
    let pointsSubtracted = 0;

    if (wasNewCompletion) {
      try {
        if (allSubtasksAlreadyDone) {
          // All subtasks were already completed - only award the task completion bonus
          // (subtask points were already awarded when each subtask was completed)
          const { awardTaskCompletionBonus } = await import("./userController.js");
          const reward = await awardTaskCompletionBonus(userId, task);
          pointsAwarded = reward.points;
          gamification = reward.gamification;

          // Save earnedPoints to the task
          await taskService.updateTaskEarnedPoints(id, pointsAwarded);

          logger.info(
            `[toggleTaskCompletion] All subtasks done, awarded ${reward.points} bonus points to user ${userId} for completing task ${id}`,
          );
        } else {
          // Either no subtasks or some uncompleted - award full points for remaining subtasks
          const { awardTaskCompletionPoints } = await import("./userController.js");
          const reward = await awardTaskCompletionPoints(userId, task, uncompletedSubtasks);
          pointsAwarded = reward.points;
          gamification = reward.gamification;

          // Save earnedPoints to the task
          await taskService.updateTaskEarnedPoints(id, pointsAwarded);

          logger.info(
            `[toggleTaskCompletion] Awarded ${reward.points} points to user ${userId} for completing task ${id} via toggle`,
          );
        }
      } catch (pointsError) {
        logger.warn("Failed to award points on toggle completion:", pointsError.message);
      }
    }

    // If toggled to incomplete (and was previously complete), reverse points and decrement task count
    if (wasNewUncompletion) {
      try {
        const { reverseTaskCompletion } = await import("./userController.js");
        // Use previousEarnedPoints attached by taskService
        const taskWithPoints = { ...task, earnedPoints: task.previousEarnedPoints || 0 };
        const reversal = await reverseTaskCompletion(userId, taskWithPoints);
        pointsSubtracted = reversal.pointsSubtracted;
        gamification = reversal.gamification;
        logger.info(
          `[toggleTaskCompletion] Reversed completion, subtracted ${pointsSubtracted} points from user ${userId} for task ${id}`,
        );
      } catch (reversalError) {
        logger.warn("Failed to reverse points on toggle uncompletion:", reversalError.message);
      }
    }

    // Log the response being sent
    logger.info(`[toggleTaskCompletion] Sending response:`, {
      taskId: task._id,
      status: task.status,
      gamification: gamification
        ? {
            points: gamification.points,
            currentStreak: gamification.currentStreak,
            completedTasks: gamification.completedTasks,
          }
        : null,
      wasCompletion: wasNewCompletion,
      wasUncompletion: wasNewUncompletion,
    });

    return res.status(200).json({
      success: true,
      task,
      gamification,
      pointsAwarded,
      pointsSubtracted,
      wasCompletion: wasNewCompletion,
      wasUncompletion: wasNewUncompletion,
      message: `Task marked as ${task.status === "done" ? "completed" : "incomplete"}`,
    });
  } catch (error) {
    logger.error("Error in toggleTaskCompletion controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to toggle task completion",
    });
  }
}

/**
 * Get subtasks for a task
 * GET /api/tasks/:id/subtasks
 */
export async function getSubTasksForTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params; // task id

    const subs = await taskService.getSubTasksForTask({ userId, taskId: id });

    return res.status(200).json({ success: true, count: subs.length, subtasks: subs });
  } catch (error) {
    logger.error("Error in getSubTasksForTask controller:", error);
    return res.status(500).json({ success: false, error: "Failed to get subtasks" });
  }
}

/**
 * Get detailed progress for a task with split parts
 * GET /api/tasks/:id/progress
 *
 * Returns:
 * - Task details
 * - All subtasks with their schedule blocks
 * - Progress metrics (completed parts, total parts, percentage)
 */
export async function getTaskProgress(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params; // task id

    const progress = await taskService.getTaskProgress(userId, id);

    if (!progress) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    return res.status(200).json({ success: true, data: progress });
  } catch (error) {
    logger.error("Error in getTaskProgress controller:", error);
    return res.status(500).json({ success: false, error: "Failed to get task progress" });
  }
}

/**
 * Get a single subtask by ID
 * GET /api/tasks/:taskId/subtasks/:subId
 */
export async function getSubTaskById(req, res) {
  try {
    const userId = req.user.userId;
    const { subId } = req.params;

    const subtask = await taskService.getSubTaskById({ userId, subTaskId: subId });

    if (!subtask) {
      return res.status(404).json({ success: false, error: "Subtask not found" });
    }

    return res.status(200).json({ success: true, subtask });
  } catch (error) {
    logger.error("Error in getSubTaskById controller:", error);
    return res.status(500).json({ success: false, error: "Failed to get subtask" });
  }
}

/**
 * Update a subtask (e.g., mark complete)
 * PATCH /api/tasks/:taskId/subtasks/:subId
 *
 * Body fields (all optional):
 * - title: string
 * - description: string
 * - status: "todo" | "done"
 * - minutes: number
 */
export async function updateSubTask(req, res) {
  try {
    const userId = req.user.userId;
    const { subId } = req.params;
    const raw = req.body || {};

    const updates = {};

    // Title
    if (raw.title !== undefined) {
      if (typeof raw.title === "string") {
        const trimmed = raw.title.trim();
        if (trimmed.length > 200) {
          return res.status(400).json({ success: false, error: "Subtask title too long (max 200 characters)" });
        }
        if (hasIllegalDisplayChars(trimmed)) {
          return res.status(400).json({ success: false, error: "Subtask title cannot include angle brackets." });
        }
        updates.title = trimmed;
      }
    }

    // Description
    if (raw.description !== undefined) {
      if (typeof raw.description === "string") {
        const trimmed = raw.description.trim();
        if (hasIllegalDisplayChars(trimmed)) {
          return res.status(400).json({ success: false, error: "Subtask description cannot include angle brackets." });
        }
        updates.description = trimmed;
      }
    }

    // Status
    if (raw.status !== undefined) {
      if (!["todo", "done"].includes(raw.status)) {
        return res.status(400).json({ success: false, error: "Subtask status must be 'todo' or 'done'" });
      }
      updates.status = raw.status;
    }

    // Minutes
    if (raw.minutes !== undefined) {
      const min = Number(raw.minutes);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({ success: false, error: "Minutes must be a positive number" });
      }
      updates.minutes = Math.round(min);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const result = await taskService.updateSubTask({ userId, subTaskId: subId, updates });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    // Award points for subtask completion (only if this was a NEW completion)
    let gamification = null;
    let pointsAwarded = 0;
    let completionBonus = 0;
    let pointsSubtracted = 0;
    let taskBonusSubtracted = 0;

    if (result.isNewCompletion) {
      try {
        const { awardSubtaskCompletionPoints, awardTaskCompletionBonus } = await import("./userController.js");
        const reward = await awardSubtaskCompletionPoints(userId, result.subtask, result.parentTask);
        pointsAwarded = reward.points;
        gamification = reward.gamification;

        // Save earnedPoints to the subtask
        await taskService.updateSubTaskEarnedPoints(subId, pointsAwarded);

        logger.info(
          `[updateSubTask] Awarded ${pointsAwarded} points to user ${userId} for completing subtask ${subId}`,
        );

        // If this subtask completion caused the parent task to complete, award task completion BONUS only
        // (not full task points, since subtask points were already awarded throughout)
        if (result.parentTaskCompleted && result.parentTask) {
          const bonusReward = await awardTaskCompletionBonus(userId, result.parentTask);
          completionBonus = bonusReward.points;
          pointsAwarded += completionBonus;
          gamification = bonusReward.gamification; // Use latest gamification state

          // Save earnedPoints to the parent task
          await taskService.updateTaskEarnedPoints(result.parentTask._id, completionBonus);

          logger.info(`[updateSubTask] Parent task completed! Awarded ${completionBonus} bonus points`);
        }
      } catch (pointsError) {
        logger.warn("[updateSubTask] Failed to award points for subtask completion:", pointsError.message);
      }
    }

    // Reverse points for subtask uncompletion (only if this was a NEW uncompletion)
    if (result.isNewUncompletion) {
      try {
        const { reverseSubtaskCompletion } = await import("./userController.js");
        // Use previousEarnedPoints attached by taskService
        const subtaskWithPoints = {
          ...result.subtask,
          earnedPoints: result.subtask.previousEarnedPoints || 0,
        };
        const parentTaskWithPoints = result.parentTask
          ? {
              ...result.parentTask,
              earnedPoints: result.parentTask.previousEarnedPoints || 0,
            }
          : null;

        const reversal = await reverseSubtaskCompletion(
          userId,
          subtaskWithPoints,
          parentTaskWithPoints,
          result.parentTaskUncompleted,
        );
        pointsSubtracted = reversal.pointsSubtracted;
        taskBonusSubtracted = reversal.taskBonusSubtracted;
        gamification = reversal.gamification;

        logger.info(
          `[updateSubTask] Reversed subtask completion, subtracted ${pointsSubtracted} points (+ ${taskBonusSubtracted} task bonus) from user ${userId}`,
        );
      } catch (reversalError) {
        logger.warn("[updateSubTask] Failed to reverse points for subtask uncompletion:", reversalError.message);
      }
    }

    // Log the response being sent
    logger.info(`[updateSubTask] Sending response:`, {
      subtaskId: result.subtask?._id,
      status: result.subtask?.status,
      gamification: gamification
        ? {
            points: gamification.points,
            currentStreak: gamification.currentStreak,
            completedTasks: gamification.completedTasks,
          }
        : null,
      wasCompletion: result.isNewCompletion || false,
      wasUncompletion: result.isNewUncompletion || false,
      parentTaskCompleted: result.parentTaskCompleted || false,
      parentTaskUncompleted: result.parentTaskUncompleted || false,
    });

    return res.status(200).json({
      success: true,
      subtask: result.subtask,
      gamification: gamification,
      pointsAwarded: pointsAwarded,
      completionBonus: completionBonus,
      pointsSubtracted: pointsSubtracted,
      taskBonusSubtracted: taskBonusSubtracted,
      parentTaskCompleted: result.parentTaskCompleted || false,
      parentTaskUncompleted: result.parentTaskUncompleted || false,
      wasCompletion: result.isNewCompletion || false,
      wasUncompletion: result.isNewUncompletion || false,
      message: "Subtask updated successfully",
    });
  } catch (error) {
    logger.error("Error in updateSubTask controller:", error);
    return res.status(500).json({ success: false, error: "Failed to update subtask" });
  }
}

/**
 * Mark a subtask as complete (shortcut endpoint)
 * POST /api/tasks/:taskId/subtasks/:subId/complete
 */
export async function markSubTaskComplete(req, res) {
  try {
    const userId = req.user.userId;
    const { taskId, subId } = req.params;

    console.log(`[markSubTaskComplete] Controller received:`, {
      userId,
      taskId,
      subId,
      requestUrl: req.originalUrl,
      requestPath: req.path,
    });

    const result = await taskService.updateSubTask({
      userId,
      subTaskId: subId,
      updates: { status: "done" },
    });

    console.log(`[markSubTaskComplete] Service result:`, {
      success: result?.success,
      error: result?.error,
      subtaskId: result?.subtask?._id,
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    // Award points for subtask completion (only if this was a NEW completion)
    let gamification = null;
    let pointsAwarded = 0;
    let completionBonus = 0;
    if (result.isNewCompletion) {
      try {
        const { awardSubtaskCompletionPoints, awardTaskCompletionBonus } = await import("./userController.js");
        const reward = await awardSubtaskCompletionPoints(userId, result.subtask, result.parentTask);
        pointsAwarded = reward.points;
        gamification = reward.gamification;

        // Save earnedPoints to the subtask
        await taskService.updateSubTaskEarnedPoints(subId, pointsAwarded);

        logger.info(
          `[markSubTaskComplete] Awarded ${pointsAwarded} points to user ${userId} for completing subtask ${subId}`,
        );

        // If this subtask completion caused the parent task to complete, award task completion BONUS only
        if (result.parentTaskCompleted && result.parentTask) {
          const bonusReward = await awardTaskCompletionBonus(userId, result.parentTask);
          completionBonus = bonusReward.points;
          pointsAwarded += completionBonus;
          gamification = bonusReward.gamification;

          // Save earnedPoints to the parent task
          await taskService.updateTaskEarnedPoints(result.parentTask._id, completionBonus);

          logger.info(`[markSubTaskComplete] Parent task completed! Awarded ${completionBonus} bonus points`);
        }
      } catch (pointsError) {
        logger.warn("[markSubTaskComplete] Failed to award points for subtask completion:", pointsError.message);
      }
    }

    return res.status(200).json({
      success: true,
      subtask: result.subtask,
      gamification: gamification,
      pointsAwarded: pointsAwarded,
      completionBonus: completionBonus,
      parentTaskCompleted: result.parentTaskCompleted || false,
      message: "Subtask marked as complete",
    });
  } catch (error) {
    console.error("[markSubTaskComplete] Controller error:", error);
    logger.error("Error in markSubTaskComplete controller:", error);
    return res.status(500).json({ success: false, error: "Failed to mark subtask complete" });
  }
}

/**
 * Mark a subtask as todo (shortcut endpoint)
 * POST /api/tasks/:taskId/subtasks/:subId/todo
 */
export async function markSubTaskTodo(req, res) {
  try {
    const userId = req.user.userId;
    const { subId } = req.params;

    const result = await taskService.updateSubTask({
      userId,
      subTaskId: subId,
      updates: { status: "todo" },
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    // Reverse points for subtask uncompletion
    let gamification = null;
    let pointsSubtracted = 0;
    let taskBonusSubtracted = 0;
    if (result.isNewUncompletion) {
      try {
        const { reverseSubtaskCompletion } = await import("./userController.js");
        const subtaskWithPoints = {
          ...result.subtask,
          earnedPoints: result.subtask.previousEarnedPoints || 0,
        };
        const parentTaskWithPoints = result.parentTask
          ? {
              ...result.parentTask,
              earnedPoints: result.parentTask.previousEarnedPoints || 0,
            }
          : null;

        const reversal = await reverseSubtaskCompletion(
          userId,
          subtaskWithPoints,
          parentTaskWithPoints,
          result.parentTaskUncompleted,
        );
        pointsSubtracted = reversal.pointsSubtracted;
        taskBonusSubtracted = reversal.taskBonusSubtracted;
        gamification = reversal.gamification;

        logger.info(
          `[markSubTaskTodo] Reversed subtask completion, subtracted ${pointsSubtracted} points from user ${userId}`,
        );
      } catch (reversalError) {
        logger.warn("[markSubTaskTodo] Failed to reverse points:", reversalError.message);
      }
    }

    return res.status(200).json({
      success: true,
      subtask: result.subtask,
      gamification: gamification,
      pointsSubtracted: pointsSubtracted,
      taskBonusSubtracted: taskBonusSubtracted,
      parentTaskUncompleted: result.parentTaskUncompleted || false,
      message: "Subtask marked as todo",
    });
  } catch (error) {
    logger.error("Error in markSubTaskTodo controller:", error);
    return res.status(500).json({ success: false, error: "Failed to mark subtask as todo" });
  }
}

/**
 * Update subtask status directly
 * PATCH /api/tasks/:taskId/subtasks/:subId/status
 * Body: { status: "todo" | "done" }
 */
export async function updateSubTaskStatus(req, res) {
  try {
    const userId = req.user.userId;
    const { subId } = req.params;
    const { status } = req.body;

    if (!status || !["todo", "done"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status is required and must be 'todo' or 'done'",
      });
    }

    const result = await taskService.updateSubTask({
      userId,
      subTaskId: subId,
      updates: { status },
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    return res.status(200).json({
      success: true,
      subtask: result.subtask,
      message: `Subtask status updated to ${status}`,
    });
  } catch (error) {
    logger.error("Error in updateSubTaskStatus controller:", error);
    return res.status(500).json({ success: false, error: "Failed to update subtask status" });
  }
}

/**
 * Bulk update task with subtasks
 * PATCH /api/tasks/:id/full
 *
 * Body:
 * - task: object with task fields to update
 * - subtasks: array of { _id, ...fields } to update
 *
 * This endpoint allows updating task and its subtasks in a single transaction
 */
export async function bulkUpdateTaskWithSubtasks(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { task: taskUpdates, subtasks: subtaskUpdates } = req.body || {};

    const results = {
      task: null,
      subtasks: [],
      errors: [],
    };

    // Update task if provided
    if (taskUpdates && Object.keys(taskUpdates).length > 0) {
      const taskResult = await taskService.updateTask({ userId, taskId: id, updates: taskUpdates });
      if (taskResult.success) {
        results.task = taskResult.task;
      } else {
        results.errors.push({ type: "task", error: taskResult.error });
      }
    }

    // Update subtasks if provided
    if (Array.isArray(subtaskUpdates) && subtaskUpdates.length > 0) {
      for (const subUpdate of subtaskUpdates) {
        if (!subUpdate._id) {
          results.errors.push({ type: "subtask", error: "Subtask _id is required" });
          continue;
        }

        const { _id, ...updates } = subUpdate;
        const subResult = await taskService.updateSubTask({ userId, subTaskId: _id, updates });

        if (subResult.success) {
          results.subtasks.push(subResult.subtask);
        } else {
          results.errors.push({ type: "subtask", id: _id, error: subResult.error });
        }
      }
    }

    // Determine overall success
    const hasErrors = results.errors.length > 0;
    const hasUpdates = results.task || results.subtasks.length > 0;

    if (!hasUpdates && hasErrors) {
      return res.status(400).json({
        success: false,
        error: "Failed to update task or subtasks",
        details: results.errors,
      });
    }

    return res.status(200).json({
      success: true,
      message: hasErrors ? "Partial update completed with some errors" : "Task and subtasks updated successfully",
      task: results.task,
      subtasks: results.subtasks,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    logger.error("Error in bulkUpdateTaskWithSubtasks controller:", error);
    return res.status(500).json({ success: false, error: "Failed to update task and subtasks" });
  }
}

/**
 * Complete a task (with ML training)
 * POST /api/tasks/:id/complete
 *
 * Point calculation:
 * - If task has uncompleted subtasks: awards points for each remaining subtask + task completion bonus
 * - If task has no subtasks: awards base task points + task completion bonus
 */
export async function completeTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    logger.info(`[completeTask] User ${userId} completing task ${id}`);

    // Get subtasks BEFORE completing the task (for point calculation)
    const allSubtasks = await taskService.getSubTasksForTask({ userId, taskId: id });
    const remainingSubtasks = allSubtasks.filter((st) => st.status !== "done");
    const hasSubtasks = allSubtasks.length > 0;
    const allSubtasksAlreadyDone = hasSubtasks && remainingSubtasks.length === 0;

    logger.info(
      `[completeTask] Task ${id}: ${allSubtasks.length} total subtasks, ${remainingSubtasks.length} uncompleted`,
    );

    const result = await taskService.completeTask({ taskId: id, userId });

    logger.info(
      `[completeTask] Task service result: success=${result?.success}, wasAlreadyCompleted=${result?.wasAlreadyCompleted}`,
    );

    if (!result || result.success === false) {
      logger.warn(`[completeTask] Task not found or error: ${result?.error}`);
      return res.status(404).json({
        success: false,
        error: result?.error || "Task not found",
      });
    }

    // Award points for task completion (only if not already completed)
    let gamification = null;
    let pointsAwarded = 0;
    if (!result.wasAlreadyCompleted) {
      try {
        if (allSubtasksAlreadyDone) {
          // All subtasks were already completed - only award the task completion bonus
          // (subtask points were already awarded when each subtask was completed)
          const { awardTaskCompletionBonus } = await import("./userController.js");
          const reward = await awardTaskCompletionBonus(userId, result.task);
          pointsAwarded = reward.points;
          gamification = reward.gamification;
          logger.info(
            `[completeTask] All subtasks done, awarded ${reward.points} bonus points to user ${userId} for completing task ${id}`,
          );
        } else {
          // Either no subtasks or some uncompleted - award full points for remaining subtasks
          const { awardTaskCompletionPoints } = await import("./userController.js");
          const reward = await awardTaskCompletionPoints(userId, result.task, remainingSubtasks);
          pointsAwarded = reward.points;
          gamification = reward.gamification;
          logger.info(
            `[completeTask] Awarded ${reward.points} points (bonus: ${reward.bonus}) to user ${userId} for completing task ${id}`,
          );
        }
      } catch (pointsError) {
        logger.warn("[completeTask] Failed to award points for task completion:", pointsError.message);
      }
    } else {
      logger.info(`[completeTask] Task ${id} was already completed, not awarding points`);
    }

    logger.info(`[completeTask] Returning gamification:`, gamification);

    return res.status(200).json({
      success: true,
      task: result.task,
      gamification: gamification,
      pointsAwarded: pointsAwarded,
      actualCompletionMinutes: result.actualCompletionMinutes,
      message: "Task completed successfully",
    });
  } catch (error) {
    logger.error("[completeTask] Error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to complete task",
    });
  }
}
