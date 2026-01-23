import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser } from "../helpers/testUtils.js";
import getUpcomingTasksMission from "../../../src/agent/missions/getUpcomingTasks.js";
import { Task } from "../../../src/models/Task.js";
import { TaskSchedule } from "../../../src/models/TaskSchedule.js";
import { extractWidgetFromText } from "../../../src/agent/widgets/widgetUtils.js";

setupAgentTests();

function addDays(d, days) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

test("get_upcoming_tasks groups scheduled sessions and returns widget", async () => {
  const user = await createTestUser("upcoming", "mission");

  const due = addDays(new Date(), 1);
  const task = await Task.create({
    userId: user._id,
    taskname: "Tomorrow Session",
    dueDate: due,
    category: "study_and_education",
  });

  // Create a scheduled session for tomorrow
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60000);

  await TaskSchedule.create({ userId: user._id, taskId: task._id, start, end, minutes: 60 });

  const res = await getUpcomingTasksMission.execute({ userId: user._id.toString(), args: { days: 7 } });
  const payload = extractWidgetFromText(res);
  assert.ok(payload, "Expected widget payload");
  // Unified 'list' widget is used for upcoming tasks
  assert.strictEqual(payload.widget_type, "list");
  assert.strictEqual(payload.data.listType, "upcoming_tasks");

  // The unified 'list' widget returns a flat tasks array for upcoming range
  assert.ok(Array.isArray(payload.data.tasks), "Expected tasks array in widget data");
  assert.ok(payload.data.tasks.some((t) => t.id === task._id.toString()), "Scheduled task should appear in upcoming tasks");
});
