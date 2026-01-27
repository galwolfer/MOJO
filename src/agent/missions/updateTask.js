import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";
import { CATEGORY_STRING_VALUES } from "../../config/categories.js";
import { TASK_CONFIG } from "../taskRules.js";
import { getIllegalDisplayFields, getIllegalCharsErrorMessage } from "../../utils/illegalChars.js";
import { updateTaskViaController } from "../missionControllerHelpers.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

const updateTaskMission = new GuidedMission({
  name: "update_task",
  group: "task",
  description: "Update task properties (name, deadline, category, etc). CANNOT mark as done - use complete_task for that. Requires confirm=true.",
  missionInfo: "Modify task properties. Write short confirmation (e.g., 'Task updated:'). Don't list all changes in text.",
  behavior: [
    "If changing category: call get_subcategories(category=<new>) first.",
    "Require confirm=true before applying updates.",
    "For completing tasks, use complete_task tool instead.",
  ],
  widgets: ["list"],
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
    completed: z.boolean().optional().describe("DEPRECATED: Use complete_task tool instead to mark tasks as done (awards points)"),
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
      // If user is trying to complete a task, redirect to complete_task
      if (completed === true) {
        return `ok=false\nerr="To mark a task as done, use the complete_task tool instead. It awards points and updates your streak!"`;
      }

      let resolvedTaskId = taskId;
      // Require explicit confirmation to avoid accidental changes
      if (!confirm) {
        return okFalse("confirmation_required");
      }

      const illegalFields = getIllegalDisplayFields({
        taskname,
        subcategory,
      });
      if (illegalFields.length > 0) {
        return okFalse("illegal_characters", { msg: getIllegalCharsErrorMessage(illegalFields) });
      }

      // If taskId not provided, try to resolve by exact task title
      if (!resolvedTaskId) {
        if (!taskname) return okFalse("task_identifier_required");
        const candidates = await taskService.getTasksForUser(userId, { taskname: taskname });
        if (!candidates || candidates.length === 0) {
          return okFalse("task_not_found");
        }
        if (candidates.length > 1) {
          // Show the candidate tasks in a Task List widget so user can pick
          const tasks = candidates.map((c) => ({
            id: c._id?.toString ? c._id.toString() : c._id,
            title: c.taskname,
            dueDate: c.dueDate,
            importance: c.importance,
            effort: c.effort,
          }));
          return buildWidget("list", { listType: "task_list", tasks });
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
          return okFalse("Invalid estimatedDuration. Provide minutes as a positive number.");
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
          return okFalse("Invalid date format. Use ISO 8601 (YYYY-MM-DD).");
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
          return okFalse("Invalid recurrence.endDate. Use ISO 8601 (YYYY-MM-DD).");
        }

        updates.recurrence = rec;
      }

      // Note: completed status change is handled by complete_task tool, not here
      // This prevents bypassing gamification

      // Update through controller (which automatically triggers scheduling)
      const result = await updateTaskViaController(userId, resolvedTaskId, updates);

      if (!result) {
        return okFalse("task_update_failed");
      }

      const task = result;
      const id = task._id?.toString ? task._id.toString() : task._id;
      const title = task.taskname;
      const widgetJson = {
        listType: "task_detail",
        taskId: id,
        title,
        tasks: [{ id, title }],
      };

      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("list", widgetJson);
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default updateTaskMission;
