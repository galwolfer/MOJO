/**
 * Notification Scheduler
 * 
 * Manages scheduled notification jobs:
 * - Morning digest: Daily at 8 AM (per user timezone)
 * - Task reminders: Every 15 minutes check for upcoming tasks
 * 
 * Uses node-cron for scheduling.
 */

import cron from "node-cron";
import { logger } from "../utils/logger.js";
import {
  sendMorningDigestNotifications,
  sendTaskReminderNotifications,
} from "./notificationService.js";

let morningDigestJob = null;
let taskReminderJob = null;

/**
 * Start the morning digest scheduler
 * Runs every hour to check if users need their morning digest
 * (Users have different preferred times)
 */
export function startMorningDigestScheduler() {
  if (morningDigestJob) {
    logger.warn("Morning digest scheduler already running");
    return;
  }

  // Run at the start of every hour
  // The notification service handles timezone and user preferences
  morningDigestJob = cron.schedule("0 * * * *", async () => {
    logger.info("🌅 Running morning digest job");
    try {
      const results = await sendMorningDigestNotifications();
      logger.info(`Morning digest completed: ${JSON.stringify(results)}`);
    } catch (error) {
      logger.error("Morning digest job failed:", error);
    }
  });

  logger.info("📅 Morning digest scheduler started (runs hourly)");
}

/**
 * Start the task reminder scheduler
 * Runs every 15 minutes to check for upcoming tasks
 */
export function startTaskReminderScheduler() {
  if (taskReminderJob) {
    logger.warn("Task reminder scheduler already running");
    return;
  }

  // Run every 15 minutes
  taskReminderJob = cron.schedule("*/15 * * * *", async () => {
    logger.info("⏰ Running task reminder job");
    try {
      const results = await sendTaskReminderNotifications();
      logger.info(`Task reminders completed: ${JSON.stringify(results)}`);
    } catch (error) {
      logger.error("Task reminder job failed:", error);
    }
  });

  logger.info("📅 Task reminder scheduler started (runs every 15 minutes)");
}

/**
 * Start all notification schedulers
 */
export function startNotificationSchedulers() {
  startMorningDigestScheduler();
  startTaskReminderScheduler();
  logger.info("🔔 All notification schedulers started");
}

/**
 * Stop all notification schedulers
 */
export function stopNotificationSchedulers() {
  if (morningDigestJob) {
    morningDigestJob.stop();
    morningDigestJob = null;
    logger.info("Morning digest scheduler stopped");
  }

  if (taskReminderJob) {
    taskReminderJob.stop();
    taskReminderJob = null;
    logger.info("Task reminder scheduler stopped");
  }

  logger.info("🔕 All notification schedulers stopped");
}

/**
 * Get scheduler status
 * @returns {Object} Status of each scheduler
 */
export function getSchedulerStatus() {
  return {
    morningDigest: {
      running: morningDigestJob !== null,
      schedule: "Every hour at :00",
    },
    taskReminder: {
      running: taskReminderJob !== null,
      schedule: "Every 15 minutes",
    },
  };
}
