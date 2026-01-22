/**
 * Test script for streak functionality
 * 
 * Tests:
 * 1. New user starts with streak = 0
 * 2. First task completion sets streak = 1
 * 3. Same-day completion doesn't change streak
 * 4. Consecutive day completion increments streak
 * 5. Gap of 2+ days resets streak, but completing task starts new streak at 1
 * 6. getUserStats resets streak when user misses a day
 */

import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { Task } from "../src/models/Task.js";
import { updateUserStreak, awardTaskCompletionPoints } from "../src/controllers/userController.js";
import { triggerStreakCheck } from "../src/services/streakService.js";
import { logger } from "../src/utils/logger.js";

// Helper to create a test user
async function createTestUser(username) {
  const user = await User.create({
    username,
    email: `${username}@test.com`,
    passwordHash: "test123",
    gamification: {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      completedTasks: 0,
    },
  });
  return user;
}

// Helper to create a completed task for a user on a specific date
async function createCompletedTask(userId, username, date) {
  const task = await Task.create({
    userId,
    taskname: `Task for ${username} on ${date.toDateString()}`,
    description: "Test task",
    category: "uncategorized",
    status: "done",
    createdAt: date,
    updatedAt: date,
  });
  return task;
}

// Helper to simulate days passing
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
  return date;
}

async function runTests() {
  console.log("🧪 Starting streak tests...\n");

  try {
    await connectDatabase();

    // Clean up test users
    await User.deleteMany({ username: /^test_streak_/ });
    await Task.deleteMany({ taskname: /^Task for test_streak_/ });

    // =========================================================================
    // TEST 1: New user starts with streak = 0
    // =========================================================================
    console.log("📝 TEST 1: New user starts with streak = 0");
    const user1 = await createTestUser("test_streak_newuser");
    console.log(`  Initial streak: ${user1.gamification.currentStreak}`);
    console.log(user1.gamification.currentStreak === 0 ? "  ✅ PASSED: New user has streak 0\n" : "  ❌ FAILED: New user should have streak 0\n");

    // =========================================================================
    // TEST 2: First task completion sets streak = 1
    // =========================================================================
    console.log("📝 TEST 2: First task completion sets streak = 1");
    const user2 = await createTestUser("test_streak_first");
    console.log(`  Before completion: streak = ${user2.gamification.currentStreak}`);
    
    const mockTask = { _id: "test123", importance: 3, effort: 3 };
    await awardTaskCompletionPoints(user2._id.toString(), mockTask);
    
    const user2After = await User.findById(user2._id);
    console.log(`  After completion: streak = ${user2After.gamification.currentStreak}`);
    console.log(user2After.gamification.currentStreak === 1 ? "  ✅ PASSED: First task sets streak to 1\n" : "  ❌ FAILED: First task should set streak to 1\n");

    // =========================================================================
    // TEST 3: Same-day completion doesn't change streak
    // =========================================================================
    console.log("📝 TEST 3: Same-day completion doesn't change streak");
    const user3 = await createTestUser("test_streak_sameday");
    // Set up: streak = 1, lastActive = today
    user3.gamification.currentStreak = 1;
    user3.gamification.lastActiveDate = new Date();
    await user3.save();
    console.log(`  Before second completion: streak = ${user3.gamification.currentStreak}`);
    
    await updateUserStreak(user3._id.toString(), true);
    
    const user3After = await User.findById(user3._id);
    console.log(`  After second completion: streak = ${user3After.gamification.currentStreak}`);
    console.log(user3After.gamification.currentStreak === 1 ? "  ✅ PASSED: Same-day completion doesn't change streak\n" : "  ❌ FAILED: Same-day should not change streak\n");

    // =========================================================================
    // TEST 4: Consecutive day completion increments streak
    // =========================================================================
    console.log("📝 TEST 4: Consecutive day completion increments streak");
    const user4 = await createTestUser("test_streak_consecutive");
    // Set up: streak = 2, lastActive = yesterday
    user4.gamification.currentStreak = 2;
    user4.gamification.lastActiveDate = daysAgo(1);
    await user4.save();
    console.log(`  Before completion: streak = ${user4.gamification.currentStreak}, lastActive = yesterday`);
    
    await updateUserStreak(user4._id.toString(), true);
    
    const user4After = await User.findById(user4._id);
    console.log(`  After completion: streak = ${user4After.gamification.currentStreak}`);
    console.log(user4After.gamification.currentStreak === 3 ? "  ✅ PASSED: Consecutive day increments streak\n" : "  ❌ FAILED: Should increment to 3\n");

    // =========================================================================
    // TEST 5: Gap of 2+ days resets but completing task starts new streak at 1
    // =========================================================================
    console.log("📝 TEST 5: Gap resets streak, but task completion starts new streak at 1");
    const user5 = await createTestUser("test_streak_gap");
    // Set up: streak = 5, lastActive = 3 days ago
    user5.gamification.currentStreak = 5;
    user5.gamification.lastActiveDate = daysAgo(3);
    await user5.save();
    console.log(`  Before completion: streak = ${user5.gamification.currentStreak}, lastActive = 3 days ago`);
    
    await updateUserStreak(user5._id.toString(), true);
    
    const user5After = await User.findById(user5._id);
    console.log(`  After completion: streak = ${user5After.gamification.currentStreak}`);
    console.log(user5After.gamification.currentStreak === 1 ? "  ✅ PASSED: Gap + completion starts new streak at 1\n" : "  ❌ FAILED: Should start new streak at 1\n");

    // =========================================================================
    // TEST 6: Cron job resets streaks for inactive users
    // =========================================================================
    console.log("📝 TEST 6: Cron job resets streaks for users who missed a day");
    const user6 = await createTestUser("test_streak_cron");
    // Set up: streak = 3, lastActive = 2 days ago (missed yesterday)
    user6.gamification.currentStreak = 3;
    user6.gamification.lastActiveDate = daysAgo(2);
    await user6.save();
    console.log(`  Before cron: streak = ${user6.gamification.currentStreak}, lastActive = 2 days ago`);
    
    await triggerStreakCheck();
    
    const user6After = await User.findById(user6._id);
    console.log(`  After cron: streak = ${user6After.gamification.currentStreak}`);
    console.log(user6After.gamification.currentStreak === 0 ? "  ✅ PASSED: Cron reset streak for inactive user\n" : "  ❌ FAILED: Should reset to 0\n");

    // =========================================================================
    // TEST 7: User with tasks completed yesterday keeps streak
    // =========================================================================
    console.log("📝 TEST 7: User who completed tasks yesterday keeps streak");
    const user7 = await createTestUser("test_streak_active");
    // Set up: streak = 2, lastActive = yesterday
    user7.gamification.currentStreak = 2;
    user7.gamification.lastActiveDate = daysAgo(1);
    await user7.save();
    
    // Create a task completed yesterday
    await createCompletedTask(user7._id, "test_streak_active", daysAgo(1));
    
    console.log(`  Before cron: streak = ${user7.gamification.currentStreak}, completed task yesterday`);
    
    await triggerStreakCheck();
    
    const user7After = await User.findById(user7._id);
    console.log(`  After cron: streak = ${user7After.gamification.currentStreak}`);
    console.log(user7After.gamification.currentStreak === 2 ? "  ✅ PASSED: Active user keeps streak\n" : "  ❌ FAILED: Should keep streak at 2\n");

    // Clean up
    console.log("🧹 Cleaning up test data...");
    await User.deleteMany({ username: /^test_streak_/ });
    await Task.deleteMany({ taskname: /^Task for test_streak_/ });

    console.log("✅ All tests completed!\n");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

runTests();
