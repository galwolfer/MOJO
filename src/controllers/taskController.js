/*
 * File: src/controllers/taskController.js
 * Purpose: Task-related HTTP controllers (create, update, list, expired management)
 */

import * as taskService from "../services/taskService.js";
import { logger } from "../utils/logger.js";

/**
 * Task Controller
 * Handles HTTP requests for task operations
 */

/**
 * Create a new task
 * POST /api/tasks
 */
export async function createTask(req, res) {
  try {
    const userId = req.user.userId;
    const { name, taskname, tag, tags, deadline, recurrence } = req.body;

    const title = (taskname || name || "").trim();

    // Validation
    if (!title) {
      return res.status(400).json({ success: false, error: "Task title is required" });
    }

    if (!deadline) {
      return res.status(400).json({ success: false, error: "Deadline is required" });
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

    const task = await taskService.createTask({
      userId,
      taskname: title,
      tags: tags || (tag ? [tag.trim()] : []),
      dueDate: deadline ? new Date(deadline) : null,
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
 */
export async function updateTask(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const raw = req.body || {};

    // Map public API fields to service field names
    const updates = {};
    if (raw.taskname !== undefined || raw.name !== undefined)
      updates.taskname =
        typeof (raw.taskname || raw.name) === "string" ? (raw.taskname || raw.name).trim() : raw.taskname || raw.name;
    if (raw.tags !== undefined) updates.tags = Array.isArray(raw.tags) ? raw.tags : [];
    if (raw.tag !== undefined) updates.tags = raw.tag ? [String(raw.tag).trim()] : [];
    if (raw.importance !== undefined) updates.importance = Number(raw.importance);
    if (raw.effort !== undefined) updates.effort = Number(raw.effort);
    if (raw.estimatedDuration !== undefined) updates.estimatedDuration = Number(raw.estimatedDuration);
    if (raw.canSplit !== undefined) updates.canSplit = Boolean(raw.canSplit);
    if (raw.taskType !== undefined) updates.taskType = raw.taskType;
    if (raw.subCategory !== undefined) updates.subCategory = raw.subCategory;
    if (raw.completed !== undefined) updates.status = raw.completed ? "done" : "todo";

    // Validate and map deadline if provided
    if (raw.deadline !== undefined) {
      const d = new Date(raw.deadline);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, error: "Invalid deadline format. Use ISO 8601 date." });
      }
      updates.dueDate = d;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const result = await taskService.updateTask({ userId, taskId: id, updates });

    if (!result || result.success === false) {
      return res.status(404).json({ success: false, error: result ? result.error : "Task not found" });
    }

    return res.status(200).json({ success: true, task: result.task });
  } catch (error) {
    logger.error("Error in updateTask controller:", error);

    if (error.message.includes("Invalid deadline")) {
      return res.status(400).json({
        success: false,
        error: "Invalid deadline format. Use ISO 8601 format (e.g., 2025-11-01T12:00:00Z)",
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

    return res.status(200).json({
      success: true,
      task: result.task,
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
