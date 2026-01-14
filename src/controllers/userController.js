/*
 * File: src/controllers/userController.js
 * Purpose: User profile stats and gamification endpoints
 */

import { User } from "../models/User.js";
import Task from "../models/Task.js";

/**
 * Helper: Check and update user streak based on activity
 * Call this when user completes a task or logs in
 */
export async function updateUserStreak(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActive = user.gamification?.lastActiveDate;

  if (!lastActive) {
    // First activity ever
    user.gamification.currentStreak = 1;
    user.gamification.longestStreak = 1;
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
      // Streak broken - reset to 1
      user.gamification.currentStreak = 1;
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
  const user = await User.findById(userId);
  if (!user) return null;

  user.gamification.points = (user.gamification.points || 0) + points;
  await user.save();
  return user.gamification.points;
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

  await addUserPoints(userId, points);
  await updateUserStreak(userId);

  return points;
}

export default {
  getUserStats,
  updateUserStreak,
  addUserPoints,
  awardTaskCompletionPoints,
};
