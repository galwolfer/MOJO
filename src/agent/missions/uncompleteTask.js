import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { reverseTaskCompletion } from "../../controllers/userController.js";
import { buildWidgetString } from "../widgets/widgetUtils.js";
import { getDisplayName } from "../../config/categories.js";

const uncompleteTaskMission = new LightMission({
  name: "uncomplete_task",
  group: "task",
  description: "Mark a completed task as NOT DONE/INCOMPLETE. Use when user wants to undo, revert, uncheck, or mark a task as not finished. This will subtract the points that were awarded and decrement the task count.",
  missionInfo:
    "Revert a completed task back to incomplete status. Subtracts earned points and decrements task count. Use task name or ID.",
  widgets: ["task_detail", "confirmation"],
  schema: z.object({
    taskId: z.string().optional().describe("Task ID (MongoDB ObjectId) if known"),
    taskName: z.string().optional().describe("Task name to search for if ID not known"),
  }),
  execute: async ({ userId, args, context }) => {
    const { taskId, taskName } = args;

    if (!taskId && !taskName) {
      return `ok=false\nerr="Please provide either taskId or taskName to uncomplete"`;
    }

    try {
      let resolvedTaskId = taskId;

      // If no taskId, search by name
      if (!resolvedTaskId && taskName) {
        const tasks = await taskService.getTasksForUser(userId, {
          taskname: { $regex: taskName, $options: "i" },
          status: "done", // Only search completed tasks
        });

        if (tasks.length === 0) {
          return `ok=false\nerr="No completed task found matching '${taskName}'"`;
        }

        if (tasks.length > 1) {
          // Return list for user to choose
          const taskList = tasks.map(t => `- ${t.taskname} (ID: ${t._id})`).join("\n");
          return `ok=false\nerr="Multiple completed tasks found matching '${taskName}'. Please be more specific:\n${taskList}"`;
        }

        resolvedTaskId = tasks[0]._id.toString();
      }

      // Toggle the task completion (which will revert it since it's done)
      const result = await taskService.toggleTaskCompletion(resolvedTaskId, userId);

      if (!result || !result.task) {
        return `ok=false\nerr="Task not found or you don't have permission"`;
      }

      // Ensure the task was actually uncompleted (was done before)
      if (!result.wasNewUncompletion) {
        return `ok=false\nerr="Task '${result.task.taskname}' was not completed, so it cannot be uncompleted"`;
      }

      // Reverse the points
      let gamification = null;
      let pointsSubtracted = 0;
      try {
        const taskWithPoints = { 
          ...result.task, 
          earnedPoints: result.task.previousEarnedPoints || 0 
        };
        const reversal = await reverseTaskCompletion(userId, taskWithPoints);
        pointsSubtracted = reversal.pointsSubtracted;
        gamification = reversal.gamification;
        console.log(`[uncompleteTaskMission] Subtracted ${pointsSubtracted} points from user ${userId}`);
      } catch (reversalError) {
        console.warn("[uncompleteTaskMission] Failed to reverse points:", reversalError.message);
      }

      const task = result.task;

      // Build task_detail widget showing the uncompleted task
      const widgetData = {
        task: {
          id: task._id,
          title: task.taskname,
          description: task.description,
          status: task.status,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
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
          subcategoryDisplay: task.subCategory ? task.subCategory.label || task.subCategory.name : null,
          canSplit: task.canSplit,
        },
      };

      const widgetString = buildWidgetString("task_detail", widgetData);

      // Return success with reversal info
      const statsLine = pointsSubtracted > 0 
        ? `points_subtracted=${pointsSubtracted}\ntotal_points=${gamification?.points || 0}\ncompleted_tasks=${gamification?.completedTasks || 0}`
        : `no_points_to_subtract=true`;

      return `ok=true\ntask_id=${task._id}\ntask_name=${task.taskname}\nstatus=${task.status}\n${statsLine}\n${widgetString}`;
    } catch (error) {
      console.error("[uncompleteTaskMission] Error:", error);
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default uncompleteTaskMission;
