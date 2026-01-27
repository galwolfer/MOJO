import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

const getTasksMission = new LightMission({
  name: "get_tasks",
  group: "task",
  description: "Fetch tasks (filters/search). Keep your message brief - widget shows the details.",
  missionInfo:
    "Retrieve tasks. Write short intro before widget (e.g., 'Here are your tasks:'). If only one task found, it shows details. Don't list details in text.",
  widgets: ["list"],
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
      const filterPayload = {};
      if (search) filters.taskname = { $regex: search, $options: "i" };
      if (search) filterPayload.search = search;
      if (category) {
        filters.category = category;
        filterPayload.category = category;
      }
      if (completed !== undefined) {
        filters.status = completed ? "done" : { $ne: "done" };
        filterPayload.completed = completed;
      }
      if (dueBefore) {
        filters.dueDate = { ...filters.dueDate, $lte: new Date(dueBefore) };
        filterPayload.dueBefore = dueBefore;
      }
      if (dueAfter) {
        filters.dueDate = { ...filters.dueDate, $gte: new Date(dueAfter) };
        filterPayload.dueAfter = dueAfter;
      }

      // Query database with filters (correct service function name)
      const tasks = await taskService.getTasksForUser(userId, filters);

      if (tasks.length === 0) {
        return okTrue({ count: 0 });
      }

      const minimalTasks = tasks.map((t) => ({
        id: t._id?.toString ? t._id.toString() : t._id,
        title: t.taskname,
      }));

      const listType = tasks.length === 1 ? "task_detail" : "task_list";
      const widgetData = {
        listType,
        tasks: minimalTasks,
        filters: Object.keys(filterPayload).length > 0 ? filterPayload : null,
      };

      if (listType === "task_detail") {
        widgetData.taskId = minimalTasks[0]?.id || null;
        widgetData.title = minimalTasks[0]?.title || null;
      }

      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("list", widgetData);
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getTasksMission;
