import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";

const getTasksMission = new LightMission({
  name: "get_tasks",
  group: "task",
  description: "Fetch tasks (filters/search)",
  missionInfo: "Retrieve tasks",
  widgets: ["task_list"],
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

export default getTasksMission;
