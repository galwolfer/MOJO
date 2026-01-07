import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";

const updateTaskMission = new GuidedMission({
  name: "update_task",
  group: "task",
  description:
    "Update a task; requires confirm=true. Accepts: taskname, category, tags, importance, effort, estimatedDuration, canSplit, taskType, deadline, completed.",
  missionInfo: "Modify task",
  behavior: ["Require confirm=true before applying updates."],
  widgets: ["task_detail"],
  schema: z.object({
    taskId: z.string().optional(),
    taskname: z.string().optional().describe("Task title to identify task when taskId is not provided"),
    tags: z.array(z.string()).optional().describe("Replace tags or provide new tags array"),
    importance: z.number().min(1).max(5).optional().describe("Importance 1-5"),
    effort: z.number().min(1).max(5).optional().describe("Effort 1-5"),
    estimatedDuration: z.number().optional().describe("Estimated minutes"),
    canSplit: z.boolean().optional().describe("Can be split?"),
    taskType: z.string().optional().describe("Task splitting strategy"),
    deadline: z.string().optional(),
    completed: z.boolean().optional(),
    confirm: z.boolean().optional().describe("Must be true to perform the update"),
  }),
  execute: async ({ userId, args }) => {
    const {
      taskId,
      taskname,
      tags,
      importance,
      effort,
      estimatedDuration,
      canSplit,
      taskType,
      deadline,
      completed,
      confirm,
    } = args;
    try {
      let resolvedTaskId = taskId;
      // Require explicit confirmation to avoid accidental changes
      if (!confirm) {
        return `ok=false\nerr="confirmation_required"`;
      }

      // If taskId not provided, try to resolve by exact task title
      if (!resolvedTaskId) {
        if (!taskname) return `ok=false\nerr="task_identifier_required"`;
        const candidates = await taskService.getTasksForUser(userId, { taskname: taskname });
        if (!candidates || candidates.length === 0) {
          return `ok=false\nerr="task_not_found"`;
        }
        if (candidates.length > 1) {
          const list = candidates.map((c) => `- ${c.taskname} (${c._id})`).join("\n");
          return `ok=false\nerr="multiple_tasks_found"\nlist="${list}"`;
        }
        resolvedTaskId = candidates[0]._id;
      }

      // Build update object with only specified fields
      const updates = {};
      if (taskname !== undefined) updates.taskname = taskname;
      if (tags !== undefined) updates.tags = tags;
      if (importance !== undefined) updates.importance = importance;
      if (effort !== undefined) updates.effort = effort;
      if (estimatedDuration !== undefined) updates.estimatedDuration = estimatedDuration;
      if (canSplit !== undefined) updates.canSplit = canSplit;
      if (taskType !== undefined) updates.taskType = taskType;

      if (deadline !== undefined) {
        const d = new Date(deadline);
        if (isNaN(d.getTime())) {
          return `ok=false\nerr="Invalid date format. Use ISO 8601 (YYYY-MM-DD)."`;
        }
        updates.dueDate = d;
      }

      if (completed !== undefined) updates.status = completed ? "done" : "todo";

      // Update in database
      const result = await taskService.updateTask({ userId, taskId: resolvedTaskId, updates });

      if (!result.success) {
        return `ok=false\nerr="${result.error}"`;
      }

      const task = result.task;

      // Construct task_detail widget to show the updated task
      const widgetJson = {
        version: "1.0",
        widget_type: "task_detail",
        data: {
          task: {
            id: task._id,
            title: task.taskname,
            description: task.description,
            status: task.status,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
            importance: task.importance,
            priorityScore: task.priorityScore || 0,
            taskType: task.taskType || null,
            subCategory: task.subCategory || null,
            tags: task.tags,
            estimatedDuration: task.estimatedDuration,
            canSplit: task.canSplit,
          },
        },
      };

      return `<WIDGET_JSON>${JSON.stringify(widgetJson)}</WIDGET_JSON>`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default updateTaskMission;
