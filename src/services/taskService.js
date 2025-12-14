import { Task } from "../models/Task.js";
import { logger } from "../utils/logger.js";

/**
 * Task Service
 * Handles all task-related database operations
 */

/**
 * Create a new task
 * @param {string} userId - User ID
 * @param {Object} taskData - Task data
 * @returns {Promise<Object>} Created task
 */
export async function createTask(userId, taskData) {
  try {
    const { name, tag, deadline, recurrence } = taskData;

    // Validate deadline is required and in the future
    if (!deadline) {
      throw new Error("Due date is required");
    }
    
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      throw new Error("Invalid deadline format");
    }

    const taskDoc = {
      userId,
      taskname: name,
      tag: tag || null,
      dueDate: deadlineDate, // Map deadline to dueDate (Task model field)
    };

    // Add recurrence if provided
    if (recurrence && recurrence.type) {
      taskDoc.recurrence = {
        type: recurrence.type,
        interval: recurrence.interval || 1,
        endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
        count: recurrence.count || null,
        completedDates: [],
      };
    }

    const task = new Task(taskDoc);

    await task.save();

    logger.info(`Task created for user ${userId}: ${task._id}${recurrence ? " (recurring)" : ""}`);

    return task.toObject();
  } catch (error) {
    logger.error("Error creating task:", error);
    throw error;
  }
}

/**
 * Get all tasks for a user with optional filters
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of tasks
 */
export async function getTasks(userId, filters = {}) {
  try {
    const query = { userId };

    // Apply filters
    if (filters.tag) {
      query.tag = filters.tag;
    }

    if (filters.completed !== undefined) {
      query.completed = filters.completed;
    }

    if (filters.dueBefore) {
      query.deadline = { $lte: new Date(filters.dueBefore) };
    }

    if (filters.dueAfter) {
      query.deadline = {
        ...query.deadline,
        $gte: new Date(filters.dueAfter),
      };
    }

    const tasks = await Task.find(query).sort({ deadline: 1 }).lean();

    logger.info(`Retrieved ${tasks.length} tasks for user ${userId}`);

    return tasks;
  } catch (error) {
    logger.error("Error getting tasks:", error);
    throw error;
  }
}

/**
 * Get a single task by ID (with ownership check)
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Task or null
 */
export async function getTaskById(taskId, userId) {
  try {
    const task = await Task.findOne({ _id: taskId, userId }).lean();

    if (!task) {
      logger.warn(`Task ${taskId} not found for user ${userId}`);
      return null;
    }

    return task;
  } catch (error) {
    logger.error("Error getting task by ID:", error);
    throw error;
  }
}

/**
 * Update a task (with ownership check)
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated task or null
 */
export async function updateTask(taskId, userId, updates) {
  try {
    // Validate deadline if provided
    if (updates.deadline) {
      const deadlineDate = new Date(updates.deadline);
      if (isNaN(deadlineDate.getTime())) {
        throw new Error("Invalid deadline format");
      }
      updates.deadline = deadlineDate;
    }

    // Only allow specific fields to be updated
    const allowedUpdates = ["name", "tag", "deadline", "completed", "recurrence"];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId },
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).lean();

    if (!task) {
      logger.warn(`Task ${taskId} not found for user ${userId}`);
      return null;
    }

    logger.info(`Task ${taskId} updated for user ${userId}`);

    return task;
  } catch (error) {
    logger.error("Error updating task:", error);
    throw error;
  }
}

/**
 * Delete a task (with ownership check)
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTask(taskId, userId) {
  try {
    const result = await Task.deleteOne({ _id: taskId, userId });

    if (result.deletedCount === 0) {
      logger.warn(`Task ${taskId} not found for user ${userId}`);
      return false;
    }

    logger.info(`Task ${taskId} deleted for user ${userId}`);

    return true;
  } catch (error) {
    logger.error("Error deleting task:", error);
    throw error;
  }
}

/**
 * Get upcoming tasks (within specified days)
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look ahead
 * @returns {Promise<Array>} List of upcoming tasks
 */
export async function getUpcomingTasks(userId, days = 7) {
  try {
    const tasks = await Task.findUpcoming(userId, days);
    logger.info(`Retrieved ${tasks.length} upcoming tasks for user ${userId}`);
    return tasks.map((t) => t.toObject());
  } catch (error) {
    logger.error("Error getting upcoming tasks:", error);
    throw error;
  }
}

/**
 * Get overdue tasks
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of overdue tasks
 */
export async function getOverdueTasks(userId) {
  try {
    const tasks = await Task.findOverdue(userId);
    logger.info(`Retrieved ${tasks.length} overdue tasks for user ${userId}`);
    return tasks.map((t) => t.toObject());
  } catch (error) {
    logger.error("Error getting overdue tasks:", error);
    throw error;
  }
}

/**
 * Toggle task completion status
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Updated task or null
 */
export async function toggleTaskCompletion(taskId, userId) {
  try {
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      logger.warn(`Task ${taskId} not found for user ${userId}`);
      return null;
    }

    // If marking as incomplete, just toggle
    if (task.completed) {
      task.completed = false;
      await task.save();
      logger.info(`Task ${taskId} marked as incomplete`);
      return task.toObject();
    }

    // If marking as complete, use the model's markComplete method
    // This handles recurring tasks automatically
    const result = await task.markComplete();

    if (result.nextTask) {
      logger.info(`Task ${taskId} completed. Next occurrence created: ${result.nextTask._id}`);
    } else {
      logger.info(`Task ${taskId} marked as completed`);
    }

    return task.toObject();
  } catch (error) {
    logger.error("Error toggling task completion:", error);
    throw error;
  }
}
