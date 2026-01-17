/*
 * File: src/controllers/userController.js
 * Purpose: User profile stats and gamification endpoints
 */

import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { logger } from "../utils/logger.js";

// Ensure gamification subdocument exists on user doc
function ensureGamification(user) {
  if (!user.gamification) {
    user.gamification = {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    };
  }
}

/**
 * Helper: Check and update user streak based on activity
 * Call this when user completes a task or logs in
 */
export async function updateUserStreak(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  ensureGamification(user);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActive = user.gamification?.lastActiveDate;

  if (!lastActive) {
    // First activity ever - keep streak at 0 until first task completion
    user.gamification.lastActiveDate = today;
  } else {
    const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffDays = Math.floor((today - lastActiveDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, no change
    } else if (diffDays === 1) {
      // Consecutive day - increment streak
      user.gamification.currentStreak = (user.gamification.currentStreak || 0) + 1;
      if (user.gamification.currentStreak > (user.gamification.longestStreak || 0)) {
        user.gamification.longestStreak = user.gamification.currentStreak;
      }
      user.gamification.lastActiveDate = today;
    } else {
      // Streak broken - reset to 0 (no active streak)
      user.gamification.currentStreak = 0;
      user.gamification.lastActiveDate = today;
    }
  }

  await user.save();
  return user.gamification;
}

/**
 * Helper: Add points to user
 */
export async function addUserPoints(userId, points) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[addUserPoints] User ${userId} not found`);
      return null;
    }

    ensureGamification(user);

    const oldPoints = user.gamification.points || 0;
    user.gamification.points = oldPoints + points;
    
    const saved = await user.save();
    
    logger.info(`[addUserPoints] User ${userId}: ${oldPoints} + ${points} = ${user.gamification.points}`);
    
    return user.gamification.points;
  } catch (error) {
    logger.error(`[addUserPoints] Error adding points to user ${userId}:`, error);
    return null;
  }
}

/**
 * Get user stats
 * GET /api/user/stats
 * Returns: { tasks, points, streak }
 */
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get user for points and streak
    const user = await User.findById(userId).select("gamification");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    ensureGamification(user);

    // Persist defaults if they were missing
    await user.save();

    // Count completed tasks
    const completedTasks = await Task.countDocuments({
      userId,
      status: "done",
    });

    // Update streak if user is active today
    await updateUserStreak(userId);

    const stats = {
      tasks: completedTasks,
      points: user.gamification?.points || 0,
      streak: user.gamification?.currentStreak || 0,
    };

    return res.json({ success: true, stats });
  } catch (err) {
    console.error("[userController] getUserStats error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Award points for completing a task
 * Called internally when task is marked as done
 */
export async function awardTaskCompletionPoints(userId, task) {
  try {
    // Base points for completing a task
    let points = 10;

    // Bonus for importance
    points += (task.importance || 3) * 2;

    // Bonus for effort
    points += (task.effort || 3) * 2;

    // Bonus for completing before deadline
    if (task.dueDate && new Date() < new Date(task.dueDate)) {
      points += 5;
    }

    logger.info(`[awardTaskCompletionPoints] Task ${task._id} (importance: ${task.importance}, effort: ${task.effort}) = ${points} points`);

    await addUserPoints(userId, points);
    await updateUserStreak(userId);

    return points;
  } catch (error) {
    logger.error(`[awardTaskCompletionPoints] Error awarding points:`, error);
    throw error;
  }
}

export default {
  getUserStats,
  updateUserStreak,
  addUserPoints,
  awardTaskCompletionPoints,
};
