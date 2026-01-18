import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";
import { awardTaskCompletionPoints } from "../../controllers/userController.js";
import { CATEGORY_STRING_VALUES, getDisplayName } from "../../config/categories.js";
import { TASK_CONFIG } from "../taskRules.js";

const updateTaskMission = new GuidedMission({
  name: "update_task",
  group: "task",
  description:
    "Update a task; requires confirm=true. Can update: taskname, deadline, estimatedDuration, category, subcategory, importance, effort, canSplit, taskType, completed. Call get_subcategories if changing category.",
  missionInfo: "Modify task (optionally change category/subcategory)",
  behavior: [
    "If changing category: call get_subcategories(category=<new>) first.",
    "Require confirm=true before applying updates.",
  ],
  widgets: ["task_detail"],
  schema: z.object({
    taskId: z.string().optional(),
    taskname: z.string().optional().describe("Task title to identify task when taskId is not provided"),
    category: z
      .enum(CATEGORY_STRING_VALUES)
      .optional()
      .describe("Update category (if changed, call get_subcategories first)"),
    subcategory: z.string().optional().describe("Update subcategory (should be from get_subcategories result)"),
    importance: z.number().min(1).max(5).optional().describe("Importance 1-5"),
    effort: z.number().min(1).max(5).optional().describe("Effort 1-5"),
    estimatedDuration: z.number().optional().describe("Estimated minutes"),
    canSplit: z.boolean().optional().describe("Can be split?"),
    minChunk: z.number().optional().describe("Minimum chunk size in minutes when splitting"),
    chunkCount: z.number().optional().describe("Optional: number of chunks to split into"),
    chunkMinutes: z.number().optional().describe("Optional: minutes per chunk if specified"),
    minMinutes: z.number().optional().describe("Minimum minutes for a split chunk"),
    maxMinutes: z.number().optional().describe("Maximum minutes for a split chunk"),
    earliestStart: z.string().optional().describe("Optional earliest start date/time for the task"),
    taskType: z.string().optional().describe("Task splitting strategy"),
    deadline: z.string().optional(),
    recurrence: z
      .object({
        type: z.enum(["daily", "weekly", "monthly", "yearly"]),
        interval: z.number().optional().default(1),
        endDate: z.string().optional(),
        count: z.number().optional(),
      })
      .optional(),
    completed: z.boolean().optional(),
    confirm: z.boolean().optional().describe("Must be true to perform the update"),
  }),
  execute: async ({ userId, args }) => {
    const {
      taskId,
      taskname,
      category,
      subcategory,
      importance,
      effort,
      estimatedDuration,
      canSplit,
      minChunk,
      chunkCount,
      chunkMinutes,
      minMinutes,
      maxMinutes,
      earliestStart,
      taskType,
      deadline,
      completed,
      confirm,
      recurrence,
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
      if (category !== undefined) updates.category = category;
      if (subcategory !== undefined) {
        updates.subCategory = { label: subcategory, source: "user", confidence: 1, updatedAt: new Date() };
      }
      if (importance !== undefined) updates.importance = importance;
      if (effort !== undefined) updates.effort = effort;
      // Validate and normalize numeric and splitting-related fields similar to add_task behavior
      if (estimatedDuration !== undefined) {
        if (typeof estimatedDuration !== "number" || isNaN(estimatedDuration) || estimatedDuration <= 0) {
          return `ok=false\nerr="Invalid estimatedDuration. Provide minutes as a positive number."`;
        }
        updates.estimatedDuration = estimatedDuration;
      }

      if (canSplit !== undefined) updates.canSplit = canSplit;

      // minChunk fallback to default when provided invalidly
      if (minChunk !== undefined) {
        const finalMin = typeof minChunk === "number" && minChunk > 0 ? minChunk : TASK_CONFIG.defaults.minChunk;
        updates.minChunk = finalMin;
      }

      if (chunkCount !== undefined) {
        if (typeof chunkCount === "number" && chunkCount > 0) updates.chunkCount = chunkCount;
        // else ignore invalid chunkCount (do not clear existing value)
      }

      if (chunkMinutes !== undefined) {
        if (typeof chunkMinutes === "number" && chunkMinutes > 0) updates.chunkMinutes = chunkMinutes;
      }

      if (minMinutes !== undefined) {
        if (typeof minMinutes === "number" && minMinutes > 0) updates.minMinutes = minMinutes;
      }

      if (maxMinutes !== undefined) {
        if (typeof maxMinutes === "number" && maxMinutes > 0) updates.maxMinutes = maxMinutes;
      }

      if (earliestStart !== undefined) updates.earliestStart = earliestStart;

      // taskType: respect explicit value even if canSplit=false
      if (taskType !== undefined) {
        updates.taskType = taskType;

        // Null-out fields that do not apply to the selected taskType
        if (taskType === "perfect") {
          updates.minChunk = null;
          updates.chunkCount = null;
          updates.chunkMinutes = null;
          updates.minMinutes = null;
          updates.maxMinutes = null;
        } else if (taskType === "in_parts") {
          // in_parts: keep minChunk/chunkCount/chunkMinutes, clear leaky bounds
          updates.minMinutes = null;
          updates.maxMinutes = null;
        } else if (taskType === "leaky") {
          // leaky: keep minMinutes/maxMinutes, clear in_parts-specific fields
          updates.minChunk = null;
          updates.chunkCount = null;
          updates.chunkMinutes = null;
        }
      }

      if (deadline !== undefined) {
        const d = new Date(deadline);
        if (isNaN(d.getTime())) {
          return `ok=false\nerr="Invalid date format. Use ISO 8601 (YYYY-MM-DD)."`;
        }
        updates.dueDate = d;
      }

      if (recurrence !== undefined) {
        // Normalize recurrence values and parse endDate to Date if provided
        const rec = {
          type: recurrence.type,
          interval: recurrence.interval || 1,
          endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
          count: recurrence.count || null,
          completedDates: [],
        };

        // Validate endDate if provided
        if (rec.endDate && isNaN(rec.endDate.getTime())) {
          return `ok=false\nerr="Invalid recurrence.endDate. Use ISO 8601 (YYYY-MM-DD)."`;
        }

        updates.recurrence = rec;
      }

      if (completed !== undefined) updates.status = completed ? "done" : "todo";

      // Update in database
      const result = await taskService.updateTask({ userId, taskId: resolvedTaskId, updates });

      if (!result.success) {
        return `ok=false\nerr="${result.error}"`;
      }

      const task = result.task;

      // Award points if task is marked as completed
      if (completed === true && result.task) {
        try {
          await awardTaskCompletionPoints(userId, result.task);
        } catch (pointsError) {
          console.warn("[updateTaskMission] Failed to award points:", pointsError.message);
        }
      }

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
            // Provide aliases and full splitting fields so widgets can display everything
            taskname: task.taskname,
            deadline: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : null,
            estimatedDuration: task.estimatedDuration,
            duration: task.estimatedDuration,
            importance: task.importance,
            priorityScore: task.priorityScore || 0,
            taskType: task.taskType || null,
            minChunk: task.minChunk !== undefined ? task.minChunk : null,
            chunkCount: task.chunkCount !== undefined ? task.chunkCount : null,
            chunkMinutes: task.chunkMinutes !== undefined ? task.chunkMinutes : null,
            minMinutes: task.minMinutes !== undefined ? task.minMinutes : null,
            maxMinutes: task.maxMinutes !== undefined ? task.maxMinutes : null,
            earliestStart: task.earliestStart
              ? task.earliestStart instanceof Date
                ? task.earliestStart.toISOString().split("T")[0]
                : task.earliestStart
              : null,
            subCategory: task.subCategory || null,
            category: task.category,
            categoryDisplay: getDisplayName(task.category),
            subcategoryDisplay: task.subCategory ? task.subCategory.label : null,
            canSplit: task.canSplit,
          },
        },
      };

      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("task_detail", widgetJson.data);
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default updateTaskMission;
