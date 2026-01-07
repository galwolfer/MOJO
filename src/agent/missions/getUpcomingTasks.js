import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";

const getUpcomingTasksMission = new LightMission({
  name: "get_upcoming_tasks",
  group: "task",
  description: "Return tasks due within N days",
  missionInfo: "Tasks due soon",
  widgets: ["task_list"],
  schema: z.object({
    days: z.number().optional().default(7),
  }),
  execute: async ({ userId, args }) => {
    const { days = 7 } = args;
    try {
      const tasks = await taskService.getUpcomingTasks(userId, days);

      if (tasks.length === 0) {
        return `ok=true\ncount=0`;
      }

      // Construct Widget JSON
      const widgetJson = {
        version: "1.0",
        widget_type: "task_list",
        data: {
          tasks: tasks.map((t) => ({
            id: t._id,
            title: t.taskname,
            status: t.status,
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
            importance: t.importance,
            priorityScore: t.priorityScore || 0,
            taskType: t.taskType || null,
            subCategory: t.subCategory || null,
            tags: t.tags,
            description: t.description,
            estimatedDuration: t.estimatedDuration,
            canSplit: t.canSplit,
          })),
        },
      };

      // Return widget only; LLM should generate the natural message referencing it
      return `<WIDGET_JSON>${JSON.stringify(widgetJson)}</WIDGET_JSON>`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getUpcomingTasksMission;
