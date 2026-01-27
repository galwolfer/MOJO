import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";
import { fetchScheduledSessions, getScheduleWindow } from "./taskScheduleUtils.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

const getUpcomingTasksMission = new LightMission({
  name: "get_upcoming_tasks",
  group: "task",
  description: "Return tasks scheduled within N days. Keep message brief - widget shows details.",
  missionInfo: "Scheduled tasks. Write short intro (e.g., 'Here are your upcoming tasks:'). Don't repeat details.",
  widgets: ["list"],
  schema: z.object({
    days: z.number().optional().default(7),
  }),
  execute: async ({ userId, args }) => {
    const { days = 7 } = args;
    try {
      const { start, end } = getScheduleWindow(days);
      const sessions = await fetchScheduledSessions({ userId, start, end, includeSubtasks: true });

      if (sessions.length === 0) {
        return okTrue({ count: 0 });
      }

      const taskIds = Array.from(new Set(sessions.map((s) => s.taskId).filter(Boolean)));
      const tasks = await Task.find({ _id: { $in: taskIds }, userId }).lean();
      const minimalTasks = tasks.map((t) => ({
        id: t._id?.toString ? t._id.toString() : t._id,
        title: t.taskname,
      }));

      // Return widget only (use canonical builder to ensure correct tags/fields)
      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("list", {
        listType: "upcoming_tasks",
        days,
        tasks: minimalTasks,
      });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getUpcomingTasksMission;
