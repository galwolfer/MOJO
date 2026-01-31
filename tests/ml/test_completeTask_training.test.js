/*
 * Test: completeTask should emit structured logs with correct training payload and reward
 * Run: node tests/ml/test_completeTask_training.test.js
 */

import mongoose from "mongoose";
import { User } from "../../src/models/User.js";
import { Task } from "../../src/models/Task.js";
import { TaskSchedule } from "../../src/models/TaskSchedule.js";
import { completeTask } from "../../src/services/taskService.js";
import { calculateReward } from "../../src/utils/mlInputConverter.js";
import { env } from "../../src/config/env.js";

const MONGODB_URI = env.MONGODB_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB for ML training test");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

async function runTest() {
  await connectDB();

  // Intercept console.log to capture structured logs
  const originalLog = console.log;
  const capturedLogs = [];
  
  console.log = function(...args) {
    capturedLogs.push(args.join(' '));
    originalLog.apply(console, args); // Still print to console
  };

  try {
    // Create a test user
    let user = await User.findOne({ email: "mltrainingtest@automated.com" });
    if (!user) {
      user = await User.create({ username: "ML Train Test", email: "mltrainingtest@automated.com", passwordHash: "x" });
    }

    // Clean previous tasks
    await Task.deleteMany({ userId: user._id });
    await TaskSchedule.deleteMany({ userId: user._id });

    // Create a task with an estimate but no dueDate so we use estimation-based reward
    const task = await Task.create({
      userId: user._id,
      taskname: "ML Training Task",
      importance: 3,
      effort: 3,
      estimatedDuration: 60, // minutes
      category: "work_and_career",
    });

    // Create a completed work session (30 minutes)
    await TaskSchedule.create({
      userId: user._id,
      taskId: task._id,
      start: new Date(Date.now() - 30*60*1000),
      end: new Date(),
      minutes: 30,
      status: 'completed'
    });

    // Call completeTask which should trigger training and emit structured logs
    const res = await completeTask({ taskId: task._id, userId: user._id });

    if (!res.success) {
      throw new Error('completeTask failed: ' + res.error);
    }

    // Find the structured logs
    const trainRequestLog = capturedLogs.find(log => log.includes('"event":"ml_train_request"'));
    const trainResultLog = capturedLogs.find(log => log.includes('"event":"ml_train_result"'));

    if (!trainRequestLog) {
      throw new Error('No ml_train_request log found');
    }

    if (!trainResultLog) {
      throw new Error('No ml_train_result log found');
    }

    // Parse the JSON logs
    const trainRequest = JSON.parse(trainRequestLog);
    const trainResult = JSON.parse(trainResultLog);

    // Validate train request payload
    if (!trainRequest.reward) {
      throw new Error('Train request missing reward');
    }

    if (trainRequest.rewardType !== 'estimation') {
      throw new Error(`Expected rewardType 'estimation', got '${trainRequest.rewardType}'`);
    }

    if (!trainRequest.mlInput) {
      throw new Error('Train request missing mlInput');
    }

    // Validate mlInput structure
    const mlInput = trainRequest.mlInput;
    if (mlInput.duration !== task.estimatedDuration) {
      throw new Error(`Expected duration ${task.estimatedDuration}, got ${mlInput.duration}`);
    }

    if (mlInput.motivation !== task.importance) {
      throw new Error(`Expected motivation ${task.importance}, got ${mlInput.motivation}`);
    }

    // Validate reward matches calculateReward (estimation-based)
    const expectedReward = calculateReward(task.estimatedDuration, res.actualCompletionMinutes);
    const diff = Math.abs(expectedReward - trainRequest.reward);
    if (diff > 1e-6) {
      throw new Error(`Reward mismatch: expected ${expectedReward}, got ${trainRequest.reward}`);
    }

    // Validate train result
    if (!trainResult.success) {
      throw new Error(`Training failed: ${trainResult.message}`);
    }

    console.log('\n✅ TEST PASSED: completeTask emitted correct structured logs with proper training payload and reward');
    console.log(`   ✓ Reward calculated correctly: ${trainRequest.reward.toFixed(3)}`);
    console.log(`   ✓ Reward type: ${trainRequest.rewardType}`);
    console.log(`   ✓ ML input includes all required fields`);
    console.log(`   ✓ Training succeeded with return reward: ${trainResult.returnedReward.toFixed(3)}`);

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    throw err;
  } finally {
    // Restore console.log
    console.log = originalLog;
    // Clean up test data (ONLY test user's data)
    const testUser = await User.findOne({ email: "mltrainingtest@automated.com" });
    if (testUser) {
      await Task.deleteMany({ userId: testUser._id });
      await TaskSchedule.deleteMany({ userId: testUser._id });
    }
    // Leave user in DB to reuse
    await mongoose.disconnect();
  }
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});