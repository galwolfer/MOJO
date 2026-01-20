import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";
import { deleteTaskViaController } from "../missionControllerHelpers.js";

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

      // Delete through controller (which automatically triggers scheduling)
      const success = await deleteTaskViaController(userId, taskId);
      if (!success) {
        return `ok=false\nerr="task_deletion_failed"`;
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
