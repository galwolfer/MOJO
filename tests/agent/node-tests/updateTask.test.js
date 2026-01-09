import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import addMission from "../../../src/agent/missions/addTask.js";
import updateMission from "../../../src/agent/missions/updateTask.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("update_task confirmation, validation and persistence", async () => {
  const user = await createTestUser("update", "confirm");

  // Add a base task
  const resAdd = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Update Base",
      deadline: "2026-01-20",
      duration: 60,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
      canSplit: true,
      minChunk: 30,
    },
  });
  assert.ok(resAdd.startsWith("ok=true"));
  const id = parseResponseId(resAdd);

  // Test confirmation required
  const res1 = await updateMission.execute({ userId: user._id.toString(), args: { taskId: id, minChunk: 45 } });
  assert.ok(res1.startsWith("ok=false"));
  assert.ok(res1.includes("confirmation_required"));

  // Test invalid date validation
  const res2 = await updateMission.execute({
    userId: user._id.toString(),
    args: { taskId: id, deadline: "not-a-date", confirm: true },
  });
  assert.ok(res2.startsWith("ok=false"));
  assert.ok(res2.includes("Invalid date format"));

  // Test negative value fallback
  await updateMission.execute({ userId: user._id.toString(), args: { taskId: id, minChunk: -10, confirm: true } });
  const t3 = await Task.findById(id).lean();
  assert.strictEqual(t3.minChunk, 30);

  // Test recurrence update
  await updateMission.execute({
    userId: user._id.toString(),
    args: { taskId: id, recurrence: { type: "weekly", endDate: "2026-04-30" }, confirm: true },
  });
  const t4 = await Task.findById(id).lean();
  assert.ok(t4.recurrence && t4.recurrence.endDate);
  assert.ok(new Date(t4.recurrence.endDate).toISOString().startsWith("2026-04-30"));

  // Test task type update
  await updateMission.execute({
    userId: user._id.toString(),
    args: { taskId: id, canSplit: false, taskType: "in_parts", confirm: true },
  });
  const t5 = await Task.findById(id).lean();
  assert.strictEqual(t5.canSplit, false);
  assert.strictEqual(t5.taskType, "in_parts");
});
