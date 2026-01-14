import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";

const getOverdueTasksMission = new LightMission({
  name: "get_overdue_tasks",
  group: "task",
  description: "Return overdue incomplete tasks",
  missionInfo: "Late tasks",
  widgets: ["task_list"],
  schema: z.object({}),
  execute: async ({ userId }) => {
    try {
      const tasks = await taskService.getOverdueTasks(userId);

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

      // Return widget only (use canonical builder to ensure correct tags/fields)
      const { buildWidgetString } = await import("../../widgets/widgetUtils.js");
      return buildWidgetString("task_list", { tasks: widgetJson.data.tasks });
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getOverdueTasksMission;
