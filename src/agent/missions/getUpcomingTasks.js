import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";
import { fetchScheduledSessions, getScheduleWindow, getSessionDateKey } from "./taskScheduleUtils.js";
import { formatLocalDate } from "../../utils/dateUtils.js";

const getUpcomingTasksMission = new LightMission({
  name: "get_upcoming_tasks",
  group: "task",
  description: "Return tasks scheduled within N days. Keep message brief - widget shows details.",
  missionInfo: "Scheduled tasks. Write short intro (e.g., 'Here are your upcoming tasks:'). Don't repeat details.",
  widgets: ["upcoming_tasks"],
  schema: z.object({
    days: z.number().optional().default(7),
  }),
  execute: async ({ userId, args }) => {
    const { days = 7 } = args;
    try {
      const { start, end } = getScheduleWindow(days);
      const sessions = await fetchScheduledSessions({ userId, start, end, includeSubtasks: true });

      if (sessions.length === 0) {
        return `ok=true\ncount=0`;
      }

      const taskIds = Array.from(new Set(sessions.map((s) => s.taskId).filter(Boolean)));
      const tasks = await Task.find({ _id: { $in: taskIds }, userId }).lean();
      const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));

      const groups = new Map();
      for (const session of sessions) {
        if (!session?.taskId) continue;
        const dateKey = getSessionDateKey({ start: session.start });
        if (!dateKey) continue;

        const task = taskMap.get(session.taskId);
        if (!task) continue;

        if (!groups.has(dateKey)) groups.set(dateKey, new Map());
        const groupTasks = groups.get(dateKey);

        if (!groupTasks.has(session.taskId)) {
          groupTasks.set(session.taskId, {
            id: task._id,
            title: task.taskname,
            status: task.status,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
            importance: task.importance,
            effort: task.effort,
            priorityScore: task.priorityScore || 0,
            progressPercentage: task.progressPercentage ?? 0,
            taskType: task.taskType || null,
            subCategory: task.subCategory || null,
            subcategory: task.subCategory ? task.subCategory.label : null,
            category: task.category || null,
            tags: task.tags,
            description: task.description,
            estimatedDuration: task.estimatedDuration,
            canSplit: task.canSplit,
            scheduledSessions: [],
          });
        }

        groupTasks.get(session.taskId).scheduledSessions.push(session);
      }

      const todayKey = formatLocalDate(start);
      const sortedKeys = Array.from(groups.keys()).sort();

      const todayGroup = {
        date: todayKey,
        tasks: groups.has(todayKey) ? Array.from(groups.get(todayKey).values()) : [],
      };

      const upcoming = sortedKeys
        .filter((key) => key !== todayKey)
        .map((key) => ({
          date: key,
          tasks: Array.from(groups.get(key).values()),
        }));

      // Return widget only (use canonical builder to ensure correct tags/fields)
      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("upcoming_tasks", { days, today: todayGroup, upcoming });
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getUpcomingTasksMission;
