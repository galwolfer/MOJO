import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";
import { User } from "../../../src/models/User.js";

setupAgentTests();

test("category priority is applied when LLM doesn't provide importance", async () => {
  const user = await createTestUser("catprio", "fix");

  // Set user's category priority: study_and_education = 5
  await User.findByIdAndUpdate(user._id, {
    $set: { "profile.priorities.study_and_education": 5 },
  });

  // LLM creates task in study_and_education WITHOUT providing importance
  // System should use category priority (5) instead of default (3)
  const res1 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Hebrew Homework",
      deadline: "2026-01-12",
      duration: 240,
      category: "study_and_education",
      subcategory: "Language",
      effort: 4,
      // importance NOT provided - should use category priority of 5
    },
  });

  const widget1 = JSON.parse(res1);
  assert.strictEqual(widget1.data.importance, 5, "Preview should use category priority of 5");
  assert.strictEqual(widget1.data.category, "study_and_education");

  // Add task without importance - should also use category priority
  const res2 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Math Homework",
      deadline: "2026-01-15",
      duration: 180,
      category: "study_and_education",
      subcategory: "Math",
      effort: 3,
      // importance NOT provided - should use category priority of 5
    },
  });

  assert.ok(res2.startsWith("ok=true"));
  const taskId = parseResponseId(res2);
  const task = await Task.findById(taskId).lean();
  assert.strictEqual(task.importance, 5, "Created task should have importance 5 from category priority");
  assert.strictEqual(task.category, "study_and_education");

  // Override: LLM provides importance explicitly - should use that instead of category priority
  const res3 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Quick Quiz",
      deadline: "2026-01-20",
      duration: 30,
      category: "study_and_education",
      subcategory: "Quick Check",
      effort: 1,
      importance: 2, // Explicit override - should use this, not category priority of 5
    },
  });

  assert.ok(res3.startsWith("ok=true"));
  const taskId3 = parseResponseId(res3);
  const task3 = await Task.findById(taskId3).lean();
  assert.strictEqual(task3.importance, 2, "Explicit importance should override category priority");

  // Different category: work_and_career with priority 3
  await User.findByIdAndUpdate(user._id, {
    $set: { "profile.priorities.work_and_career": 3 },
  });

  const res4 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Work Task",
      deadline: "2026-01-18",
      duration: 120,
      category: "work_and_career",
      subcategory: "Project",
      effort: 2,
      // importance NOT provided - should use category priority of 3
    },
  });

  assert.ok(res4.startsWith("ok=true"), `Expected res4 to start with "ok=true" but got: ${res4}`);
  const taskId4 = parseResponseId(res4);
  const task4 = await Task.findById(taskId4).lean();
  assert.strictEqual(task4.importance, 3, "Work task should have importance 3 from its category priority");
});
