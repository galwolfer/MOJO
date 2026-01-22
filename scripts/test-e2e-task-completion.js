/**
 * End-to-end test for task completion API flow
 * Simulates what the frontend does when completing a task
 */

import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { Task } from "../src/models/Task.js";

// Simulate the API endpoints
import * as taskService from "../src/services/taskService.js";
import { awardTaskCompletionPoints, getUserStats } from "../src/controllers/userController.js";

async function runTest() {
  console.log("🧪 End-to-End Task Completion API Test\n");
  
  await connectDatabase();
  
  // Create test user
  const user = await User.create({
    username: "e2e_test_user_" + Date.now(),
    email: `e2e_test_${Date.now()}@test.com`,
    passwordHash: "test123",
    gamification: {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      completedTasks: 0,
    },
  });
  console.log(`✅ Created test user: ${user.username}`);
  
  // Create test task
  const task = await Task.create({
    userId: user._id,
    taskname: "E2E Test Task",
    category: "uncategorized",
    status: "todo",
    importance: 5,
    effort: 4,
  });
  console.log(`✅ Created test task: ${task._id}`);
  
  // Check initial stats
  const mockReq1 = { user: { userId: user._id.toString() } };
  const mockRes1 = {
    json: (data) => { mockRes1.data = data; return mockRes1; },
    status: (code) => { mockRes1.statusCode = code; return mockRes1; },
  };
  await getUserStats(mockReq1, mockRes1);
  console.log("\n📊 INITIAL Stats from API:");
  console.log(`   Points: ${mockRes1.data.stats.points}`);
  console.log(`   Tasks: ${mockRes1.data.stats.tasks}`);
  console.log(`   Streak: ${mockRes1.data.stats.streak}`);
  
  // Simulate POST /tasks/:id/complete
  console.log("\n🎯 Simulating POST /tasks/:id/complete...");
  const completeResult = await taskService.completeTask({ 
    taskId: task._id.toString(), 
    userId: user._id.toString() 
  });
  
  console.log(`   Result: success=${completeResult.success}, wasAlreadyCompleted=${completeResult.wasAlreadyCompleted}`);
  
  if (completeResult.success && !completeResult.wasAlreadyCompleted) {
    console.log("   Awarding points...");
    const reward = await awardTaskCompletionPoints(user._id.toString(), completeResult.task);
    console.log(`   ✅ Awarded ${reward.points} points`);
  }
  
  // Check stats after completion
  const mockReq2 = { user: { userId: user._id.toString() } };
  const mockRes2 = {
    json: (data) => { mockRes2.data = data; return mockRes2; },
    status: (code) => { mockRes2.statusCode = code; return mockRes2; },
  };
  await getUserStats(mockReq2, mockRes2);
  console.log("\n📊 AFTER COMPLETION Stats from API:");
  console.log(`   Points: ${mockRes2.data.stats.points}`);
  console.log(`   Tasks: ${mockRes2.data.stats.tasks}`);
  console.log(`   Streak: ${mockRes2.data.stats.streak}`);
  
  // Validate
  const expectedPoints = 10 + (5 * 2) + (4 * 2); // base + importance + effort = 10 + 10 + 8 = 28
  const passed = 
    mockRes2.data.stats.points === expectedPoints &&
    mockRes2.data.stats.tasks === 1 &&
    mockRes2.data.stats.streak === 1;
  
  console.log(`\n${passed ? "✅" : "❌"} Test ${passed ? "PASSED" : "FAILED"}`);
  if (!passed) {
    console.log(`   Expected: points=${expectedPoints}, tasks=1, streak=1`);
    console.log(`   Got: points=${mockRes2.data.stats.points}, tasks=${mockRes2.data.stats.tasks}, streak=${mockRes2.data.stats.streak}`);
  }
  
  // Test completing same task again (should NOT award points again)
  console.log("\n🔄 Testing: Complete same task again (should NOT award points)...");
  const completeResult2 = await taskService.completeTask({ 
    taskId: task._id.toString(), 
    userId: user._id.toString() 
  });
  console.log(`   wasAlreadyCompleted: ${completeResult2.wasAlreadyCompleted}`);
  
  if (!completeResult2.wasAlreadyCompleted) {
    console.log("   ❌ ERROR: Should have detected task was already completed!");
  } else {
    console.log("   ✅ Correctly detected task was already completed");
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
