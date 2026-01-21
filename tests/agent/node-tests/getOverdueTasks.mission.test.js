import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser } from "../helpers/testUtils.js";
import getOverdueTasksMission from "../../../src/agent/missions/getOverdueTasks.js";
import { Task } from "../../../src/models/Task.js";
import { extractWidgetFromText } from "../../../src/agent/widgets/widgetUtils.js";

setupAgentTests();

test("get_overdue_tasks returns overdue tasks in widget", async () => {
  const user = await createTestUser("overdue", "mission");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const task = await Task.create({
    userId: user._id,
    taskname: "Past Due",
    dueDate: yesterday,
    category: "study_and_education",
    status: "todo",
  });

  const res = await getOverdueTasksMission.execute({ userId: user._id.toString(), args: {} });
  const payload = extractWidgetFromText(res);
  assert.ok(payload, "Expected widget payload");
  assert.strictEqual(payload.widget_type, "task_list");
  assert.strictEqual(payload.data.tasks.length, 1);
  assert.strictEqual(payload.data.tasks[0].id, task._id.toString());
});
