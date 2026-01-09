import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("taskType inference and explicit persistence", async () => {
  const user = await createTestUser("split", "strategy");

  // canSplit true -> in_parts
  const res1 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Preview",
      deadline: "tomorrow",
      duration: 60,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: true,
    },
  });
  const widget1 = JSON.parse(res1);
  assert.strictEqual(widget1.data.taskType, "in_parts");

  // Add preserves in_parts
  const res2 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Add",
      deadline: "2026-01-26",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
    },
  });
  assert.ok(res2.startsWith("ok=true"));
  const id2 = parseResponseId(res2);
  const task2 = await Task.findById(id2).lean();
  assert.strictEqual(task2.taskType, "in_parts");

  // canSplit false -> perfect
  const res3 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Preview NoSplit",
      deadline: "tomorrow",
      duration: 20,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 1,
      canSplit: false,
    },
  });
  const widget3 = JSON.parse(res3);
  assert.strictEqual(widget3.data.taskType, "perfect");

  const res4 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Add NoSplit",
      deadline: "2026-02-01",
      duration: 15,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 1,
      canSplit: false,
    },
  });
  assert.ok(res4.startsWith("ok=true"));
  const id4 = parseResponseId(res4);
  const task4 = await Task.findById(id4).lean();
  assert.strictEqual(task4.taskType, "perfect");

  // Explicit taskType override
  const res5 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Preview Leaky",
      deadline: "tomorrow",
      duration: 120,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 4,
      canSplit: true,
      taskType: "leaky",
    },
  });
  const widget5 = JSON.parse(res5);
  assert.strictEqual(widget5.data.taskType, "leaky");

  const res6 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Split Add Leaky",
      deadline: "2026-03-01",
      duration: 90,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 4,
      canSplit: true,
      taskType: "leaky",
      minMinutes: 20,
      maxMinutes: 60,
      // If caller mistakenly includes in_parts fields, they should be cleared
      chunkCount: 3,
      chunkMinutes: 15,
    },
  });
  assert.ok(res6.startsWith("ok=true"));
  const id6 = parseResponseId(res6);
  const task6 = await Task.findById(id6).lean();
  assert.strictEqual(task6.taskType, "leaky");
  assert.strictEqual(task6.minMinutes, 20);
  assert.strictEqual(task6.maxMinutes, 60);
  assert.strictEqual(task6.chunkCount, null);
  assert.strictEqual(task6.chunkMinutes, null);
});
