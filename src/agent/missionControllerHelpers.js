/**
 * @fileoverview Mission Controller Helpers
 * @module agent/missionControllerHelpers
 *
 * Provides helper functions for missions to call controllers programmatically
 * instead of directly accessing services. This centralizes business logic in controllers
 * and makes missions cleaner, more testable, and reduces code duplication.
 *
 * Benefits:
 * - Single source of truth for business logic (in controllers)
 * - Missions delegate to controllers instead of duplicating code
 * - Scheduler triggers happen in one place (controllers)
 * - Easier to maintain and test
 *
 * @requires services/taskService
 * @requires controllers/taskController
 */

import * as taskService from "../services/taskService.js";
import * as taskController from "../controllers/taskController.js";
import { logger } from "../utils/logger.js";

/**
 * Create a task through the controller (instead of direct taskService call)
 * This ensures scheduling is triggered automatically after creation
 *
 * @param {string} userId - User ID
 * @param {object} taskData - Task data with fields: taskname, category, deadline, etc.
 * @returns {Promise<object>} Task object with _id, or null if creation failed
 *
 * @example
 * const task = await createTaskViaController(userId, {
 *   taskname: "Learn React",
 *   deadline: "2025-02-15",
 *   category: "study_and_education"
 * });
 */
export async function createTaskViaController(userId, taskData) {
  try {
    // Create mock request/response objects for controller
    const mockReq = {
      user: { userId },
      body: {
        taskname: taskData.taskname,
        name: taskData.taskname,
        category: taskData.category,
        subcategory: taskData.subcategory,
        deadline: taskData.dueDate || taskData.deadline,
        recurrence: taskData.recurrence,
        description: taskData.description,
      },
    };

    let responseBody = null;
    let statusCode = null;

    const mockRes = {
      status: (code) => ({
        json: (body) => {
          statusCode = code;
          responseBody = body;
          return mockRes;
        },
      }),
    };

    // Call the controller
    await taskController.createTask(mockReq, mockRes);

    // Check if successful
    if (statusCode >= 200 && statusCode < 300 && responseBody?.success) {
      logger.info(`[MISSION] Created task via controller: ${responseBody.task._id}`);
      return responseBody.task;
    } else {
      logger.error(`[MISSION] Controller failed to create task: ${responseBody?.error || "unknown error"}`);
      return null;
    }
  } catch (error) {
    logger.error("[MISSION] Exception in createTaskViaController:", error);
    return null;
  }
}

/**
 * Update a task through the controller (instead of direct taskService call)
 * This ensures scheduling is triggered automatically after update
 *
 * @param {string} userId - User ID
 * @param {string} taskId - Task ID to update
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated task object, or null if update failed
 *
 * @example
 * const updated = await updateTaskViaController(userId, taskId, {
 *   importance: 5,
 *   deadline: "2025-02-20"
 * });
 */
export async function updateTaskViaController(userId, taskId, updates) {
  try {
    const mockReq = {
      user: { userId },
      params: { id: taskId },
      body: updates,
    };

    let responseBody = null;
    let statusCode = null;

    const mockRes = {
      status: (code) => ({
        json: (body) => {
          statusCode = code;
          responseBody = body;
          return mockRes;
        },
      }),
    };

    // Call the controller
    await taskController.updateTask(mockReq, mockRes);

    // Check if successful
    if (statusCode >= 200 && statusCode < 300 && responseBody?.success) {
      logger.info(`[MISSION] Updated task via controller: ${taskId}`);
      return responseBody.task;
    } else {
      logger.error(`[MISSION] Controller failed to update task: ${responseBody?.error || "unknown error"}`);
      return null;
    }
  } catch (error) {
    logger.error("[MISSION] Exception in updateTaskViaController:", error);
    return null;
  }
}

/**
 * Delete a task through the controller (instead of direct taskService call)
 * This ensures scheduling is triggered automatically after deletion
 *
 * @param {string} userId - User ID
 * @param {string} taskId - Task ID to delete
 * @returns {Promise<boolean>} True if deletion succeeded
 *
 * @example
 * const success = await deleteTaskViaController(userId, taskId);
 */
export async function deleteTaskViaController(userId, taskId) {
  try {
    const mockReq = {
      user: { userId },
      params: { id: taskId },
    };

    let responseBody = null;
    let statusCode = null;

    const mockRes = {
      status: (code) => ({
        json: (body) => {
          statusCode = code;
          responseBody = body;
          return mockRes;
        },
      }),
    };

    // Call the controller
    await taskController.deleteTask(mockReq, mockRes);

    // Check if successful
    if (statusCode >= 200 && statusCode < 300 && responseBody?.success) {
      logger.info(`[MISSION] Deleted task via controller: ${taskId}`);
      return true;
    } else {
      logger.error(`[MISSION] Controller failed to delete task: ${responseBody?.error || "unknown error"}`);
      return false;
    }
  } catch (error) {
    logger.error("[MISSION] Exception in deleteTaskViaController:", error);
    return false;
  }
}

/**
 * Save subcategory to user profile
 * Wrapper around taskController's autoSaveSubcategory
 *
 * @param {string} userId - User ID
 * @param {string} subcategoryName - Subcategory name
 * @param {string} categoryKey - Category key
 * @returns {Promise<void>}
 */
export async function saveSubcategoryToProfile(userId, subcategoryName, categoryKey) {
  try {
    await taskController.autoSaveSubcategory(userId, subcategoryName, categoryKey);
    logger.info(`[MISSION] Saved subcategory "${subcategoryName}" to category ${categoryKey}`);
  } catch (error) {
    logger.error("[MISSION] Failed to save subcategory:", error);
    // Don't fail the operation if subcategory save fails
  }
}
