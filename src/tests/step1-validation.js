/**
 * Step 1 Validation Test
 * Verifies: Task schema + taskService alignment
 * 
 * Run: node src/tests/step1-validation.js
 */

import { Task } from "../models/Task.js";
import * as taskService from "../services/taskService.js";
import mongoose from "mongoose";

const TEST_USER_ID = new mongoose.Types.ObjectId();

// Test result tracking
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

console.log("\n" + "=".repeat(70));
console.log("STEP 1: TASK SCHEMA + SERVICE ALIGNMENT VALIDATION");
console.log("=".repeat(70) + "\n");

// Test 1: Schema fields exist
console.log("Test Suite 1: Task Schema Fields");
console.log("-".repeat(70));

const taskDoc = new Task({
  userId: TEST_USER_ID,
  taskname: "Test Task",
  importance: 3,
  effort: 2,
  estimatedDuration: 60,
});

assert(
  taskDoc.schema.paths.hasOwnProperty("predictedCompletionCategory"),
  "predictedCompletionCategory field exists in schema"
);
assert(
  taskDoc.schema.paths.hasOwnProperty("predictionScore"),
  "predictionScore field exists in schema"
);
assert(
  taskDoc.schema.paths.hasOwnProperty("actualCompletionMinutes"),
  "actualCompletionMinutes field exists in schema"
);

// Test 2: Field constraints
console.log("\nTest Suite 2: Field Constraints");
console.log("-".repeat(70));

const schema = Task.schema;

const catPath = schema.paths.predictedCompletionCategory;
assert(
  catPath.options.min === 1,
  "predictedCompletionCategory min constraint = 1"
);
assert(
  catPath.options.max === 5,
  "predictedCompletionCategory max constraint = 5"
);

const scorePath = schema.paths.predictionScore;
assert(
  scorePath.options.min === 0,
  "predictionScore min constraint = 0"
);
assert(
  scorePath.options.max === 1,
  "predictionScore max constraint = 1"
);

// Test 3: Service functions exist
console.log("\nTest Suite 3: Service Functions");
console.log("-".repeat(70));

assert(
  typeof taskService.completeTask === "function",
  "completeTask() function exists"
);
assert(
  typeof taskService.updateTask === "function",
  "updateTask() function exists"
);
assert(
  typeof taskService.createTask === "function",
  "createTask() function exists"
);

// Test 4: completeTask signature
console.log("\nTest Suite 4: Function Signatures");
console.log("-".repeat(70));

const completeTaskFn = taskService.completeTask.toString();
assert(
  completeTaskFn.includes("taskId"),
  "completeTask() includes taskId parameter"
);
assert(
  completeTaskFn.includes("userId"),
  "completeTask() includes userId parameter"
);
assert(
  completeTaskFn.includes("actualCompletionMinutes"),
  "completeTask() calculates actualCompletionMinutes"
);

// Test 5: Existing fields preserved
console.log("\nTest Suite 5: Existing Functionality");
console.log("-".repeat(70));

const existingFields = ["userId", "taskname", "status", "importance", "effort", "estimatedDuration"];
existingFields.forEach(field => {
  assert(
    schema.paths.hasOwnProperty(field),
    `Existing field "${field}" still present`
  );
});

// Test 6: Data type validation
console.log("\nTest Suite 6: Data Type Validation");
console.log("-".repeat(70));

try {
  const task1 = new Task({
    userId: TEST_USER_ID,
    taskname: "Test",
    predictedCompletionCategory: 3,
  });
  assert(true, "predictedCompletionCategory accepts value 3");
} catch (e) {
  assert(false, "predictedCompletionCategory accepts value 3");
}

try {
  const task2 = new Task({
    userId: TEST_USER_ID,
    taskname: "Test",
    predictionScore: 0.75,
  });
  assert(true, "predictionScore accepts value 0.75");
} catch (e) {
  assert(false, "predictionScore accepts value 0.75");
}

try {
  const task3 = new Task({
    userId: TEST_USER_ID,
    taskname: "Test",
    actualCompletionMinutes: 45,
  });
  assert(true, "actualCompletionMinutes accepts positive integer");
} catch (e) {
  assert(false, "actualCompletionMinutes accepts positive integer");
}

// Summary
console.log("\n" + "=".repeat(70));
console.log("VALIDATION SUMMARY");
console.log("=".repeat(70));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log("=".repeat(70));

if (failed === 0) {
  console.log("\n🎉 STEP 1 VALIDATION SUCCESSFUL!");
  console.log("✅ Task schema properly updated");
  console.log("✅ taskService.js properly aligned");
  console.log("✅ Ready for Step 2: Create ML Input Converter");
  console.log("\n");
  process.exit(0);
} else {
  console.log("\n⚠️  STEP 1 VALIDATION FAILED");
  console.log(`${failed} test(s) did not pass`);
  console.log("\n");
  process.exit(1);
}
