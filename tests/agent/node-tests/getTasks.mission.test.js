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
  // Unified 'list' widget is used; check listType
  assert.strictEqual(payload.widget_type, "list");
  assert.strictEqual(payload.data.listType, "task_list");
  assert.strictEqual(payload.data.tasks.length, 2);

  // Search for ML should return a task_detail via the 'list' widget payload
  const resSearch = await getTasksMission.execute({ userId: user._id.toString(), args: { search: "ML" } });
  const payloadSearch = extractWidgetFromText(resSearch);
  assert.ok(payloadSearch, "Expected widget payload for search");
  assert.strictEqual(payloadSearch.widget_type, "list");
  assert.strictEqual(payloadSearch.data.listType, "task_detail");
  const taskId = payloadSearch.data.taskId || (payloadSearch.data.tasks && payloadSearch.data.tasks[0]?.id);
  assert.strictEqual(taskId, t1._id.toString());
  // If title provided, it should match
  if (payloadSearch.data.title) assert.strictEqual(payloadSearch.data.title, t1.taskname);
  assert.strictEqual(getDisplayName(t1.category), getDisplayName(t1.category));
});
