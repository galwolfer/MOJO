/**
 * Test script to verify gamification flow end-to-end
 * Tests: task completion -> points, completedTasks, streak updates
 */

import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { Task } from "../src/models/Task.js";
import { awardTaskCompletionPoints } from "../src/controllers/userController.js";

async function runTest() {
  console.log("🧪 Testing Gamification Flow...\n");
  
  await connectDatabase();
  
  // Find or create test user
  let user = await User.findOne({ username: "gamification_test_user" });
  if (!user) {
    user = await User.create({
      username: "gamification_test_user",
      email: "gamification_test@test.com",
      passwordHash: "test123",
      gamification: {
        points: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedTasks: 0,
      },
    });
    console.log("✅ Created test user");
  } else {
    // Reset gamification for clean test
    user.gamification = {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      completedTasks: 0,
    };
    await user.save();
    console.log("✅ Reset existing test user");
  }
  
  console.log("\n📊 BEFORE task completion:");
  console.log(`   Points: ${user.gamification.points}`);
  console.log(`   Completed Tasks: ${user.gamification.completedTasks}`);
  console.log(`   Streak: ${user.gamification.currentStreak}`);
  
  // Create a test task
  const task = await Task.create({
    userId: user._id,
    taskname: "Test Task for Gamification",
    category: "uncategorized",
    status: "todo",
    importance: 4,
    effort: 3,
  });
  console.log(`\n✅ Created test task: ${task.taskname} (importance: ${task.importance}, effort: ${task.effort})`);
  
  // Simulate task completion by calling awardTaskCompletionPoints directly
  console.log("\n🎯 Calling awardTaskCompletionPoints...");
  try {
    const reward = await awardTaskCompletionPoints(user._id.toString(), task);
    console.log(`✅ Reward returned: ${reward.points} points`);
    console.log(`   Gamification from response:`, reward.gamification);
  } catch (error) {
    console.error("❌ Error calling awardTaskCompletionPoints:", error);
  }
  
  // Reload user and check
  const updatedUser = await User.findById(user._id);
  console.log("\n📊 AFTER task completion:");
  console.log(`   Points: ${updatedUser.gamification.points}`);
  console.log(`   Completed Tasks: ${updatedUser.gamification.completedTasks}`);
  console.log(`   Streak: ${updatedUser.gamification.currentStreak}`);
  console.log(`   Last Active: ${updatedUser.gamification.lastActiveDate}`);
  
  // Validate
  const expectedPoints = 10 + (4 * 2) + (3 * 2); // base + importance bonus + effort bonus = 10 + 8 + 6 = 24
  const passed = 
    updatedUser.gamification.points === expectedPoints &&
    updatedUser.gamification.completedTasks === 1 &&
    updatedUser.gamification.currentStreak === 1;
  
  console.log(`\n${passed ? "✅" : "❌"} Test ${passed ? "PASSED" : "FAILED"}`);
  if (!passed) {
    console.log(`   Expected: points=${expectedPoints}, completedTasks=1, streak=1`);
    console.log(`   Got: points=${updatedUser.gamification.points}, completedTasks=${updatedUser.gamification.completedTasks}, streak=${updatedUser.gamification.currentStreak}`);
  }
  
  // Cleanup
  await Task.deleteOne({ _id: task._id });
  await User.deleteOne({ _id: user._id });
  console.log("\n🧹 Cleaned up test data");
  
  await disconnectDatabase();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
