/*
 * File: src/controllers/userController.js
 * Purpose: User profile stats and gamification endpoints
 */

import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

// Ensure gamification subdocument exists on user doc
function ensureGamification(user) {
  if (!user.gamification) {
    user.gamification = {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      completedTasks: 0,
      completedSubtasks: 0,
    };
  }
  // Ensure completedTasks field exists for older users
  if (user.gamification.completedTasks === undefined) {
    user.gamification.completedTasks = 0;
  }
  // Ensure completedSubtasks field exists for older users
  if (user.gamification.completedSubtasks === undefined) {
    user.gamification.completedSubtasks = 0;
  }
}

/**
 * Helper: Check and update user streak based on activity
 * Call this when user completes a task or logs in
 * 
 * Streak rules:
 * - First task ever: streak = 1
 * - Same day: no change (already counted today)
 * - Consecutive day (diffDays === 1): increment streak if completing a task
 * - Gap of 2+ days: start new streak at 1 if completing a task, else 0
 */
export async function updateUserStreak(userId, isTaskCompletion = false) {
  const user = await User.findById(userId);
  if (!user) return null;

  ensureGamification(user);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActive = user.gamification?.lastActiveDate;

  if (!lastActive) {
    // First activity ever - start streak at 1 if completing a task
    if (isTaskCompletion) {
      user.gamification.currentStreak = 1;
      user.gamification.longestStreak = 1;
      logger.info(`[updateUserStreak] User ${userId}: First task completed, streak = 1`);
    }
    user.gamification.lastActiveDate = today;
  } else {
    const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffDays = Math.floor((today - lastActiveDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day - no change to streak (already counted today)
      logger.info(`[updateUserStreak] User ${userId}: Same day activity, streak unchanged at ${user.gamification.currentStreak}`);
    } else if (diffDays === 1) {
      // Consecutive day - increment streak only if completing a task
      if (isTaskCompletion) {
        user.gamification.currentStreak = (user.gamification.currentStreak || 0) + 1;
        if (user.gamification.currentStreak > (user.gamification.longestStreak || 0)) {
          user.gamification.longestStreak = user.gamification.currentStreak;
        }
        logger.info(`[updateUserStreak] User ${userId}: Consecutive day, streak incremented to ${user.gamification.currentStreak}`);
      }
      user.gamification.lastActiveDate = today;
    } else {
      // Streak broken (gap of 2+ days) - start new streak if completing a task
      if (isTaskCompletion) {
        user.gamification.currentStreak = 1; // Start fresh streak
        logger.info(`[updateUserStreak] User ${userId}: Streak was broken (${diffDays} days gap), starting new streak at 1`);
      } else {
        user.gamification.currentStreak = 0;
        logger.info(`[updateUserStreak] User ${userId}: Streak broken, reset to 0`);
      }
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

    // Check if streak should be reset based on days since last activity
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActive = user.gamification?.lastActiveDate;

    if (lastActive && user.gamification.currentStreak > 0) {
      const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
      const diffDays = Math.floor((today - lastActiveDay) / (1000 * 60 * 60 * 24));

      logger.info(`[getUserStats] User ${userId}: diffDays=${diffDays}, currentStreak=${user.gamification.currentStreak}`);

      if (diffDays > 1) {
        // More than 1 day gap - streak is definitely broken
        // User missed at least one full day
        logger.info(`[getUserStats] Resetting streak for user ${userId} (${diffDays} days since last activity)`);
        user.gamification.currentStreak = 0;
        await user.save();
      } else if (diffDays === 1) {
        // Exactly 1 day passed - user still has time today to continue streak
        // But we need to check: if lastActive was yesterday and they completed tasks,
        // the streak is valid. If they didn't complete tasks yesterday, streak should reset.
        // 
        // However, if lastActiveDate is yesterday, it means they DID complete a task yesterday
        // (because lastActiveDate is only updated when completing a task).
        // So if we're here with diffDays === 1, the streak is still valid.
        // User has until end of today to complete a task and continue the streak.
        logger.info(`[getUserStats] User ${userId}: streak valid, last active yesterday, has time today to continue`);
      }
      // diffDays === 0 means they were active today, streak is current
    }

    // Persist defaults/changes if they were modified
    await user.save();

    // Return stats directly from user document
    const stats = {
      tasks: user.gamification?.completedTasks || 0,
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
 * 
 * Point calculation:
 * - If task has uncompleted subtasks: award points for each remaining subtask + task completion bonus
 * - If task has no subtasks: award base task points + task completion bonus
 * 
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @param {Array} uncompletedSubtasks - Array of subtasks that weren't completed yet (optional)
 * @returns {Promise<{ points: number, gamification: Object }>}
 */
export async function awardTaskCompletionPoints(userId, task, uncompletedSubtasks = []) {
  try {
    let totalPoints = 0;
    const hasSubtasks = uncompletedSubtasks && uncompletedSubtasks.length > 0;

    if (hasSubtasks) {
      // Award points for each uncompleted subtask that's being completed with the task
      for (const subtask of uncompletedSubtasks) {
        // Base points for subtask
        let subtaskPoints = 3;
        
        // Bonus based on subtask duration (1 point per 15 minutes)
        const minutes = subtask?.minutes || subtask?.duration || 30;
        subtaskPoints += Math.floor(minutes / 15);
        
        // Small bonus from parent task importance/effort
        subtaskPoints += Math.floor((task.importance || 3) / 2);
        subtaskPoints += Math.floor((task.effort || 3) / 2);
        
        totalPoints += subtaskPoints;
        
        // Increment completed subtasks counter for each
        await incrementCompletedSubtasks(userId);
      }
      
      logger.info(`[awardTaskCompletionPoints] Awarded ${totalPoints} points for ${uncompletedSubtasks.length} uncompleted subtasks`);
    } else {
      // No subtasks - award base task points
      // Base points for completing a task
      totalPoints = 10;

      // Bonus based on task duration (1 point per 15 minutes)
      const taskMinutes = task.minMinutes || task.maxMinutes || task.duration || 30;
      totalPoints += Math.floor(taskMinutes / 15);

      // Bonus for importance
      totalPoints += (task.importance || 3) * 2;

      // Bonus for effort
      totalPoints += (task.effort || 3) * 2;

      // Bonus for completing before deadline
      if (task.dueDate && new Date() < new Date(task.dueDate)) {
        totalPoints += 5;
      }
      
      logger.info(`[awardTaskCompletionPoints] Task ${task._id} base points (no subtasks, ${taskMinutes} min) = ${totalPoints}`);
    }

    // TASK COMPLETION BONUS - awarded when entire task is finished
    const completionBonus = calculateTaskCompletionBonus(task);
    totalPoints += completionBonus;
    
    logger.info(`[awardTaskCompletionPoints] Task ${task._id} completion bonus = ${completionBonus}, total = ${totalPoints} points`);

    await addUserPoints(userId, totalPoints);
    await incrementCompletedTasks(userId);
    const updatedGamification = await updateUserStreak(userId, true);

    return { points: totalPoints, bonus: completionBonus, gamification: updatedGamification };
  } catch (error) {
    logger.error(`[awardTaskCompletionPoints] Error awarding points:`, error);
    throw error;
  }
}

/**
 * Calculate the bonus points for completing an entire task
 * This bonus is awarded when all subtasks are done or task is completed directly
 * 
 * @param {Object} task - Task object
 * @returns {number} Bonus points
 */
function calculateTaskCompletionBonus(task) {
  let bonus = 5; // Base completion bonus
  
  // Higher bonus for more important/difficult tasks
  bonus += Math.floor((task.importance || 3) / 2);
  bonus += Math.floor((task.effort || 3) / 2);
  
  // Bonus for completing before deadline
  if (task.dueDate && new Date() < new Date(task.dueDate)) {
    bonus += 3;
  }
  
  return bonus;
}

/**
 * Award only the task completion bonus (used when last subtask completes the task)
 * This avoids double-counting subtask points
 * 
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {Promise<{ points: number, gamification: Object }>}
 */
export async function awardTaskCompletionBonus(userId, task) {
  try {
    const bonus = calculateTaskCompletionBonus(task);
    
    logger.info(`[awardTaskCompletionBonus] Task ${task._id} completion bonus = ${bonus} points`);

    await addUserPoints(userId, bonus);
    await incrementCompletedTasks(userId);
    const updatedGamification = await updateUserStreak(userId, true);

    return { points: bonus, gamification: updatedGamification };
  } catch (error) {
    logger.error(`[awardTaskCompletionBonus] Error awarding bonus:`, error);
    throw error;
  }
}

/**
 * Helper: Increment completed tasks counter
 */
async function incrementCompletedTasks(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[incrementCompletedTasks] User ${userId} not found`);
      return null;
    }

    ensureGamification(user);
    user.gamification.completedTasks = (user.gamification.completedTasks || 0) + 1;
    await user.save();

    logger.info(`[incrementCompletedTasks] User ${userId}: completedTasks = ${user.gamification.completedTasks}`);
    return user.gamification.completedTasks;
  } catch (error) {
    logger.error(`[incrementCompletedTasks] Error:`, error);
    return null;
  }
}

/**
 * Helper: Increment completed subtasks counter
 */
async function incrementCompletedSubtasks(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[incrementCompletedSubtasks] User ${userId} not found`);
      return null;
    }

    ensureGamification(user);
    user.gamification.completedSubtasks = (user.gamification.completedSubtasks || 0) + 1;
    await user.save();

    logger.info(`[incrementCompletedSubtasks] User ${userId}: completedSubtasks = ${user.gamification.completedSubtasks}`);
    return user.gamification.completedSubtasks;
  } catch (error) {
    logger.error(`[incrementCompletedSubtasks] Error:`, error);
    return null;
  }
}

/**
 * Award points for completing a subtask
 * Called internally when subtask is marked as done
 * Subtasks give smaller points than full tasks but still contribute to progress and streaks
 *
 * @param {string} userId - User ID
 * @param {Object} subtask - Subtask object with optional minutes/duration
 * @param {Object} parentTask - Optional parent task for context (importance, effort)
 * @returns {Promise<{ points: number, gamification: Object }>}
 */
export async function awardSubtaskCompletionPoints(userId, subtask, parentTask = null) {
  try {
    // Base points for completing a subtask (smaller than task)
    let points = 3;

    // Bonus based on subtask duration (1 point per 15 minutes)
    const minutes = subtask?.minutes || subtask?.duration || 30;
    points += Math.floor(minutes / 15);

    // Small bonus from parent task importance/effort if available
    if (parentTask) {
      points += Math.floor((parentTask.importance || 3) / 2);
      points += Math.floor((parentTask.effort || 3) / 2);
    }

    logger.info(`[awardSubtaskCompletionPoints] Subtask ${subtask?._id || subtask?.id} (minutes: ${minutes}) = ${points} points`);

    await addUserPoints(userId, points);
    await incrementCompletedSubtasks(userId);
    // Subtask completion also contributes to streak
    const updatedGamification = await updateUserStreak(userId, true);

    return { points, gamification: updatedGamification };
  } catch (error) {
    logger.error(`[awardSubtaskCompletionPoints] Error awarding points:`, error);
    throw error;
  }
}

export default {
  getUserStats,
  updateUserStreak,
  addUserPoints,
  awardTaskCompletionPoints,
  awardTaskCompletionBonus,
  awardSubtaskCompletionPoints,
};
