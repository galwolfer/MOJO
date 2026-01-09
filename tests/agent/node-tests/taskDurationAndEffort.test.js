import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseResponseId } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("duration and effort validations for preview and add", async () => {
  const user = await createTestUser("dur", "validate");

  // preview missing duration
  const res1 = await previewMission.execute({
    args: {
      taskname: "Preview Missing Duration",
      deadline: "tomorrow",
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  assert.ok(res1.startsWith("ok=false"));
  assert.ok(res1.includes("duration_required"));

  // preview with duration but no effort
  const res2 = await previewMission.execute({
    args: {
      taskname: "Preview With Duration",
      deadline: "tomorrow",
      duration: 90,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  assert.ok(res2.startsWith("ok=false"));
  assert.ok(res2.includes("effort_required"));

  // preview with duration and effort
  const res2b = await previewMission.execute({
    args: {
      taskname: "Preview With Duration+Effort",
      deadline: "tomorrow",
      duration: 90,
      effort: 2,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  const w2 = JSON.parse(res2b);
  assert.ok(w2.data);
  assert.strictEqual(w2.data.effort, 2);

  // add missing duration
  const res3 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add Missing Duration",
      deadline: "2026-01-20",
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  assert.ok(res3.startsWith("ok=false"));
  assert.ok(res3.includes("duration_required"));

  // add missing effort
  const res4 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add With Duration",
      deadline: "2026-01-21",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  assert.ok(res4.startsWith("ok=false"));
  assert.ok(res4.includes("effort_required"));

  // add with effort persists
  const res4b = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add With Duration+Effort",
      deadline: "2026-01-22",
      duration: 30,
      effort: 4,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  assert.ok(res4b.startsWith("ok=true"));
  const idB = parseResponseId(res4b);
  const taskB = await Task.findById(idB).lean();
  assert.strictEqual(taskB.effort, 4);
});
