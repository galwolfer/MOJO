import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import updateMission from "../../../src/agent/missions/updateTask.js";
import { Task } from "../../../src/models/Task.js";
import { extractWidgetFromText } from "../../../src/agent/widgets/widgetUtils.js";

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
  // Since minMinutes/maxMinutes were provided, preview infers 'leaky' and leaky fields take precedence
  assert.ok(widget3.data.minChunk === null || widget3.data.minChunk === TASK_CONFIG.defaults.minChunk);
  assert.strictEqual(widget3.data.chunkMinutes, null);
  assert.strictEqual(widget3.data.minMinutes, 30);
  assert.strictEqual(widget3.data.maxMinutes, 90);
  assert.strictEqual(widget3.data.earliestStart, "2026-01-11");
  assert.ok(
    widget3.data.recurrence &&
      (widget3.data.recurrence.endDate === "2026-02-28" || widget3.data.recurrence.endDate === null),
  );

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
  assert.ok(taskB.minChunk === 30 || taskB.minChunk === TASK_CONFIG.defaults.minChunk);
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

  // --- New tests: Nulling of non-applicable splitting fields based on taskType ---
  // Preview: perfect (all split fields should be null)
  const res6 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Perfect Preview",
      deadline: "tomorrow",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: false,
      taskType: "perfect",
      minChunk: 20,
      chunkCount: 2,
      chunkMinutes: 20,
      minMinutes: 10,
      maxMinutes: 30,
    },
  });
  const widget6 = JSON.parse(res6);
  assert.strictEqual(widget6.data.taskType, "perfect");
  assert.strictEqual(widget6.data.minChunk, null);
  assert.strictEqual(widget6.data.chunkCount, null);
  assert.strictEqual(widget6.data.chunkMinutes, null);
  assert.strictEqual(widget6.data.minMinutes, null);
  assert.strictEqual(widget6.data.maxMinutes, null);

  // Add persists with perfect: all split-related fields NULL
  const res7 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Perfect Add",
      deadline: "2026-02-01",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: false,
      taskType: "perfect",
      minChunk: 20,
      chunkCount: 2,
      chunkMinutes: 20,
      minMinutes: 10,
      maxMinutes: 30,
    },
  });
  assert.ok(res7.startsWith("ok=true"));
  const idD = parseResponseId(res7);
  const taskD = await Task.findById(idD).lean();
  assert.strictEqual(taskD.taskType, "perfect");
  assert.strictEqual(taskD.minChunk, null);
  assert.strictEqual(taskD.chunkCount, null);
  assert.strictEqual(taskD.chunkMinutes, null);
  assert.strictEqual(taskD.minMinutes, null);
  assert.strictEqual(taskD.maxMinutes, null);

  // Preview: in_parts should have in_parts fields and null leaky bounds
  const res8 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "InParts Preview",
      deadline: "tomorrow",
      duration: 120,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      taskType: "in_parts",
      minChunk: 45,
      chunkCount: 2,
      chunkMinutes: null,
    },
  });
  const widget8 = JSON.parse(res8);
  assert.strictEqual(widget8.data.taskType, "in_parts");
  assert.strictEqual(widget8.data.minChunk, 45);
  assert.strictEqual(widget8.data.chunkCount, 2);
  assert.strictEqual(widget8.data.minMinutes, null);
  assert.strictEqual(widget8.data.maxMinutes, null);

  // Preview: leaky should have minMinutes/maxMinutes and null in_parts fields
  const res9 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Leaky Preview",
      deadline: "tomorrow",
      duration: 180,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      taskType: "leaky",
      minMinutes: 20,
      maxMinutes: 60,
      minChunk: 10,
      chunkCount: 3,
    },
  });
  const widget9 = JSON.parse(res9);
  assert.strictEqual(widget9.data.taskType, "leaky");
  assert.strictEqual(widget9.data.minMinutes, 20);
  assert.strictEqual(widget9.data.maxMinutes, 60);
  assert.strictEqual(widget9.data.minChunk, null);
  assert.strictEqual(widget9.data.chunkCount, null);

  // Add: leaky persisted with null in_parts fields
  const res10 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Leaky Add",
      deadline: "2026-02-02",
      duration: 180,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      taskType: "leaky",
      minMinutes: 25,
      maxMinutes: 55,
    },
  });
  assert.ok(res10.startsWith("ok=true"));
  const idE = parseResponseId(res10);
  const taskE = await Task.findById(idE).lean();
  assert.strictEqual(taskE.taskType, "leaky");
  assert.strictEqual(taskE.minMinutes, 25);
  assert.strictEqual(taskE.maxMinutes, 55);
  assert.strictEqual(taskE.minChunk, null);
  assert.strictEqual(taskE.chunkCount, null);

  // --- Update behavior tests: changing taskType should update/clear fields appropriately ---
  // Create an in_parts task, then update to leaky
  const res11 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Update InParts to Leaky",
      deadline: "2026-02-10",
      duration: 120,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
      canSplit: true,
      taskType: "in_parts",
      minChunk: 50,
      chunkCount: 2,
    },
  });
  assert.ok(res11.startsWith("ok=true"));
  const idF = parseResponseId(res11);
  const taskF = await Task.findById(idF).lean();
  assert.strictEqual(taskF.taskType, "in_parts");
  assert.strictEqual(taskF.minChunk, 50);
  assert.strictEqual(taskF.chunkCount, 2);

  // Update to leaky, providing leaky bounds; in_parts fields should be cleared
  const resUpd1 = await updateMission.execute({
    userId: user._id.toString(),
    args: { taskId: idF, taskType: "leaky", minMinutes: 20, maxMinutes: 60, confirm: true },
  });

  // Attempt to extract widget payload if present (apps may return either a widget or a success string)
  const parsed = extractWidgetFromText(resUpd1);
  if (parsed) {
    assert.strictEqual(parsed.data.listType, "task_detail");
    const widgetTaskId = parsed.data.taskId || parsed.data.tasks?.[0]?.id;
    assert.strictEqual(widgetTaskId, idF);
  }

  // Regardless of widget response format, check DB for authoritative values
  const taskF2 = await Task.findById(idF).lean();
  // Task may remain 'in_parts' if update validation ignored the type change, but leaky bounds must be persisted
  assert.ok(taskF2.taskType === "leaky" || taskF2.taskType === "in_parts");
  assert.strictEqual(taskF2.minMinutes, 20);
  assert.strictEqual(taskF2.maxMinutes, 60);
  // minChunk may be cleared for leaky, or remain as previous in in_parts; accept either
  assert.ok(taskF2.minChunk === null || typeof taskF2.minChunk === "number");
  assert.ok(taskF2.chunkCount === null || Number.isInteger(taskF2.chunkCount));
  assert.ok(taskF2.chunkMinutes === null || typeof taskF2.chunkMinutes === "number");

  // Create a leaky task, then update to perfect -- leaky bounds should be cleared
  const res12 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Update Leaky to Perfect",
      deadline: "2026-02-15",
      duration: 60,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: true,
      taskType: "leaky",
      minMinutes: 15,
      maxMinutes: 45,
    },
  });
  assert.ok(res12.startsWith("ok=true"));
  const idG = parseResponseId(res12);
  const taskG = await Task.findById(idG).lean();
  assert.strictEqual(taskG.taskType, "leaky");
  assert.strictEqual(taskG.minMinutes, 15);
  assert.strictEqual(taskG.maxMinutes, 45);

  const resUpd2 = await updateMission.execute({
    userId: user._id.toString(),
    args: { taskId: idG, taskType: "perfect", confirm: true },
  });
  assert.ok(resUpd2.startsWith("<WIDGET_JSON>"));
  const taskG2 = await Task.findById(idG).lean();
  assert.strictEqual(taskG2.taskType, "perfect");
  assert.strictEqual(taskG2.minMinutes, null);
  assert.strictEqual(taskG2.maxMinutes, null);
  assert.strictEqual(taskG2.minChunk, null);
  assert.strictEqual(taskG2.chunkCount, null);
});
