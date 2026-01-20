import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { fetchScheduledSessionsByTask } from "./taskScheduleUtils.js";
import { buildTaskDetailData } from "./taskPayloads.js";
import { resolveByIdOrName } from "../lib/taskResolver.js";
import { okFalse } from "../lib/errorFormatter.js";
import { buildWidget } from "../lib/widgetHelper.js";

const getTaskDetailMission = new LightMission({
  name: "get_task_detail",
  group: "task",
  description: "Return detailed information for a single task. Keep message brief - widget shows details.",
  missionInfo: "Task details. If multiple tasks match, ask user to clarify which one.",
  widgets: ["task_detail"],
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
          const list = (resolved.list || []).map((s) => `- ${s}`).join("\n");
          return okFalse("multiple_tasks_found", { list });
        }
        return okFalse(resolved.error);
      }

      const task = resolved.task;

      const scheduledByTaskId = await fetchScheduledSessionsByTask({
        userId,
        taskIds: [task._id],
        includeSubtasks: true,
      });

      const detail = buildTaskDetailData(task, scheduledByTaskId.get(task._id.toString()) || []);

      return buildWidget("task_detail", { task: detail });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getTaskDetailMission;
