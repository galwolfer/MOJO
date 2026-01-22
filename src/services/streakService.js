/**
 * @fileoverview Streak Service
 * @module services/streakService
 * 
 * Handles daily streak checking and reset logic.
 * Runs a daily cron job to check if users completed tasks.
 * If no tasks were completed the previous day, reset streak to 0.
 * 
 * @requires models/User - User database model
 * @requires models/Task - Task database model
 */

import cron from "node-cron";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { logger } from "../utils/logger.js";

// Default: Run every day at midnight (00:00)
const DEFAULT_CRON = process.env.STREAK_CHECK_CRON || "0 0 * * *";

let scheduledJob = null;

/**
 * Check if a user completed any tasks yesterday
 * @param {string} userId - User ID
 * @param {Date} yesterday - Date object for yesterday
 * @returns {Promise<boolean>} True if user completed at least one task yesterday
 */
async function userCompletedTasksYesterday(userId, yesterday) {
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);
  
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

    // Check for tasks that were completed yesterday (status is "done" and updatedAt is within yesterday)
    // We use updatedAt because that's when the status was changed to "done"
  const completedTasksCount = await Task.countDocuments({
    userId,
    status: "done",
    updatedAt: {
      $gte: startOfYesterday,
      $lte: endOfYesterday,
    },
  });

  return completedTasksCount > 0;
}

/**
 * Check and reset streaks for all users who didn't complete tasks yesterday
 */
async function checkAndResetStreaks() {
  logger.info("🔥 Running daily streak check...");

  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Get all users who have an active streak
    const usersWithStreak = await User.find({
      "gamification.currentStreak": { $gt: 0 },
      "gamification.lastActiveDate": { $exists: true },
    }).select("_id gamification");

    if (usersWithStreak.length === 0) {
      logger.info("   No users with active streaks found");
      return;
    }

    logger.info(`   Checking ${usersWithStreak.length} users with active streaks`);

    let streaksReset = 0;
    let streaksMaintained = 0;

    for (const user of usersWithStreak) {
      const userId = user._id.toString();
      const lastActive = user.gamification?.lastActiveDate;
      
      if (!lastActive) continue;

      // Calculate days since last activity
      const lastActiveDay = new Date(lastActive);
      lastActiveDay.setHours(0, 0, 0, 0);
      
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((today - lastActiveDay) / (1000 * 60 * 60 * 24));

      // If last active was yesterday, check if they completed tasks
      if (diffDays === 1) {
        const completedYesterday = await userCompletedTasksYesterday(userId, yesterday);
        
        if (completedYesterday) {
          // User completed tasks yesterday, streak is maintained
          streaksMaintained++;
          logger.info(`   ✓ User ${userId}: Streak maintained (${user.gamification.currentStreak} days)`);
        } else {
          // User did NOT complete tasks yesterday, reset streak
          user.gamification.currentStreak = 0;
          await user.save();
          streaksReset++;
          logger.info(`   ✗ User ${userId}: Streak reset (no tasks completed yesterday)`);
        }
      } else if (diffDays > 1) {
        // More than one day has passed, definitely reset
        user.gamification.currentStreak = 0;
        await user.save();
        streaksReset++;
        logger.info(`   ✗ User ${userId}: Streak reset (${diffDays} days inactive)`);
      }
      // diffDays === 0 means they were active today, no need to check
    }

    logger.info(`✅ Streak check complete: ${streaksReset} reset, ${streaksMaintained} maintained`);
  } catch (error) {
    logger.error("❌ Error during streak check:", error);
  }
}

/**
 * Start the daily streak checker
 * @param {string} cronExpression - Optional custom cron expression
 */
export function startStreakChecker(cronExpression = DEFAULT_CRON) {
  if (scheduledJob) {
    logger.warn("Streak checker already running");
    return;
  }

  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  logger.info(`🔥 Starting daily streak checker with cron: ${cronExpression}`);

  scheduledJob = cron.schedule(cronExpression, checkAndResetStreaks, {
    timezone: process.env.TZ || "UTC",
  });

  logger.info("✅ Streak checker started");
}

/**
 * Stop the streak checker
 */
export function stopStreakChecker() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    logger.info("🛑 Streak checker stopped");
  }
}

/**
 * Manually trigger a streak check (for testing or API)
 */
export async function triggerStreakCheck() {
  return checkAndResetStreaks();
}

export default {
  startStreakChecker,
  stopStreakChecker,
  triggerStreakCheck,
};
