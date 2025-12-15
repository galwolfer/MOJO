/**
 * @fileoverview Expired Task Checker Service
 * @module services/tasks/expiredTaskChecker
 * 
 * Scheduled service that monitors task deadlines and logs expired tasks.
 * Runs as a cron job to detect overdue tasks for system monitoring.
 * 
 * Key responsibilities:
 * - Periodically scan for tasks past their due date
 * - Log expired tasks for monitoring and analytics
 * - Support CLI blocking for users with expired tasks
 * - Allow users to extend or forfeit expired tasks
 * 
 * Default schedule: Every hour (configurable via EXPIRED_CHECK_CRON env var)
 * 
 * @requires node-cron - For scheduled job execution
 * @requires models/Task - Task database model
 */

import cron from "node-cron";
import Task from "../../models/Task.js";
import { logger } from "../../utils/logger.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Check every hour for expired tasks
const DEFAULT_CRON = process.env.EXPIRED_CHECK_CRON || "0 * * * *";

// =============================================================================
// CORE LOGIC
// =============================================================================

/**
 * Find all expired tasks across all users
 */
async function findAllExpiredTasks() {
  const now = new Date();

  return Task.find({
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  }).lean();
}

/**
 * Find expired tasks for a specific user
 */
export async function findExpiredTasksForUser(userId) {
  const now = new Date();

  const tasks = await Task.find({
    userId,
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  })
    .sort({ dueDate: 1 })
    .lean();

  return tasks.map((task) => {
    const dueDate = new Date(task.dueDate);
    const diffMs = now - dueDate;
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
      ...task,
      daysOverdue,
    };
  });
}

// =============================================================================
// JOB RUNNER
// =============================================================================

/**
 * Main job: check for expired tasks and log them
 */
async function runExpiredTaskCheck() {
  logger.info("⏰ Running expired task check...");

  try {
    const expiredTasks = await findAllExpiredTasks();

    if (expiredTasks.length === 0) {
      logger.info("   No expired tasks found");
      return;
    }

    logger.info(`   Found ${expiredTasks.length} expired tasks`);

    // Group tasks by user for logging
    const tasksByUser = new Map();
    for (const task of expiredTasks) {
      const userId = task.userId?.toString();
      if (!userId) continue;

      if (!tasksByUser.has(userId)) {
        tasksByUser.set(userId, {
          tasks: [],
        });
      }
      tasksByUser.get(userId).tasks.push(task);
    }

    // Log expired tasks for each user
    for (const [userId, { tasks }] of tasksByUser) {
      logger.info(`   User ${userId} has ${tasks.length} expired tasks`);
      
      // Log details of each expired task
      const now = new Date();
      for (const task of tasks) {
        const dueDate = new Date(task.dueDate);
        const diffMs = now - dueDate;
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        logger.info(`     - "${task.taskname}" (${daysOverdue} days overdue)`);
      }
    }

    logger.info(`✅ Expired task check complete: ${expiredTasks.length} expired tasks found`);
  } catch (error) {
    logger.error(`❌ Expired task check failed: ${error.message}`);
  }
}

// =============================================================================
// SCHEDULER
// =============================================================================

let scheduledJob = null;

/**
 * Start the expired task checker scheduler
 */
export function startExpiredTaskChecker(cronExpression = DEFAULT_CRON) {
  if (scheduledJob) {
    logger.warn("Expired task checker already running");
    return;
  }

  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  logger.info(`⏰ Starting expired task checker with cron: ${cronExpression}`);

  scheduledJob = cron.schedule(cronExpression, runExpiredTaskCheck, {
    timezone: process.env.TZ || "UTC",
  });

  // Also run immediately on startup to catch any expired tasks
  runExpiredTaskCheck();

  logger.info("✅ Expired task checker started");
}

/**
 * Stop the expired task checker
 */
export function stopExpiredTaskChecker() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    logger.info("🛑 Expired task checker stopped");
  }
}

/**
 * Manually trigger a check (for testing or API)
 */
export async function triggerExpiredTaskCheck() {
  return runExpiredTaskCheck();
}

/**
 * Check if a user has any expired tasks (for blocking middleware)
 */
export async function userHasExpiredTasks(userId) {
  const now = new Date();

  const count = await Task.countDocuments({
    userId,
    dueDate: { $exists: true, $lt: now },
    status: { $ne: "done" },
  });

  return count > 0;
}

export default {
  startExpiredTaskChecker,
  stopExpiredTaskChecker,
  triggerExpiredTaskCheck,
  userHasExpiredTasks,
  findExpiredTasksForUser,
};
