import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";
import { getDisplayName } from "../../config/categories.js";
import { fetchScheduledSessionsByTask } from "./taskScheduleUtils.js";
import { buildTaskDetailData } from "./taskPayloads.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      if (!taskId && !taskname) {
        return `ok=false\nerr="task_identifier_required"`;
      }

      let task = null;

      if (taskId) {
        task = await Task.findOne({ _id: taskId, userId }).lean();
      } else if (taskname) {
        const trimmed = taskname.trim();
        if (!trimmed) return `ok=false\nerr="task_identifier_required"`;

        let candidates = await Task.find({ userId, taskname: trimmed }).lean();

        if (!candidates.length) {
          const exact = new RegExp(`^${escapeRegExp(trimmed)}$`, "i");
          candidates = await Task.find({ userId, taskname: exact }).lean();
        }

        if (!candidates.length) {
          const partial = new RegExp(escapeRegExp(trimmed), "i");
          candidates = await Task.find({ userId, taskname: partial }).lean();
        }

        if (candidates.length > 1) {
          const list = candidates.map((c) => `- ${c.taskname} (${c._id})`).join("\n");
          return `ok=false\nerr="multiple_tasks_found"\nlist="${list}"`;
        }

        task = candidates[0] || null;
      }

      if (!task) {
        return `ok=false\nerr="task_not_found"`;
      }

      const scheduledByTaskId = await fetchScheduledSessionsByTask({
        userId,
        taskIds: [task._id],
        includeSubtasks: true,
      });

      const detail = buildTaskDetailData(task, scheduledByTaskId.get(task._id.toString()) || []);

      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("task_detail", { task: detail });
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getTaskDetailMission;
