import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser } from "../helpers/testUtils.js";
import getTasksMission from "../../../src/agent/missions/getTasks.js";
import { Task } from "../../../src/models/Task.js";
import { extractWidgetFromText } from "../../../src/agent/widgets/widgetUtils.js";
import { getDisplayName } from "../../../src/config/categories.js";

setupAgentTests();

test("get_tasks returns task_list widget and supports search and single-task detail", async () => {
  const user = await createTestUser("gettasks", "mission");

  // Create two tasks
  const t1 = await Task.create({
    userId: user._id,
    taskname: "ML Homework",
    dueDate: new Date("2026-01-25"),
    category: "study_and_education",
    subCategory: { label: "Machine Learning", source: "user" },
  });

  const t2 = await Task.create({
    userId: user._id,
    taskname: "Groceries",
    dueDate: new Date("2026-01-19"),
    category: "home_and_chores",
  });

  // Call mission without filters - expect task_list with two tasks
  const res = await getTasksMission.execute({ userId: user._id.toString(), args: {} });
  const payload = extractWidgetFromText(res);
  assert.ok(payload, "Expected widget payload");
  assert.strictEqual(payload.widget_type, "task_list");
  assert.strictEqual(payload.data.tasks.length, 2);

  // Search for ML should return single detail widget
  const resSearch = await getTasksMission.execute({ userId: user._id.toString(), args: { search: "ML" } });
  const payloadSearch = extractWidgetFromText(resSearch);
  // For single task the mission returns a task_detail widget
  assert.ok(payloadSearch, "Expected widget payload for search");
  assert.strictEqual(payloadSearch.widget_type, "task_detail");
  const task = payloadSearch.data.task;
  assert.strictEqual(task.id, t1._id.toString());
  assert.strictEqual(task.categoryDisplay, getDisplayName(t1.category));
});
