import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";

const deleteTaskMission = new GuidedMission({
  name: "delete_task",
  group: "task",
  description: "Delete a task only on explicit user request + confirm=true",
  missionInfo: "Delete only on explicit user delete + confirm.",
  behavior: ["Require confirm=true before deletion."],
  schema: z.object({
    taskId: z.string(),
    confirm: z.boolean().optional().describe("Must be true to perform deletion"),
  }),
  execute: async ({ userId, args }) => {
    const { taskId, confirm } = args;
    try {
      if (!confirm) return `ok=false\nerr="confirmation_required"`;

      const result = await taskService.deleteTask({ taskId, userId });
      if (!result.success) {
        return `ok=false\nerr="${result.error}"`;
      }
      return `ok=true\nid="${taskId}"`;
    } catch (error) {
      if (error.message && (error.message.includes("ObjectId") || error.kind === "ObjectId")) {
        return `ok=false\nerr="Invalid Task ID"`;
      }
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default deleteTaskMission;
