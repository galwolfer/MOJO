import { connectDB, disconnectDB, clearDatabase } from "../../setup/connectDB.js";
import { createTestUser } from "../helpers/testUtils.js";
import getUpcomingTasksMission from "../../../src/agent/missions/getUpcomingTasks.js";
import { Task } from "../../../src/models/Task.js";
import { TaskSchedule } from "../../../src/models/TaskSchedule.js";

(async function () {
  await connectDB();
  try {
    await clearDatabase();

    const user = await createTestUser("upcoming", "mission");
    const due = new Date();
    due.setDate(due.getDate() + 1);
    const task = await Task.create({
      userId: user._id,
      taskname: "Tomorrow Session",
      dueDate: due,
      category: "study_and_education",
    });

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    await TaskSchedule.create({ userId: user._id, taskId: task._id, start, end, minutes: 60 });

    const res = await getUpcomingTasksMission.execute({ userId: user._id.toString(), args: { days: 7 } });
    console.log("upcoming res:", res);
  } catch (err) {
    console.error("DEBUG ERROR", err);
  } finally {
    await clearDatabase();
    await disconnectDB();
  }
})();
