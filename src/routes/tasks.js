/*
 * File: src/routes/tasks.js
 * Purpose: Task CRUD and expired task management endpoints
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as taskController from "../controllers/taskController.js";
import { Task } from "../models/Task.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";
import { getCategoryIndex, isValidCategory, getDisplayName } from "../config/categories.js";

const router = Router();

/*
 ╔═══════════════════════════════════════════════════════════════════════════╗
 ║                           TASKS ROUTER                                    ║
 ║                     All task-related API endpoints                        ║
 ╠═══════════════════════════════════════════════════════════════════════════╣
 ║  Base path: /api/tasks                                                    ║
 ║  All routes require authentication                                        ║
 ╚═══════════════════════════════════════════════════════════════════════════╝

 QUICK REFERENCE
 ───────────────────────────────────────────────────────────────────────────

 CRUD Operations
    POST   /              Create a new task
    GET    /              Get all tasks (with filters)
    GET    /:id           Get single task
    PATCH  /:id           Update a task
    DELETE /:id           Delete a task
    POST   /:id/toggle    Toggle completion
    POST   /:id/complete  Complete task (triggers ML training)

  SUBTASK Operations
    GET    /:id/subtasks                    Get all subtasks for a task
    GET    /:taskId/subtasks/:subId         Get single subtask
    PATCH  /:taskId/subtasks/:subId         Update subtask fields
    POST   /:taskId/subtasks/:subId/complete   Mark subtask complete
    POST   /:taskId/subtasks/:subId/todo       Mark subtask as todo
    PATCH  /:taskId/subtasks/:subId/status     Update subtask status

  FILTERED QUERIES
    GET    /upcoming/:days?   Tasks due within N days
    GET    /overdue           Overdue tasks

  SUBCATEGORY MANAGEMENT
    POST   /subcategories                Add custom subcategory
    GET    /subcategories?category=...   Get user's subcategories
    DELETE /subcategories/:name          Remove custom subcategory

  EXPIRED TASK MANAGEMENT
    GET    /expired             List all expired tasks
    GET    /expired/check       Quick check (boolean)
    PATCH  /expired/:id/extend  Extend deadline
    DELETE /expired/:id/forfeit Delete expired task
    POST   /expired/:id/handle  Combined extend/forfeit

 ───────────────────────────────────────────────────────────────────────────
*/

// All routes require authentication
router.use(requireAuth);

/* ─────────────────────────────────────────────────────────────────────────
   TASK SUGGESTIONS
   AI-powered suggestions for task categorization
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Suggest category and subcategory based on task name
 * POST /api/tasks/suggest-category
 * Body: { taskname: string }
 * 
 * Returns suggested category and subcategory for autofill
 */
router.post("/suggest-category", taskController.suggestCategory);

/* ─────────────────────────────────────────────────────────────────────────
   SUBCATEGORY MANAGEMENT
   User-defined subcategories for personalized task organization
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Add a custom subcategory for a specific category
 * POST /api/tasks/subcategories
 * Body: { name: string, category: string }
 *
 * Validates category exists (0-17) and prevents duplicates
 * Limited to 50 subcategories per category per user
 */
router.post("/subcategories", async (req, res, next) => {
  try {
    const { name, category } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Subcategory name is required" });
    }

    if (!category || typeof category !== "string") {
      return res.status(400).json({ success: false, error: "Category is required" });
    }

    // Validate category exists
    if (!isValidCategory(category)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category. Must be one of the 18 standard categories",
      });
    }

    const categoryIndex = getCategoryIndex(category);
    const trimmedName = name.trim();

    // Name length validation
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Subcategory name must be between 2 and 50 characters",
      });
    }

    // Get user and check existing subcategories
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check for duplicate (case-insensitive)
    const existingInCategory = user.subCategories.filter((s) => s.category === categoryIndex);
    const duplicate = existingInCategory.find((s) => s.name.toLowerCase() === trimmedName.toLowerCase());

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: `Subcategory "${trimmedName}" already exists in ${getDisplayName(category)}`,
      });
    }

    // Limit: 50 subcategories per category
    if (existingInCategory.length >= 50) {
      return res.status(400).json({
        success: false,
        error: `Maximum 50 subcategories per category reached for ${getDisplayName(category)}`,
      });
    }

    // Add new subcategory
    user.subCategories.push({ name: trimmedName, category: categoryIndex });
    await user.save();

    logger.info(`User ${userId} added subcategory "${trimmedName}" to ${category}`);

    res.status(201).json({
      success: true,
      message: "Subcategory added successfully",
      subcategory: { name: trimmedName, category: category, categoryIndex },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's custom subcategories
 * GET /api/tasks/subcategories?category=work_and_career
 *
 * If category provided: returns subcategories for that category only
 * If no category: returns all user subcategories grouped by category
 *
 * Also includes historical task-derived subcategories (merged and deduped)
 */
router.get("/subcategories", async (req, res, next) => {
  try {
    const { category } = req.query;
    const userId = req.user.userId;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Filter by category if provided
    if (category) {
      if (!isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category",
        });
      }

      const categoryIndex = getCategoryIndex(category);
      const normalizedCategory = category.toLowerCase().replace(/[^a-z_]/g, "");

      // Get user-saved subcategories
      const userSubs = (user.subCategories || []).filter((s) => s.category === categoryIndex).map((s) => s.name);

      // Get historical task subcategories
      const taskSubs = await Task.distinct("subCategory.label", {
        userId,
        category: normalizedCategory,
      });
      const validTaskSubs = (taskSubs || [])
        .filter((s) => s && typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());

      // Merge and dedupe (case-sensitive)
      const combined = new Set([...userSubs, ...validTaskSubs]);
      const subcategories = Array.from(combined).sort();

      return res.json({
        success: true,
        category,
        categoryDisplay: getDisplayName(category),
        count: subcategories.length,
        subcategories,
      });
    }

    // No category filter: return all grouped by category
    const grouped = {};

    for (const sub of user.subCategories || []) {
      const catIndex = sub.category;
      if (!grouped[catIndex]) {
        grouped[catIndex] = [];
      }
      grouped[catIndex].push(sub.name);
    }

    res.json({
      success: true,
      totalCount: (user.subCategories || []).length,
      subcategoriesByCategory: grouped,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a custom subcategory
 * DELETE /api/tasks/subcategories/:name?category=work_and_career
 *
 * Removes subcategory from user profile
 * Does NOT affect existing tasks that use this subcategory
 */
router.delete("/subcategories/:name", async (req, res, next) => {
  try {
    const { name } = req.params;
    const { category } = req.query;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Subcategory name is required" });
    }

    if (!category) {
      return res.status(400).json({ success: false, error: "Category query parameter is required" });
    }

    if (!isValidCategory(category)) {
      return res.status(400).json({ success: false, error: "Invalid category" });
    }

    const categoryIndex = getCategoryIndex(category);
    const trimmedName = decodeURIComponent(name.trim());

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Find and remove (case-insensitive match)
    const initialLength = user.subCategories.length;
    user.subCategories = user.subCategories.filter(
      (s) => !(s.category === categoryIndex && s.name.toLowerCase() === trimmedName.toLowerCase()),
    );

    if (user.subCategories.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: `Subcategory "${trimmedName}" not found in ${getDisplayName(category)}`,
      });
    }

    await user.save();

    logger.info(`User ${userId} removed subcategory "${trimmedName}" from ${category}`);

    res.json({
      success: true,
      message: "Subcategory removed successfully",
      removed: { name: trimmedName, category },
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   FILTERED QUERIES
   These routes must come before /:id routes to avoid conflicts
   ───────────────────────────────────────────────────────────────────────── */

// Get tasks scheduled within the next N days (grouped by day)
router.get("/scheduled/:days?", taskController.getScheduledTasks);

// Get tasks due within the next N days (default: 7)
router.get("/upcoming/:days?", taskController.getUpcomingTasks);

// Get all overdue tasks (past deadline + not completed)
router.get("/overdue", taskController.getOverdueTasks);

/* ─────────────────────────────────────────────────────────────────────────
   EXPIRED TASK MANAGEMENT
   Routes for handling tasks that have passed their deadline
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Get all expired tasks
 * Returns tasks with dueDate in the past that aren't marked as done
 */
router.get("/expired", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    const expiredTasks = await Task.find({
      userId,
      dueDate: { $exists: true, $lt: now },
      status: { $ne: "done" },
    })
      .sort({ dueDate: 1 })
      .lean();

    const tasks = expiredTasks.map((task) => {
      const daysOverdue = Math.floor((now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));
      return {
        _id: task._id,
        taskname: task.taskname,
        description: task.description,
        dueDate: task.dueDate,
        daysOverdue,
        importance: task.importance,
        status: task.status,
        estimatedDuration: task.estimatedDuration,
        category: task.category,
      };
    });

    res.json({ success: true, hasExpired: tasks.length > 0, count: tasks.length, tasks });
  } catch (error) {
    next(error);
  }
});

/**
 * Quick check if user has any expired tasks
 * Useful for UI to decide whether to show a blocking modal
 */
router.get("/expired/check", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    const count = await Task.countDocuments({
      userId,
      dueDate: { $exists: true, $lt: now },
      status: { $ne: "done" },
    });

    res.json({ success: true, hasExpired: count > 0, count, blocked: count > 0 });
  } catch (error) {
    next(error);
  }
});

/**
 * Extend an expired task's deadline
 * Body: { newDeadline: "2025-12-31T23:59:59Z" }
 */
router.patch("/expired/:id/extend", async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const { newDeadline } = req.body;
    const userId = req.user.userId;

    if (!newDeadline) {
      return res.status(400).json({ success: false, error: "New deadline is required" });
    }

    const newDate = new Date(newDeadline);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return res.status(400).json({ success: false, error: "New deadline must be a valid future date" });
    }

    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId, status: { $ne: "done" } },
      { $set: { dueDate: newDate } },
      { new: true },
    );

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found or already completed" });
    }

    logger.info(`Task ${taskId} deadline extended to ${newDate.toISOString()}`);
    res.json({
      success: true,
      message: "Deadline extended successfully",
      task: { _id: task._id, taskname: task.taskname, dueDate: task.dueDate },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Forfeit (permanently delete) an expired task
 * Also removes any scheduled sessions for this task
 */
router.delete("/expired/:id/forfeit", async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user.userId;

    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const taskName = task.taskname;

    await Task.deleteOne({ _id: taskId, userId });
    await TaskSchedule.deleteMany({ taskId }).catch(() => {});

    logger.info(`Task "${taskName}" (${taskId}) forfeited and deleted`);
    res.json({ success: true, message: `Task "${taskName}" has been deleted`, deletedTaskId: taskId });
  } catch (error) {
    next(error);
  }
});

/**
 * Handle an expired task with a single request
 * Body: { action: "extend" | "forfeit", newDeadline?: "ISO date" }
 */
router.post("/expired/:id/handle", async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const { action, newDeadline } = req.body;
    const userId = req.user.userId;

    if (!["extend", "forfeit"].includes(action)) {
      return res.status(400).json({ success: false, error: "Action must be 'extend' or 'forfeit'" });
    }

    // Handle EXTEND action
    if (action === "extend") {
      if (!newDeadline) {
        return res.status(400).json({ success: false, error: "New deadline is required for extend action" });
      }

      const newDate = new Date(newDeadline);
      if (isNaN(newDate.getTime()) || newDate <= new Date()) {
        return res.status(400).json({ success: false, error: "New deadline must be a valid future date" });
      }

      const task = await Task.findOneAndUpdate(
        { _id: taskId, userId, status: { $ne: "done" } },
        { $set: { dueDate: newDate } },
        { new: true },
      );

      if (!task) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }

      logger.info(`Task ${taskId} deadline extended to ${newDate.toISOString()}`);
      return res.json({
        success: true,
        action: "extended",
        task: { _id: task._id, taskname: task.taskname, dueDate: task.dueDate },
      });
    }

    // Handle FORFEIT action
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const taskName = task.taskname;
    await Task.deleteOne({ _id: taskId, userId });
    await TaskSchedule.deleteMany({ taskId }).catch(() => {});

    logger.info(`Task "${taskName}" (${taskId}) forfeited and deleted`);
    return res.json({ success: true, action: "forfeited", deletedTaskId: taskId, taskname: taskName });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   STANDARD CRUD OPERATIONS
   Basic create, read, update, delete operations for tasks
   ───────────────────────────────────────────────────────────────────────── */

// Create a new task
router.post("/", taskController.createTask);

// Get all tasks (supports filters: tag, completed, dueBefore, dueAfter)
router.get("/", taskController.getTasks);

// Get subtasks for a task
router.get("/:id/subtasks", taskController.getSubTasksForTask);

// Get task progress with subtasks and schedule details
router.get("/:id/progress", taskController.getTaskProgress);

// Get a single subtask by ID
router.get("/:taskId/subtasks/:subId", taskController.getSubTaskById);

// Update a single subtask for a task (mark complete / update title)
router.patch("/:taskId/subtasks/:subId", taskController.updateSubTask);

// Mark subtask as complete (shortcut)
router.post("/:taskId/subtasks/:subId/complete", taskController.markSubTaskComplete);

// Mark subtask as todo (shortcut)
router.post("/:taskId/subtasks/:subId/todo", taskController.markSubTaskTodo);

// Update subtask status directly
router.patch("/:taskId/subtasks/:subId/status", taskController.updateSubTaskStatus);

// Bulk update task with subtasks in one call
router.patch("/:id/full", taskController.bulkUpdateTaskWithSubtasks);

// Get a single task by ID
router.get("/:id", taskController.getTaskById);

// Update a task
router.patch("/:id", taskController.updateTask);

// Delete a task
router.delete("/:id", taskController.deleteTask);

// Toggle task completion status
router.post("/:id/toggle", taskController.toggleTaskCompletion);

// Complete a task (with ML training)
router.post("/:id/complete", taskController.completeTask);

export default router;
