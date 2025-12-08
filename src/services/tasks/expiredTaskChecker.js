/**
 * @fileoverview Expired Task Checker Service
 * @module services/tasks/expiredTaskChecker
 * 
 * Scheduled service that monitors task deadlines and handles expired tasks.
 * Runs as a cron job to detect overdue tasks and notify users.
 * 
 * Key responsibilities:
 * - Periodically scan for tasks past their due date
 * - Send push notifications for expired tasks
 * - Track notified tasks to avoid spam
 * - Support CLI blocking for users with expired tasks
 * - Allow users to extend or forfeit expired tasks
 * 
 * Default schedule: Every hour (configurable via EXPIRED_CHECK_CRON env var)
 * 
 * @requires node-cron - For scheduled job execution
 * @requires models/Task - Task database model
 * @requires services/notifications/pushNotification - Push notification service
 */

import cron from "node-cron";
import Task from "../../models/Task.js";
import { User } from "../../models/User.js";
import { sendPushNotification } from "../notifications/pushNotification.js";
import { logger } from "../../utils/logger.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Check every hour for expired tasks
const DEFAULT_CRON = process.env.EXPIRED_CHECK_CRON || "0 * * * *";

// Track which tasks we've already notified about (to avoid spam)
// Map of taskId -> last notification timestamp
const notifiedTasks = new Map();

// Don't notify about the same task more than once per 24 hours
const NOTIFICATION_COOLDOWN_HOURS = 24;

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
  })
    .populate("userId", "username email settings")
    .lean();
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

/**
 * Check if we should notify about a task (cooldown check)
 */
function shouldNotify(taskId) {
  const lastNotified = notifiedTasks.get(taskId.toString());
  if (!lastNotified) return true;

  const hoursSince = (Date.now() - lastNotified) / (1000 * 60 * 60);
  return hoursSince >= NOTIFICATION_COOLDOWN_HOURS;
}

/**
 * Mark a task as notified
 */
function markNotified(taskId) {
  notifiedTasks.set(taskId.toString(), Date.now());
}

/**
 * Build notification message for expired tasks
 */
function buildExpiredNotification(tasks) {
  const count = tasks.length;

  if (count === 1) {
    const task = tasks[0];
    const daysOverdue = task.daysOverdue || 1;

    return {
      title: "⚠️ Task Deadline Expired!",
      body: `"${task.taskname}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue. Please extend or remove it.`,
      data: {
        type: "expired_task",
        taskId: task._id.toString(),
        action: "handle_expired",
      },
    };
  }

  // Multiple tasks
  const mostOverdue = tasks.reduce((max, t) => 
    (t.daysOverdue || 0) > (max.daysOverdue || 0) ? t : max
  , tasks[0]);

  return {
    title: `⚠️ ${count} Tasks Overdue!`,
    body: `You have ${count} tasks past their deadlines. "${mostOverdue.taskname}" is ${mostOverdue.daysOverdue} days overdue.`,
    data: {
      type: "expired_tasks",
      count,
      action: "handle_expired",
    },
  };
}

// =============================================================================
// JOB RUNNER
// =============================================================================

/**
 * Main job: check for expired tasks and notify users
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

    // Group tasks by user
    const tasksByUser = new Map();
    for (const task of expiredTasks) {
      const userId = task.userId?._id?.toString() || task.userId?.toString();
      if (!userId) continue;

      if (!tasksByUser.has(userId)) {
        tasksByUser.set(userId, {
          user: task.userId,
          tasks: [],
        });
      }
      tasksByUser.get(userId).tasks.push(task);
    }

    // Process each user
    let notificationsSent = 0;

    for (const [userId, { user, tasks }] of tasksByUser) {
      // Filter to tasks we haven't notified about recently
      const tasksToNotify = tasks.filter((t) => shouldNotify(t._id));

      if (tasksToNotify.length === 0) continue;

      // Check if user has push notifications enabled
      if (user?.settings?.pushNotifications === false) {
        logger.info(`   Skipping user ${userId} - notifications disabled`);
        continue;
      }

      // Calculate days overdue for each task
      const now = new Date();
      const tasksWithOverdue = tasksToNotify.map((task) => {
        const dueDate = new Date(task.dueDate);
        const diffMs = now - dueDate;
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return { ...task, daysOverdue };
      });

      // Build and send notification
      const notification = buildExpiredNotification(tasksWithOverdue);

      try {
        await sendPushNotification(userId, notification);

        // Mark all tasks as notified
        for (const task of tasksToNotify) {
          markNotified(task._id);
        }

        notificationsSent++;
        logger.info(`   Notified user ${userId} about ${tasksToNotify.length} expired tasks`);
      } catch (err) {
        logger.error(`   Failed to notify user ${userId}: ${err.message}`);
      }
    }

    logger.info(`✅ Expired task check complete: ${notificationsSent} notifications sent`);
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
