import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("splitting and recurrence reflection & persistence", async () => {
  const user = await createTestUser("splitrec", "reflect");

  // Preview reflects splitting and recurrence settings
  const res1 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "SplitRec Preview",
      deadline: "tomorrow",
      duration: 240,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      minChunk: 45,
      chunkCount: 4,
      earliestStart: "2026-01-10",
      recurrence: { type: "weekly", interval: 1, count: 4 },
    },
  });
  const widget1 = JSON.parse(res1);
  assert.strictEqual(widget1.data.minChunk, 45);
  assert.strictEqual(widget1.data.chunkCount, 4);
  assert.ok(widget1.data.recurrence && widget1.data.recurrence.type === "weekly");

  // Add persists all settings
  const res2 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "SplitRec Add",
      deadline: "2026-01-30",
      duration: 240,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      minChunk: 60,
      chunkCount: 4,
      earliestStart: "2026-01-10",
      recurrence: { type: "weekly", interval: 1, count: 3 },
    },
  });
  assert.ok(res2.startsWith("ok=true"));
  const id = parseResponseId(res2);
  const task = await Task.findById(id).lean();
  assert.strictEqual(task.minChunk, 60);
  assert.strictEqual(task.chunkCount, 4);
  assert.ok(task.recurrence && task.recurrence.type === "weekly");

  // Preview with fallback values
  const res3 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "SplitRec Preview Neg Min",
      deadline: "tomorrow",
      duration: 240,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      minChunk: -10,
      chunkMinutes: 60,
      minMinutes: 30,
      maxMinutes: 90,
      earliestStart: "2026-01-11",
      recurrence: { type: "weekly", interval: 1, endDate: "2026-02-28" },
    },
  });
  const widget3 = JSON.parse(res3);
  assert.strictEqual(widget3.data.minChunk, 30);
  assert.strictEqual(widget3.data.chunkMinutes, 60);
  assert.strictEqual(widget3.data.minMinutes, 30);
  assert.strictEqual(widget3.data.maxMinutes, 90);
  assert.strictEqual(widget3.data.earliestStart, "2026-01-11");
  assert.ok(widget3.data.recurrence && widget3.data.recurrence.endDate === "2026-02-28");

  // Add with fallback persistence
  const res4 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "SplitRec Add Neg",
      deadline: "2026-01-30",
      duration: 240,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      minChunk: -10,
      chunkMinutes: 90,
      earliestStart: "2026-01-11",
      recurrence: { type: "weekly", interval: 2, endDate: "2026-03-31" },
    },
  });
  assert.ok(res4.startsWith("ok=true"));
  const idB = parseResponseId(res4);
  const taskB = await Task.findById(idB).lean();
  assert.strictEqual(taskB.minChunk, 30);
  assert.strictEqual(taskB.chunkMinutes, 90);
  assert.ok(taskB.recurrence && new Date(taskB.recurrence.endDate).toISOString().startsWith("2026-03-31"));

  // Explicit taskType when canSplit=false
  const res5 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "SplitRec Add NoSplit",
      deadline: "2026-01-27",
      duration: 60,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: false,
      taskType: "in_parts",
    },
  });
  assert.ok(res5.startsWith("ok=true"));
  const idC = parseResponseId(res5);
  const taskC = await Task.findById(idC).lean();
  assert.strictEqual(taskC.canSplit, false);
  assert.strictEqual(taskC.taskType, "in_parts");
});
