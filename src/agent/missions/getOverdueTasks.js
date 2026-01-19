import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { fetchScheduledSessionsByTask, getScheduleWindow } from "./taskScheduleUtils.js";

const getOverdueTasksMission = new LightMission({
  name: "get_overdue_tasks",
  group: "task",
  description: "Return overdue incomplete tasks. Keep message brief - widget shows details.",
  missionInfo: "Late tasks. Write short intro (e.g., 'Here are your overdue tasks:'). Don't repeat details.",
  widgets: ["task_list"],
  schema: z.object({}),
  execute: async ({ userId }) => {
    try {
      const tasks = await taskService.getOverdueTasks(userId);

      if (tasks.length === 0) {
        return `ok=true\ncount=0`;
      }

      const { start, end } = getScheduleWindow(7);
      const scheduledByTaskId = await fetchScheduledSessionsByTask({
        userId,
        taskIds: tasks.map((t) => t._id),
        start,
        end,
      });

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
            effort: t.effort,
            priorityScore: t.priorityScore || 0,
            progressPercentage: t.progressPercentage ?? 0,
            taskType: t.taskType || null,
            subCategory: t.subCategory || null,
            subcategory: t.subCategory ? t.subCategory.label : null,
            category: t.category || null,
            tags: t.tags,
            description: t.description,
            estimatedDuration: t.estimatedDuration,
            canSplit: t.canSplit,
            scheduledSessions: scheduledByTaskId.get(t._id.toString()) || [],
          })),
        },
      };

      // Return widget only (use canonical builder to ensure correct tags/fields)
      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("task_list", { tasks: widgetJson.data.tasks });
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getOverdueTasksMission;
