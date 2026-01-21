import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { fetchScheduledSessionsByTask, getScheduleWindow } from "./taskScheduleUtils.js";
import { buildTaskDetailData } from "./taskPayloads.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";
import { getDisplayName } from "../../config/categories.js";

const getTasksMission = new LightMission({
  name: "get_tasks",
  group: "task",
  description: "Fetch tasks (filters/search). Keep your message brief - widget shows the details.",
  missionInfo:
    "Retrieve tasks. Write short intro before widget (e.g., 'Here are your tasks:'). If only one task found, it shows details. Don't list details in text.",
  widgets: ["task_list", "task_detail"],
  schema: z.object({
    search: z.string().optional().describe("Search query to find tasks by name/title"),
    category: z.string().optional().describe("Filter by category"),
    completed: z.boolean().optional(),
    dueBefore: z.string().optional(),
    dueAfter: z.string().optional(),
  }),
  execute: async ({ userId, args }) => {
    const { search, category, completed, dueBefore, dueAfter } = args;
    try {
      // Build filter object for database query
      const filters = {};
      if (search) filters.taskname = { $regex: search, $options: "i" };
      if (category) filters.category = category;
      if (completed !== undefined) {
        filters.status = completed ? "done" : { $ne: "done" };
      }
      if (dueBefore) filters.dueDate = { ...filters.dueDate, $lte: new Date(dueBefore) };
      if (dueAfter) filters.dueDate = { ...filters.dueDate, $gte: new Date(dueAfter) };

      // Query database with filters (correct service function name)
      const tasks = await taskService.getTasksForUser(userId, filters);

      if (tasks.length === 0) {
        return okTrue({ count: 0 });
      }

      // If exactly one task found, return full details using shared helper
      if (tasks.length === 1) {
        const task = tasks[0];
        const scheduledByTaskId = await fetchScheduledSessionsByTask({
          userId,
          taskIds: [task._id],
          includeSubtasks: true,
        });

        const detail = buildTaskDetailData(task, scheduledByTaskId.get(task._id.toString()) || []);
        const { buildWidgetString } = await import("../widgets/widgetUtils.js");
        return buildWidgetString("task_detail", { task: detail });
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
            categoryDisplay: getDisplayName(t.category),
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
      return okFalse(error.message);
    }
  },
});

export default getTasksMission;
