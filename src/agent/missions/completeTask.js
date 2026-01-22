import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { awardTaskCompletionPoints } from "../../controllers/userController.js";
import { buildWidgetString } from "../widgets/widgetUtils.js";

const completeTaskMission = new LightMission({
  name: "complete_task",
  group: "task",
  description: "Mark a task as DONE/COMPLETED. ALWAYS use this (not update_task) when user wants to complete, finish, check off, or mark done. Awards points and updates streak.",
  missionInfo:
    "Complete a task and award gamification points. Use task name or ID. Celebrate the completion briefly.",
  widgets: ["task_detail", "confirmation"],
  schema: z.object({
    taskId: z.string().optional().describe("Task ID (MongoDB ObjectId) if known"),
    taskName: z.string().optional().describe("Task name to search for if ID not known"),
  }),
  execute: async ({ userId, args, context }) => {
    const { taskId, taskName } = args;

    if (!taskId && !taskName) {
      return `ok=false\nerr="Please provide either taskId or taskName to complete"`;
    }

    try {
      let resolvedTaskId = taskId;

      // If no taskId, search by name
      if (!resolvedTaskId && taskName) {
        const tasks = await taskService.getTasksForUser(userId, {
          taskname: { $regex: taskName, $options: "i" },
          status: { $ne: "done" },
        });

        if (tasks.length === 0) {
          return `ok=false\nerr="No incomplete task found matching '${taskName}'"`;
        }

        if (tasks.length > 1) {
          // Return list for user to choose
          const taskList = tasks.map(t => `- ${t.taskname} (ID: ${t._id})`).join("\n");
          return `ok=false\nerr="Multiple tasks found matching '${taskName}'. Please be more specific:\n${taskList}"`;
        }

        resolvedTaskId = tasks[0]._id.toString();
      }

      // Use the proper completeTask service that handles ML training
      const result = await taskService.completeTask({ taskId: resolvedTaskId, userId });

      if (!result || result.success === false) {
        return `ok=false\nerr="${result?.error || "Task not found or you don't have permission"}"`;
      }

      // Award points only if this was a NEW completion
      let gamification = null;
      let pointsAwarded = 0;
      if (!result.wasAlreadyCompleted) {
        try {
          const reward = await awardTaskCompletionPoints(userId, result.task);
          pointsAwarded = reward.points;
          gamification = reward.gamification;
          console.log(`[completeTaskMission] Awarded ${pointsAwarded} points to user ${userId}`);
        } catch (pointsError) {
          console.warn("[completeTaskMission] Failed to award points:", pointsError.message);
        }
      }

      const task = result.task;

      // Build confirmation widget showing the completion
      const widgetData = {
        title: "Task Completed! 🎉",
        message: `"${task.taskname}" has been marked as done.`,
        details: pointsAwarded > 0 ? [
          `+${pointsAwarded} points earned!`,
          gamification?.currentStreak ? `🔥 ${gamification.currentStreak} day streak!` : null,
        ].filter(Boolean) : [],
        task: {
          id: task._id,
          title: task.taskname,
          status: "done",
        },
      };

      const widgetString = buildWidgetString("confirmation", widgetData);

      // Return success with gamification info
      const statsLine = pointsAwarded > 0 
        ? `points_awarded=${pointsAwarded}\nstreak=${gamification?.currentStreak || 0}\ntotal_points=${gamification?.points || 0}`
        : `already_completed=true`;

      return `ok=true\ntask_id=${task._id}\ntask_name=${task.taskname}\n${statsLine}\n${widgetString}`;
    } catch (error) {
      console.error("[completeTaskMission] Error:", error);
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default completeTaskMission;
