/*
 * File: src/controllers/taskController.js
 * Purpose: Task-related HTTP controllers (create, update, list, expired management)
 */

import * as taskService from "../services/taskService.js";
import { logger } from "../utils/logger.js";
import { User } from "../models/User.js";
import { getCategoryIndex, isValidCategory } from "../config/categories.js";
import { hasIllegalDisplayChars } from "../utils/illegalChars.js";

/**
 * Task Controller
 * Handles HTTP requests for task operations
 */

/**
 * Auto-save subcategory to user profile
 * Automatically adds new subcategories to user's collection when they create/update tasks
 * 
 * @param {string} userId - User ID
 * @param {string} subcategoryName - Subcategory name
 * @param {string} categoryKey - Category key (e.g., "work_and_career")
 */
async function autoSaveSubcategory(userId, subcategoryName, categoryKey) {
  try {
    // Validate inputs
    if (!subcategoryName || typeof subcategoryName !== "string" || subcategoryName.trim().length === 0) {
      return; // Skip if invalid
    }

    if (!categoryKey || !isValidCategory(categoryKey)) {
      return; // Skip if invalid category
    }

    const trimmedName = subcategoryName.trim();
    
    // Get category index (0-17)
    const categoryIndex = getCategoryIndex(categoryKey);

    // Find user and check if subcategory already exists
    const user = await User.findById(userId);
    if (!user) {
      return; // User not found, skip silently
    }

    // Check if this subcategory already exists for this category (case-insensitive)
    const exists = user.subCategories.some(
      (sub) => sub.category === categoryIndex && sub.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      return; // Already exists, nothing to do
    }

    // Add new subcategory to user profile
    user.subCategories.push({
      name: trimmedName,
      category: categoryIndex,
    });

    await user.save();
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
      deadline, 
      recurrence,
      importance,
      effort,
      estimatedMinutes,
      description,
      tags,
      subtasks,
      taskType,
      chunkCount,
    } = req.body;

    console.log("Extracted fields:", {
      importance,
      effort,
      estimatedMinutes,
      description,
      tags,
      subtasks,
      taskType,
      chunkCount,
    });

    const title = (taskname || name || "").trim();

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

    if (subcategory && hasIllegalDisplayChars(subcategory)) {
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
    if (subcategory && category) {
      await autoSaveSubcategory(userId, subcategory, category);
    }

    const task = await taskService.createTask({
      userId,
      taskname: title,
      description: description || undefined,
      category: category || "",
      subCategory: subcategory ? { label: subcategory, source: "user", confidence: 1, updatedAt: new Date() } : null,
      dueDate: deadline ? new Date(deadline) : null,
      importance: importance !== undefined ? importance : 3, // Default to 3 if not provided
      effort: effort !== undefined ? effort : 3, // Default to 3 if not provided
      estimatedDuration: estimatedMinutes || 60, // Default to 60 minutes if not provided
      tags: tags || undefined,
      subtasks: subtasks || undefined,
      taskType: taskType || "perfect",
      chunkCount: chunkCount || undefined,
      recurrence,
    });

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
    const { tag, category, completed, dueBefore, dueAfter } = req.query;

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
    if (raw.subcategory !== undefined) {
      if (typeof raw.subcategory === "string" && hasIllegalDisplayChars(raw.subcategory)) {
        return res.status(400).json({ success: false, error: "Subcategory cannot include angle brackets." });
      }
      updates.subCategory = { label: raw.subcategory, source: "user", confidence: 1, updatedAt: new Date() };
      
      // Auto-save subcategory to user profile
      const taskCategory = raw.category || updates.category;
      if (taskCategory && raw.subcategory) {
        await autoSaveSubcategory(userId, raw.subcategory, taskCategory);
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
      const cc = Number(raw.chunkCount);
      if (!Number.isInteger(cc) || cc < 1) {
        return res.status(400).json({ success: false, error: "Chunk count must be at least 1" });
      }
      updates.chunkCount = cc;
    }
    
    if (raw.chunkMinutes !== undefined) {
      const cm = Number(raw.chunkMinutes);
      if (isNaN(cm) || cm < 1) {
        return res.status(400).json({ success: false, error: "Chunk minutes must be at least 1" });
      }
      updates.chunkMinutes = Math.round(cm);
    }
    
    if (raw.minMinutes !== undefined) {
      const min = Number(raw.minMinutes);
      if (isNaN(min) || min < 1) {
        return res.status(400).json({ success: false, error: "Min minutes must be at least 1" });
      }
      updates.minMinutes = Math.round(min);
    }
    
    if (raw.maxMinutes !== undefined) {
      const max = Number(raw.maxMinutes);
      if (isNaN(max) || max < 1) {
        return res.status(400).json({ success: false, error: "Max minutes must be at least 1" });
      }
      updates.maxMinutes = Math.round(max);
    }
    
    if (raw.minChunk !== undefined) {
      const mc = Number(raw.minChunk);
      if (isNaN(mc) || mc < 15) {
        return res.status(400).json({ success: false, error: "Min chunk must be at least 15 minutes" });
      }
      updates.minChunk = Math.round(mc);
    }
    
    // Validate min/max relationship
    if (updates.minMinutes && updates.maxMinutes && updates.minMinutes > updates.maxMinutes) {
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

    return res.status(200).json({ 
      success: true, 
      task: result.task,
      gamification: gamification,
      message: "Task updated successfully"
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

    const success = await taskService.deleteTask(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      id,
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
 * Toggle task completion
 * POST /api/tasks/:id/toggle
 */
export async function toggleTaskCompletion(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const task = await taskService.toggleTaskCompletion(id, userId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      task,
      message: `Task marked as ${task.completed ? "completed" : "incomplete"}`,
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

    return res.status(200).json({ 
      success: true, 
      subtask: result.subtask,
      message: "Subtask updated successfully"
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
    const { subId } = req.params;

    const result = await taskService.updateSubTask({
      userId,
      subTaskId: subId,
      updates: { status: "done" }
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    return res.status(200).json({ 
      success: true, 
      subtask: result.subtask,
      message: "Subtask marked as complete"
    });
  } catch (error) {
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
      updates: { status: "todo" }
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    return res.status(200).json({ 
      success: true, 
      subtask: result.subtask,
      message: "Subtask marked as todo"
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
        error: "Status is required and must be 'todo' or 'done'" 
      });
    }

    const result = await taskService.updateSubTask({
      userId,
      subTaskId: subId,
      updates: { status }
    });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Subtask not found" });
    }

    return res.status(200).json({ 
      success: true, 
      subtask: result.subtask,
      message: `Subtask status updated to ${status}`
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
      errors: []
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
        details: results.errors
      });
    }
    
    return res.status(200).json({
      success: true,
      message: hasErrors ? "Partial update completed with some errors" : "Task and subtasks updated successfully",
      task: results.task,
      subtasks: results.subtasks,
      errors: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (error) {
    logger.error("Error in bulkUpdateTaskWithSubtasks controller:", error);
    return res.status(500).json({ success: false, error: "Failed to update task and subtasks" });
  }
}

/**
 * Complete a task (with ML training)
 * POST /api/tasks/:id/complete
 */
export async function completeTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await taskService.completeTask({ taskId: id, userId });

    if (!result || result.success === false) {
      return res.status(404).json({
        success: false,
        error: result?.error || "Task not found",
      });
    }

    // Award points for task completion
    let gamification = null;
    try {
      const { awardTaskCompletionPoints } = await import("./userController.js");
      const reward = await awardTaskCompletionPoints(userId, result.task);
      logger.info(`Awarded ${reward.points} points to user ${userId} for completing task ${id}`);
      gamification = reward.gamification;
    } catch (pointsError) {
      logger.warn("Failed to award points for task completion:", pointsError.message);
    }

    return res.status(200).json({
      success: true,
      task: result.task,
      gamification: gamification,
      actualCompletionMinutes: result.actualCompletionMinutes,
      message: "Task completed successfully",
    });
  } catch (error) {
    logger.error("Error in completeTask controller:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to complete task",
    });
  }
}
