/*
 * File: src/routes/tasks.js
 * Purpose: Task CRUD and expired task management endpoints
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as taskController from "../controllers/taskController.js";
import { Task } from "../models/Task.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { logger } from "../utils/logger.js";

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

  FILTERED QUERIES
    GET    /upcoming/:days?   Tasks due within N days
    GET    /overdue           Overdue tasks

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
   FILTERED QUERIES
   These routes must come before /:id routes to avoid conflicts
   ───────────────────────────────────────────────────────────────────────── */

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
        categories: task.categories,
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
      { new: true }
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
        { new: true }
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

// Get a single task by ID
router.get("/:id", taskController.getTaskById);

// Update a task
router.patch("/:id", taskController.updateTask);

// Delete a task
router.delete("/:id", taskController.deleteTask);

// Toggle task completion status
router.post("/:id/toggle", taskController.toggleTaskCompletion);


export default router;
