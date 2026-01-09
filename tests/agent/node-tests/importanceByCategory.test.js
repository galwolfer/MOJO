import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("importance mapping and fallback behavior", async () => {
  const user = await createTestUser("importance", "map");
  user.profile = user.profile || {};
  user.profile.priorities = user.profile.priorities || {};
  user.profile.priorities.study_and_education = 5;
  await user.save();

  // Preview uses user-defined mapping
  const res1 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Importance Preview",
      deadline: "tomorrow",
      duration: 60,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 2,
    },
  });
  const widget1 = JSON.parse(res1);
  assert.ok(widget1.data);
  assert.strictEqual(widget1.data.importance, 5);

  // Add persists the mapping
  const res2 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Importance Add",
      deadline: "2026-01-25",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
      effort: 3,
    },
  });
  assert.ok(res2.startsWith("ok=true"));
  const id = parseResponseId(res2);
  const task = await Task.findById(id).lean();
  assert.strictEqual(task.importance, 5);

  // Fallback to default when no mapping exists
  user.profile.priorities.study_and_education = undefined;
  await user.save();
  const res3 = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Importance Default",
      deadline: "tomorrow",
      duration: 30,
      category: "study_and_education",
      subcategory: "General Study",
      effort: 2,
    },
  });
  const widget3 = JSON.parse(res3);
  assert.strictEqual(widget3.data.importance, 3);
});
