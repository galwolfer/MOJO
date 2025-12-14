// src/routes/expiredTasks.js
// API routes for handling expired tasks (deadlines passed)

import { Router } from "express";
import { Task } from "../models/Task.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /api/expired-tasks
 * Get all expired tasks for a user that need attention
 * 
 * Query params:
 *   - userId: Required - the user's ID
 * 
 * Response:
 *   - hasExpired: boolean - true if there are expired tasks
 *   - count: number - how many expired tasks
 *   - tasks: array - the expired tasks with details
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    const now = new Date();

    // Find tasks where:
    // - dueDate exists and is in the past
    // - status is NOT "done"
    const expiredTasks = await Task.find({
      userId,
      dueDate: { $exists: true, $lt: now },
      status: { $ne: "done" },
    })
      .sort({ dueDate: 1 }) // Oldest first (most overdue)
      .lean();

    // Calculate days overdue for each task
    const tasksWithOverdue = expiredTasks.map((task) => {
      const dueDate = new Date(task.dueDate);
      const diffMs = now - dueDate;
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return {
        _id: task._id,
        taskname: task.taskname,
        description: task.description,
        dueDate: task.dueDate,
        daysOverdue,
        importance: task.importance,
        status: task.status,
        estimatedDuration: task.estimatedDuration,
        tags: task.tags,
      };
    });

    res.json({
      success: true,
      hasExpired: tasksWithOverdue.length > 0,
      count: tasksWithOverdue.length,
      tasks: tasksWithOverdue,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/expired-tasks/check
 * Quick check if user has any expired tasks (for blocking check)
 * 
 * Returns just a boolean - useful for client to decide whether to show blocking modal
 */
router.get("/check", async (req, res, next) => {
  try {
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    const now = new Date();

    const count = await Task.countDocuments({
      userId,
      dueDate: { $exists: true, $lt: now },
      status: { $ne: "done" },
    });

    res.json({
      success: true,
      hasExpired: count > 0,
      count,
      blocked: count > 0, // User is blocked if they have expired tasks
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/expired-tasks/:taskId/extend
 * Extend the deadline of an expired task
 * 
 * Body:
 *   - newDeadline: string (ISO date) - the new deadline
 */
router.patch("/:taskId/extend", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { newDeadline } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    if (!newDeadline) {
      return res.status(400).json({
        success: false,
        error: "New deadline is required",
      });
    }

    const newDate = new Date(newDeadline);
    const now = new Date();

    // Validate new deadline is in the future
    if (newDate <= now) {
      return res.status(400).json({
        success: false,
        error: "New deadline must be in the future",
      });
    }

    // Find and update the task
    const task = await Task.findOneAndUpdate(
      {
        _id: taskId,
        userId,
        status: { $ne: "done" },
      },
      {
        $set: { dueDate: newDate },
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found or already completed",
      });
    }

    logger.info(`Task ${taskId} deadline extended to ${newDate.toISOString()}`);

    res.json({
      success: true,
      message: "Deadline extended successfully",
      task: {
        _id: task._id,
        taskname: task.taskname,
        dueDate: task.dueDate,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/expired-tasks/:taskId/forfeit
 * Forfeit (delete) an expired task
 * 
 * The task is permanently deleted from the database
 */
router.delete("/:taskId/forfeit", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?._id || req.query.userId || req.body?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    // Find the task first to get its name for logging
    const task = await Task.findOne({
      _id: taskId,
      userId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    const taskName = task.taskname;

    // Delete the task permanently
    await Task.deleteOne({ _id: taskId, userId });

    // Also delete any scheduled sessions for this task
    try {
      const TaskSchedule = (await import("../models/TaskSchedule.js")).default;
      await TaskSchedule.deleteMany({ taskId });
      logger.info(`Deleted scheduled sessions for forfeited task ${taskId}`);
    } catch (scheduleErr) {
      // TaskSchedule might not exist, that's okay
      logger.warn(`Could not delete schedules for task ${taskId}: ${scheduleErr.message}`);
    }

    logger.info(`Task "${taskName}" (${taskId}) forfeited and deleted`);

    res.json({
      success: true,
      message: `Task "${taskName}" has been deleted`,
      deletedTaskId: taskId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/expired-tasks/:taskId/handle
 * Handle an expired task with a single endpoint
 * 
 * Body:
 *   - action: "extend" | "forfeit"
 *   - newDeadline: string (ISO date) - required if action is "extend"
 */
router.post("/:taskId/handle", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { action, newDeadline } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    if (!action || !["extend", "forfeit"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Action must be 'extend' or 'forfeit'",
      });
    }

    if (action === "extend") {
      if (!newDeadline) {
        return res.status(400).json({
          success: false,
          error: "New deadline is required for extend action",
        });
      }

      const newDate = new Date(newDeadline);
      const now = new Date();

      if (newDate <= now) {
        return res.status(400).json({
          success: false,
          error: "New deadline must be in the future",
        });
      }

      const task = await Task.findOneAndUpdate(
        { _id: taskId, userId, status: { $ne: "done" } },
        { $set: { dueDate: newDate } },
        { new: true }
      );

      if (!task) {
        return res.status(404).json({
          success: false,
          error: "Task not found",
        });
      }

      logger.info(`Task ${taskId} deadline extended to ${newDate.toISOString()}`);

      return res.json({
        success: true,
        action: "extended",
        task: {
          _id: task._id,
          taskname: task.taskname,
          dueDate: task.dueDate,
        },
      });
    }

    if (action === "forfeit") {
      const task = await Task.findOne({ _id: taskId, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: "Task not found",
        });
      }

      const taskName = task.taskname;
      await Task.deleteOne({ _id: taskId, userId });

      // Delete scheduled sessions
      try {
        const TaskSchedule = (await import("../models/TaskSchedule.js")).default;
        await TaskSchedule.deleteMany({ taskId });
      } catch (err) {
        // Ignore if TaskSchedule doesn't exist
      }

      logger.info(`Task "${taskName}" (${taskId}) forfeited and deleted`);

      return res.json({
        success: true,
        action: "forfeited",
        deletedTaskId: taskId,
        taskname: taskName,
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
