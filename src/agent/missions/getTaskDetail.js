import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { resolveByIdOrName } from "../lib/taskResolver.js";
import { okFalse } from "../lib/errorFormatter.js";
import { buildWidget } from "../lib/widgetHelper.js";

const getTaskDetailMission = new LightMission({
  name: "get_task_detail",
  group: "task",
  description: "Return detailed information for a single task. Keep message brief - widget shows details.",
  missionInfo: "Task details. If multiple tasks match, ask user to clarify which one.",
  widgets: ["list"],
  schema: z.object({
    taskId: z.string().optional(),
    taskname: z.string().optional().describe("Task title to identify the task when taskId is not provided"),
  }),
  execute: async ({ userId, args }) => {
    const { taskId, taskname } = args;
    try {
      const resolved = await resolveByIdOrName(userId, { taskId, taskname });
      if (resolved.error) {
        if (resolved.error === "multiple_tasks_found") {
          // Present the multiple matches using the Task List widget so the client
          // can show a selectable list instead of raw text.
          const tasks = (resolved.candidates || []).map((c) => ({
            id: c.id,
            title: c.title,
            dueDate: c.dueDate,
            importance: c.importance,
            effort: c.effort,
          }));
          return buildWidget("list", { listType: "task_list", tasks });
        }
        return okFalse(resolved.error);
      }

      const task = resolved.task;
      const id = task._id?.toString ? task._id.toString() : task._id;
      const title = task.taskname;

      return buildWidget("list", {
        listType: "task_detail",
        taskId: id,
        title,
        tasks: [{ id, title }],
      });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getTaskDetailMission;
