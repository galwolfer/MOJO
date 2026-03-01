/*
 * File: src/routes/tasks.js
 * Purpose: Task CRUD and expired task management endpoints
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as taskController from "../controllers/taskController.js";
import { Task } from "../models/Task.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { SubTask } from "../models/SubTask.js";
import { User } from "../models/User.js";
import { Subcategory } from "../models/Subcategory.js";
import { logger } from "../utils/logger.js";
import { isValidCategory, getDisplayName } from "../config/categories.js";
import { BusyBlock } from "../models/BusyBlock.js";
import { computeSessionHash, withUserScheduleLock } from "../services/schedulingService.js";
import {
  addSubcategoryToUser,
  findOrCreateSubcategory,
  findSubcategoryByName,
} from "../services/subcategoryService.js";

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
    PATCH  /subcategories/:id            Update subcategory (name/icon)
    DELETE /subcategories/:id            Remove custom subcategory

  EXPIRED TASK MANAGEMENT
    GET    /expired             List all expired tasks
    GET    /expired/check       Quick check (boolean)
    PATCH  /expired/:id/extend  Extend deadline
    POST   /expired/:id/handle  Extend deadline

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
    const { name, category, icon, color } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Subcategory name is required" });
    }

    if (!category || typeof category !== "string") {
      return res.status(400).json({ success: false, error: "Category is required" });
    }

    const normalizedCategory = String(category || "")
      .toLowerCase()
      .replace(/[^a-z_]/g, "");

    // Validate category exists
    if (!isValidCategory(normalizedCategory)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category. Must be one of the 18 standard categories",
      });
    }

    const trimmedName = name.trim();

    // Name length validation
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Subcategory name must be between 2 and 50 characters",
      });
    }

    // Check for duplicate (case-insensitive)
    const duplicate = await findSubcategoryByName({
      userId,
      name: trimmedName,
      parent: normalizedCategory,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: `Subcategory "${trimmedName}" already exists in ${getDisplayName(normalizedCategory)}`,
      });
    }

    // Limit: 50 subcategories per category
    const existingCount = await Subcategory.countDocuments({ userId, parent: normalizedCategory });
    if (existingCount >= 50) {
      return res.status(400).json({
        success: false,
        error: `Maximum 50 subcategories per category reached for ${getDisplayName(normalizedCategory)}`,
      });
    }

    // Add new subcategory
    const created = await findOrCreateSubcategory({
      userId,
      name: trimmedName,
      parent: normalizedCategory,
      icon: typeof icon === "string" && icon.trim().length > 0 ? icon.trim() : null,
      color: typeof color === "string" && color.trim().length > 0 ? color.trim() : null,
      source: "user",
      confidence: 1,
    });

    if (created?._id) {
      await addSubcategoryToUser(userId, created._id);
    }

    logger.info(`User ${userId} added subcategory "${trimmedName}" to ${normalizedCategory}`);

    res.status(201).json({
      success: true,
      message: "Subcategory added successfully",
      subcategory: {
        id: created?._id,
        name: created?.name || trimmedName,
        parent: normalizedCategory,
        icon: created?.icon || null,
        color: created?.color || null,
        source: created?.source || "user",
        confidence: created?.confidence ?? 1,
      },
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

    // Filter by category if provided
    if (category) {
      const normalizedCategory = String(category || "")
        .toLowerCase()
        .replace(/[^a-z_]/g, "");

      if (!isValidCategory(normalizedCategory)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category",
        });
      }
      const subs = await Subcategory.find({ userId, parent: normalizedCategory }).sort({ nameLower: 1 }).lean();

      // Also include system-wide general subcategory for this category
      const systemUserId = "000000000000000000000000";
      const generalSub = await Subcategory.findOne({
        userId: systemUserId,
        parent: normalizedCategory,
        source: "category-default",
      }).lean();

      const allSubs = generalSub ? [generalSub, ...subs] : subs;

      return res.json({
        success: true,
        category: normalizedCategory,
        categoryDisplay: getDisplayName(normalizedCategory),
        count: allSubs.length,
        subcategories: allSubs.map((s) => ({
          id: s._id,
          name: s.name,
          parent: s.parent,
          icon: s.icon || null,
          color: s.color || null,
          source: s.source,
          confidence: s.confidence,
        })),
      });
    }

    // No category filter: return all grouped by category
    const subs = await Subcategory.find({ userId }).sort({ parent: 1, nameLower: 1 }).lean();

    // Also include system-wide general subcategories
    const systemUserId = "000000000000000000000000";
    const generalSubs = await Subcategory.find({
      userId: systemUserId,
      source: "category-default",
    })
      .sort({ parent: 1 })
      .lean();

    const grouped = {};

    // First add general subcategories
    for (const sub of generalSubs || []) {
      const catKey = sub.parent;
      if (!grouped[catKey]) {
        grouped[catKey] = [];
      }
      grouped[catKey].push({
        id: sub._id,
        name: sub.name,
        parent: sub.parent,
        icon: sub.icon || null,
        color: sub.color || null,
        source: sub.source,
        confidence: sub.confidence,
      });
    }

    // Then add user subcategories
    for (const sub of subs || []) {
      const catKey = sub.parent;
      if (!grouped[catKey]) {
        grouped[catKey] = [];
      }
      grouped[catKey].push({
        id: sub._id,
        name: sub.name,
        parent: sub.parent,
        icon: sub.icon || null,
        color: sub.color || null,
        source: sub.source,
        confidence: sub.confidence,
      });
    }

    res.json({
      success: true,
      totalCount: subs.length,
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
router.delete("/subcategories/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category } = req.query;
    const userId = req.user.userId;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Subcategory id is required" });
    }

    const isId = /^[a-fA-F0-9]{24}$/.test(id);
    let subcategoryDoc = null;

    if (isId) {
      subcategoryDoc = await Subcategory.findOne({ _id: id, userId }).lean();
    } else {
      if (!category) {
        return res.status(400).json({ success: false, error: "Category query parameter is required" });
      }

      const normalizedCategory = String(category || "")
        .toLowerCase()
        .replace(/[^a-z_]/g, "");

      if (!isValidCategory(normalizedCategory)) {
        return res.status(400).json({ success: false, error: "Invalid category" });
      }

      const trimmedName = decodeURIComponent(id.trim());
      subcategoryDoc = await findSubcategoryByName({
        userId,
        name: trimmedName,
        parent: normalizedCategory,
      });
    }

    if (!subcategoryDoc) {
      return res.status(404).json({
        success: false,
        error: "Subcategory not found",
      });
    }

    const parentCategory = subcategoryDoc.parent;
    // Look up the system-level general subcategory (never create under user's ID)
    const systemUserId = "000000000000000000000000";
    const generalSub = await Subcategory.findOne({
      userId: systemUserId,
      parent: parentCategory,
      source: "category-default",
    }).lean();
    const generalId = generalSub?._id || null;

    if (generalId) {
      await Task.updateMany({ userId, subCategory: subcategoryDoc._id }, { $set: { subCategory: generalId } });
    } else {
      await Task.updateMany({ userId, subCategory: subcategoryDoc._id }, { $set: { subCategory: null } });
    }

    await Subcategory.deleteOne({ _id: subcategoryDoc._id, userId });
    await User.updateOne({ _id: userId }, { $pull: { subCategories: subcategoryDoc._id } }).catch(() => {});

    logger.info(`User ${userId} removed subcategory "${subcategoryDoc.name}" from ${parentCategory}`);

    res.json({
      success: true,
      message: "Subcategory removed successfully",
      removed: {
        id: subcategoryDoc._id,
        name: subcategoryDoc.name,
        parent: subcategoryDoc.parent,
      },
      reassignedTo: generalId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a custom subcategory (name/icon)
 * PATCH /api/tasks/subcategories/:id
 * Body: { name?: string, icon?: string | null }
 */
router.patch("/subcategories/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;
    const userId = req.user.userId;

    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({ success: false, error: "Valid subcategory id is required" });
    }

    const subcategoryDoc = await Subcategory.findOne({ _id: id, userId });
    if (!subcategoryDoc) {
      return res.status(404).json({ success: false, error: "Subcategory not found" });
    }

    let changed = false;

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Subcategory name is required" });
      }

      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json({
          success: false,
          error: "Subcategory name must be between 2 and 50 characters",
        });
      }

      const existing = await findSubcategoryByName({
        userId,
        name: trimmedName,
        parent: subcategoryDoc.parent,
      });
      if (existing && existing._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          error: `Subcategory "${trimmedName}" already exists in ${getDisplayName(subcategoryDoc.parent)}`,
        });
      }

      subcategoryDoc.name = trimmedName;
      changed = true;
    }

    if (icon !== undefined) {
      subcategoryDoc.icon = typeof icon === "string" && icon.trim().length > 0 ? icon.trim() : null;
      changed = true;
    }

    if (color !== undefined) {
      subcategoryDoc.color = typeof color === "string" && color.trim().length > 0 ? color.trim() : null;
      changed = true;
    }

    if (!changed) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const saved = await subcategoryDoc.save();

    res.json({
      success: true,
      message: "Subcategory updated successfully",
      subcategory: {
        id: saved._id,
        name: saved.name,
        parent: saved.parent,
        icon: saved.icon || null,
        color: saved.color || null,
        source: saved.source,
        confidence: saved.confidence,
      },
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

// Decline overdue tasks – increments the per-task dismiss counter (3 declines = task hidden)
router.post("/overdue/decline", taskController.declineOverdueTasks);

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
 * Handle an expired task – extend its deadline
 * Body: { newDeadline: "ISO date" }
 */
router.post("/expired/:id/handle", async (req, res, next) => {
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
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    logger.info(`Task ${taskId} deadline extended to ${newDate.toISOString()}`);
    return res.json({
      success: true,
      action: "extended",
      task: { _id: task._id, taskname: task.taskname, dueDate: task.dueDate },
    });
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

/**
 * Delete a single subtask and its corresponding TaskSchedule entries
 * DELETE /api/tasks/:taskId/subtasks/:subId
 */
router.delete("/:taskId/subtasks/:subId", requireAuth, async (req, res, next) => {
  try {
    const { taskId, subId } = req.params;
    const userId = req.user.userId;

    // Find the subtask first so we can get its index
    const subtask = await SubTask.findOne({ _id: subId, taskId, userId });
    if (!subtask) {
      return res.status(404).json({ success: false, message: "Subtask not found" });
    }

    const subtaskIndex = subtask.index;

    // Delete the SubTask document
    await SubTask.deleteOne({ _id: subId });

    // Delete all TaskSchedule entries that belong to this subtask
    if (subtaskIndex !== undefined && subtaskIndex !== null) {
      await TaskSchedule.deleteMany({ taskId, subtaskIndex });
    }

    return res.json({ success: true, deletedSubtaskIndex: subtaskIndex });
  } catch (err) {
    next(err);
  }
});

// Bulk update task with subtasks in one call
router.patch("/:id/full", taskController.bulkUpdateTaskWithSubtasks);

/* ─────────────────────────────────────────────────────────────────────────
   SCHEDULED SESSIONS RETRIEVAL
   Get scheduled sessions for a date range
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Get all scheduled sessions for a user within a date range
 * GET /api/tasks/schedule/sessions?startDate=ISO&endDate=ISO
 *
 * Query parameters:
 * - startDate: ISO string for start of range
 * - endDate: ISO string for end of range
 *
 * Response:
 * {
 *   success: boolean,
 *   sessions: Array<{
 *     _id, start, end, minutes, taskId, status, subtaskIndex,
 *     taskId: { populated task data }
 *   }>
 * }
 */
router.get("/schedule/sessions", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate query parameters are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Use ISO string format (YYYY-MM-DDTHH:mm:ss.sssZ)",
      });
    }

    // Fetch scheduled sessions for the date range, filtering by user via the task reference
    const sessions = await TaskSchedule.find({
      start: { $gte: start, $lte: end },
    })
      .populate({
        path: "taskId",
        match: { userId }, // Only include sessions for tasks owned by this user
        select:
          "taskname description category tags dueDate importance effort subCategory estimatedDuration earliestStart progressPercentage subTasks",
        populate: { path: "subCategory" },
      })
      .sort({ start: 1 })
      .lean();

    // Filter out sessions where the task doesn't belong to the user
    const userSessions = sessions.filter((session) => session.taskId !== null);

    console.log(`[schedule/sessions] Found ${userSessions.length} sessions for user`);
    userSessions.forEach((session) => {
      console.log(
        `  - Session ${session._id}: taskId=${session.taskId._id}, subtaskIndex=${session.subtaskIndex}, start=${new Date(session.start).toISOString()}`,
      );
    });

    // Manually populate subtasks for ALL tasks with userId filter
    // This ensures we have subtask data when needed
    const taskIds = userSessions.map((session) => session.taskId._id);
    if (taskIds.length > 0) {
      const subtasks = await SubTask.find({ userId, taskId: { $in: taskIds } }).lean();
      console.log(`[schedule/sessions] Found ${subtasks.length} subtasks`);
      subtasks.forEach((st) => {
        console.log(`  - Subtask ${st._id} for task ${st.taskId} index=${st.index} (${st.title})`);
      });

      // Group subtasks by taskId
      const subtasksByTaskId = {};
      subtasks.forEach((subtask) => {
        if (!subtasksByTaskId[subtask.taskId]) {
          subtasksByTaskId[subtask.taskId] = [];
        }
        subtasksByTaskId[subtask.taskId].push(subtask);
      });

      // Deduplicate subtasks per task by their index (keep first occurrence and sort by index)
      for (const tid of Object.keys(subtasksByTaskId)) {
        const list = subtasksByTaskId[tid];
        const seen = new Set();
        const unique = [];
        list.sort((a, b) => (a.index || 0) - (b.index || 0));
        for (const st of list) {
          const idx = st.index ?? null;
          const key = idx === null ? st._id.toString() : String(idx);
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(st);
          } else {
            console.warn(
              `[schedule/sessions] Duplicate subtask index detected for task ${tid}, index=${idx}, id=${st._id} - ignoring duplicate`,
            );
          }
        }
        subtasksByTaskId[tid] = unique;
      }

      // Attach subtasks to taskId in sessions
      userSessions.forEach((session) => {
        if (subtasksByTaskId[session.taskId._id]) {
          session.taskId.subTasks = subtasksByTaskId[session.taskId._id];
          console.log(
            `[schedule/sessions] Attached ${session.taskId.subTasks.length} subtasks to task ${session.taskId._id}`,
          );
        } else {
          session.taskId.subTasks = []; // Ensure empty array if no subtasks
          console.log(`[schedule/sessions] No subtasks for task ${session.taskId._id}`);
        }
      });
    }

    res.json({
      success: true,
      sessions: userSessions,
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   MANUAL SCHEDULE MANAGEMENT
   Read and write the raw TaskSchedule entries for a specific task.
   These routes let the Edit-Task screen show/edit sessions directly.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Get raw scheduled sessions for a specific task (all statuses).
 * GET /api/tasks/:id/sessions
 *
 * Response: { success, sessions: [{ _id, start, end, minutes, subtaskIndex, subtaskTitle, status, manuallyScheduled }] }
 */
router.get("/:id/sessions", requireAuth, async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user.userId;

    // Verify task belongs to user
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const sessions = await TaskSchedule.find({ taskId }).sort({ start: 1 }).lean();

    return res.json({
      success: true,
      manualSchedule: task.manualSchedule ?? false,
      sessions: sessions.map((s) => ({
        _id: s._id,
        start: s.start,
        end: s.end,
        minutes: s.minutes,
        subtaskIndex: s.subtaskIndex ?? null,
        subtaskTitle: s.subtaskTitle ?? null,
        status: s.status,
        manuallyScheduled: s.manuallyScheduled ?? false,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Replace a task's planned sessions with a manually-defined set.
 * PATCH /api/tasks/:id/sessions
 *
 * Body: { sessions: [{ id?, start (ISO), end (ISO), subtaskIndex? }] }
 *
 * Validation:
 *  - end > start for each session
 *  - No overlap between sessions (respects user's minGapMinutes)
 *  - No overlap with user BusyBlocks (with minGapMinutes gap)
 *  - No overlap with OTHER tasks' planned sessions (with minGapMinutes gap)
 *
 * On success:
 *  - Deletes existing non-completed planned/skipped sessions for the task
 *  - Inserts new sessions marked manuallyScheduled: true
 *  - Sets task.manualSchedule = true  →  auto-scheduler will skip this task
 *
 * Response: { success, sessions: [...] }
 */
router.patch("/:id/sessions", requireAuth, async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user.userId;
    const { sessions } = req.body;

    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: "sessions must be an array" });
    }

    // Verify task belongs to user
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    // Get user minGapMinutes
    const user = await User.findById(userId).select("schedulingPreferences").lean();
    const minGapMs = (user?.schedulingPreferences?.minGapMinutes ?? 10) * 60_000;

    // Parse and validate each session
    const parsed = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const start = new Date(s.start);
      const end = new Date(s.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, error: `Session ${i + 1}: invalid date format` });
      }
      if (end <= start) {
        return res.status(400).json({ success: false, error: `Session ${i + 1}: end time must be after start time` });
      }
      parsed.push({
        id: s.id,
        start,
        end,
        subtaskIndex: s.subtaskIndex ?? null,
        minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      });
    }

    // Check no overlap between the submitted sessions themselves
    const sortedParsed = [...parsed].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 0; i < sortedParsed.length - 1; i++) {
      const curr = sortedParsed[i];
      const next = sortedParsed[i + 1];
      if (curr.end.getTime() + minGapMs > next.start.getTime()) {
        return res.status(409).json({
          success: false,
          error: `Sessions ${i + 1} and ${i + 2} are overlapping or too close together (minimum ${user?.schedulingPreferences?.minGapMinutes ?? 10} min gap required)`,
          conflicts: [{ type: "self_overlap", indices: [i, i + 1] }],
        });
      }
    }

    if (parsed.length > 0) {
      // Check against BusyBlocks
      const globalStart = sortedParsed[0].start;
      const globalEnd = sortedParsed[sortedParsed.length - 1].end;

      const busyBlocks = await BusyBlock.find({
        userId,
        $or: [
          { isRecurring: { $ne: true }, start: { $lt: globalEnd }, end: { $gt: globalStart } },
          { isRecurring: true },
        ],
      }).lean();

      for (const session of parsed) {
        for (const block of busyBlocks) {
          let blockStart, blockEnd;
          if (block.isRecurring && block.recurrence?.daysOfWeek?.length) {
            const sessionDow = session.start.getUTCDay();
            if (!block.recurrence.daysOfWeek.includes(sessionDow)) continue;
            // Re-anchor recurring block times to the session's date (UTC)
            const refStart = new Date(block.start);
            const refEnd = new Date(block.end);
            const sessionMidnight = new Date(session.start);
            sessionMidnight.setUTCHours(0, 0, 0, 0);
            blockStart = new Date(sessionMidnight.getTime());
            blockStart.setUTCHours(refStart.getUTCHours(), refStart.getUTCMinutes(), 0, 0);
            blockEnd = new Date(sessionMidnight.getTime());
            blockEnd.setUTCHours(refEnd.getUTCHours(), refEnd.getUTCMinutes(), 0, 0);
          } else {
            blockStart = new Date(block.start);
            blockEnd = new Date(block.end);
          }
          const buffStart = blockStart.getTime() - minGapMs;
          const buffEnd = blockEnd.getTime() + minGapMs;
          if (session.start.getTime() < buffEnd && session.end.getTime() > buffStart) {
            return res.status(409).json({
              success: false,
              error: `Session starting at ${session.start.toLocaleString()} conflicts with busy block "${block.title || "Busy"}"`,
              conflicts: [{ type: "busy_block", sessionStart: session.start, blockTitle: block.title }],
            });
          }
        }
      }

      // Check against other tasks' planned sessions (not for this task)
      const otherSessionConflicts = await TaskSchedule.find({
        userId,
        taskId: { $ne: taskId },
        status: "planned",
        start: { $lt: new Date(globalEnd.getTime() + minGapMs) },
        end: { $gt: new Date(globalStart.getTime() - minGapMs) },
      }).lean();

      for (const session of parsed) {
        for (const other of otherSessionConflicts) {
          const buffStart = other.start.getTime() - minGapMs;
          const buffEnd = other.end.getTime() + minGapMs;
          if (session.start.getTime() < buffEnd && session.end.getTime() > buffStart) {
            return res.status(409).json({
              success: false,
              error: `Session starting at ${session.start.toLocaleString()} overlaps with another scheduled task`,
              conflicts: [{ type: "other_task_overlap", sessionStart: session.start }],
            });
          }
        }
      }
    }

    // Get subtask title/description map for this task
    const subTaskDocs = await SubTask.find({ taskId }).lean();
    const subTaskMap = new Map(subTaskDocs.map((st) => [st.index, st]));

    // Wrap the delete→insert in a per-user lock to prevent concurrent saves from
    // doubling the sessions (same race condition the auto-scheduler guards against).
    const inserted = await withUserScheduleLock(userId, async () => {
      // Replace existing non-completed sessions for this task
      await TaskSchedule.deleteMany({ taskId, status: { $nin: ["completed"] } });

      const newDocs = parsed.map((s) => {
        const subtask = s.subtaskIndex != null ? subTaskMap.get(s.subtaskIndex) : null;
        return {
          userId,
          taskId,
          subtaskIndex: s.subtaskIndex,
          subtaskTitle: subtask?.title ?? null,
          description: subtask?.description ?? null,
          start: s.start,
          end: s.end,
          minutes: s.minutes,
          status: "planned",
          manuallyScheduled: true,
          // Give manual sessions the same DB-level dedup protection as auto-scheduled ones.
          sessionHash: computeSessionHash(userId, taskId, s.start, s.end, s.subtaskIndex ?? null),
        };
      });

      if (newDocs.length === 0) return [];

      try {
        return await TaskSchedule.insertMany(newDocs, { ordered: false });
      } catch (err) {
        if (err.code === 11000 || err.name === "MongoBulkWriteError") {
          // Duplicate-key: a concurrent save already inserted these sessions.
          // Return what was actually inserted (the write errors tell us the others).
          return err.insertedDocs ?? [];
        }
        throw err;
      }
    });

    // Mark task as manually scheduled so auto-scheduler skips it
    await Task.updateOne({ _id: taskId }, { $set: { manualSchedule: true } });

    return res.json({
      success: true,
      message: `Manual schedule saved: ${inserted.length} session(s)`,
      sessions: inserted.map((s) => ({
        _id: s._id,
        start: s.start,
        end: s.end,
        minutes: s.minutes,
        subtaskIndex: s.subtaskIndex ?? null,
        subtaskTitle: s.subtaskTitle ?? null,
        status: s.status,
        manuallyScheduled: s.manuallyScheduled,
      })),
    });
  } catch (err) {
    next(err);
  }
});

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

/* ─────────────────────────────────────────────────────────────────────────
   DEBUG ENDPOINTS (for testing completedAt)
   ───────────────────────────────────────────────────────────────────────── */

// DEBUG: Update task completedAt for testing
router.patch("/:id/debug/completed-at", taskController.debugUpdateTaskCompletedAt);

// DEBUG: Update subtask completedAt for testing
router.patch("/:taskId/subtasks/:subId/debug/completed-at", taskController.debugUpdateSubtaskCompletedAt);

/* ─────────────────────────────────────────────────────────────────────────
   TASK SCHEDULING
   Generate and save automatic plans for tasks
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Generate and save an automatic schedule/plan for a task
 * POST /api/tasks/:id/schedule
 *
 * Generates an optimal schedule using CSP algorithm considering:
 * - Task estimated duration
 * - User's working hours and daily capacity
 * - Routine blocks (sleep, meals, etc.)
 * - Existing busy blocks and completed sessions
 *
 * Body (optional):
 * {
 *   planningHorizonDays?: number (default 14),
 *   includeSubtasks?: boolean (default true)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   plan: Array<{ start, end, minutes, taskId, subtaskIndex }>,
 *   unscheduled: Array<{ taskId, reason }>,
 *   scheduledCount: number
 * }
 */
router.post("/:id/schedule", async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const { planningHorizonDays = 14 } = req.body;
    const userId = req.user.userId;

    // Import scheduling service
    const { generatePlan, savePlan } = await import("../services/schedulingService.js");

    // Verify task exists and belongs to user
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    // Clear manual-schedule flag so the auto-scheduler will include this task
    // and delete any existing manual sessions for it
    await Task.updateOne({ _id: taskId }, { $set: { manualSchedule: false } });
    await TaskSchedule.deleteMany({ taskId, status: { $nin: ["completed"] } });

    // Get user profile for scheduling preferences
    const user = await User.findById(userId).select("profile subCategories schedulingPreferences").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Merge schedulingPreferences into profile for the scheduler
    const profileWithGap = {
      ...(user.profile || {}),
      minGapMinutes: user.schedulingPreferences?.minGapMinutes ?? 10,
    };

    // Generate plan
    const { plan, unscheduled } = await generatePlan({
      userId,
      profile: profileWithGap,
      planningHorizonDays,
    });

    if (!plan || plan.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Unable to generate schedule. Task may already be fully scheduled or no available time slots.",
        unscheduled,
      });
    }

    // Save plan to database
    await savePlan({ userId, plan, unscheduled });

    logger.info(`Generated schedule for task ${taskId}: ${plan.length} sessions planned`);

    res.status(201).json({
      success: true,
      message: `Schedule created successfully. ${plan.length} session(s) scheduled.`,
      scheduledCount: plan.length,
      unscheduledCount: unscheduled.length,
      plan: plan.map((p) => ({
        start: p.start,
        end: p.end,
        minutes: p.minutes,
        taskId: p.taskId,
        subtaskIndex: p.subtaskIndex || null,
      })),
      unscheduled,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/reschedule-all
 * Force-regenerate the full scheduling plan for the authenticated user.
 * Useful for testing scheduling fixes without creating/editing a task.
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   scheduledCount: number,
 *   unscheduledCount: number,
 *   plan: Array<{ start, end, minutes, taskId, subtaskIndex }>
 * }
 */
router.post("/reschedule-all", async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const { generatePlan, savePlan } = await import("../services/schedulingService.js");

    const user = await User.findById(userId).select("profile subCategories schedulingPreferences").lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const profileWithGap = {
      ...(user.profile || {}),
      minGapMinutes: user.schedulingPreferences?.minGapMinutes ?? 10,
    };

    const { plan, unscheduled } = await generatePlan({
      userId,
      profile: profileWithGap,
      planningHorizonDays: 14,
    });

    await savePlan({ userId, plan, unscheduled });

    logger.info(`Force-rescheduled all tasks for user ${userId}: ${plan.length} sessions`);

    res.status(200).json({
      success: true,
      message: `Rescheduled successfully. ${plan.length} session(s) planned.`,
      scheduledCount: plan.length,
      unscheduledCount: unscheduled.length,
      plan: plan.map((p) => ({
        start: p.start,
        end: p.end,
        minutes: p.minutes,
        taskId: p.taskId,
        subtaskIndex: p.subtaskIndex || null,
      })),
      unscheduled,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
