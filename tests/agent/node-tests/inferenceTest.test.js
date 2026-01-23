import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";
import { TASK_CONFIG } from "../../../src/agent/taskRules.js";

setupAgentTests();

test("splitting fields are intelligently inferred based on taskType and duration", async () => {
  const user = await createTestUser("inference", "splitting");

  // Hebrew homework example: 4 hours (240 min), leaky type
  // LLM picks leaky but doesn't provide minMinutes/maxMinutes
  // System should infer reasonable bounds
  const res1 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "שיעורי בית בחישוביות", // Computer Science Homework
      deadline: "2026-01-12",
      duration: 240, // 4 hours
      category: "study_and_education",
      subcategory: "חישוביות", // Computer Science
      effort: 4,
      importance: 4,
      canSplit: true,
      taskType: "leaky",
      // minMinutes and maxMinutes NOT provided - should be inferred
    },
  });

  const widget1 = JSON.parse(res1);
  assert.strictEqual(widget1.data.taskType, "leaky");
  assert.strictEqual(widget1.data.title, "שיעורי בית בחישוביות");
  assert.strictEqual(widget1.data.estimatedDuration, 240);

  // Check that leaky bounds were inferred (not null)
  assert.ok(widget1.data.minMinutes !== null && widget1.data.minMinutes > 0, "minMinutes should be inferred");
  assert.ok(widget1.data.maxMinutes !== null && widget1.data.maxMinutes > 0, "maxMinutes should be inferred");
  assert.ok(widget1.data.minMinutes < widget1.data.maxMinutes, "minMinutes should be less than maxMinutes");
  // For 240 min leaky: expect minMinutes ≈ 24 (240/10), maxMinutes ≈ 96 (240/2.5)
  assert.ok(widget1.data.minMinutes >= 15 && widget1.data.minMinutes <= 30, "minMinutes should be 15-30");
  assert.ok(widget1.data.maxMinutes >= 80 && widget1.data.maxMinutes <= 120, "maxMinutes should be 80-120");

  // Confirm in_parts fields are null for leaky (minChunk may be null or default)
  assert.ok(widget1.data.minChunk === null || widget1.data.minChunk === TASK_CONFIG.defaults.minChunk, "minChunk should be null or default");
  assert.strictEqual(widget1.data.chunkCount, null);

  // Add persists the inferred leaky bounds
  const res2 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "שיעורי בית בחישוביות",
      deadline: "2026-01-12",
      duration: 240,
      category: "study_and_education",
      subcategory: "חישוביות",
      effort: 4,
      importance: 4,
      canSplit: true,
      taskType: "leaky",
      // minMinutes and maxMinutes NOT provided - will be inferred
    },
  });
  assert.ok(res2.startsWith("ok=true"));
  const id2 = parseResponseId(res2);
  const task2 = await Task.findById(id2).lean();
  assert.strictEqual(task2.taskType, "leaky");
  // Inferred values should be persisted
  assert.ok(task2.minMinutes !== null && task2.minMinutes > 0);
  assert.ok(task2.maxMinutes !== null && task2.maxMinutes > 0);
  assert.ok(task2.minChunk === null || task2.minChunk === TASK_CONFIG.defaults.minChunk);
  assert.strictEqual(task2.chunkCount, null);

  // Test in_parts inference: 120 min duration, should infer chunkCount
  const res3 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "in_parts task auto-chunked",
      deadline: "2026-01-15",
      duration: 120,
      category: "study_and_education",
      subcategory: "General",
      effort: 3,
      canSplit: true,
      taskType: "in_parts",
      // chunkCount NOT provided - should be inferred
    },
  });
  const widget3 = JSON.parse(res3);
  assert.strictEqual(widget3.data.taskType, "in_parts");
  // For 120 min in_parts: should infer chunkCount ≈ 2-3
  assert.ok(widget3.data.chunkCount !== null && widget3.data.chunkCount > 0, "chunkCount should be inferred");
  assert.ok(widget3.data.chunkCount >= 2 && widget3.data.chunkCount <= 5, "chunkCount should be 2-5");
  // Check minChunk is set to default
  assert.ok(widget3.data.minChunk !== null && widget3.data.minChunk > 0);
  // Leaky fields should be null
  assert.strictEqual(widget3.data.minMinutes, null);
  assert.strictEqual(widget3.data.maxMinutes, null);

  // Test perfect task: no splitting fields should be inferred
  const res4 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "perfect task no split",
      deadline: "2026-01-20",
      duration: 45,
      category: "work",
      subcategory: "Meeting",
      effort: 2,
      canSplit: false,
      taskType: "perfect",
    },
  });
  const widget4 = JSON.parse(res4);
  assert.strictEqual(widget4.data.taskType, "perfect");
  assert.strictEqual(widget4.data.minChunk, null);
  assert.strictEqual(widget4.data.chunkCount, null);
  assert.strictEqual(widget4.data.chunkMinutes, null);
  assert.strictEqual(widget4.data.minMinutes, null);
  assert.strictEqual(widget4.data.maxMinutes, null);
});
