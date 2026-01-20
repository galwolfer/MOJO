// Helper to resolve a task by ID or name. Returns an object with
// { task, error, list } where `list` is an array of candidate strings
// if multiple matches were found.
import { Task } from "../../models/Task.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function resolveByIdOrName(userId, { taskId, taskname }) {
  if (!taskId && !taskname) return { task: null, error: "task_identifier_required" };

  if (taskId) {
    const task = await Task.findOne({ _id: taskId, userId }).lean();
    if (!task) return { task: null, error: "task_not_found" };
    return { task };
  }

  const trimmed = (taskname || "").trim();
  if (!trimmed) return { task: null, error: "task_identifier_required" };

  // Try exact match, then case-insensitive exact, then partial
  let candidates = await Task.find({ userId, taskname: trimmed }).lean();
  if (!candidates.length) {
    const exact = new RegExp(`^${escapeRegExp(trimmed)}$`, "i");
    candidates = await Task.find({ userId, taskname: exact }).lean();
  }
  if (!candidates.length) {
    const partial = new RegExp(escapeRegExp(trimmed), "i");
    candidates = await Task.find({ userId, taskname: partial }).lean();
  }

  if (!candidates || candidates.length === 0) {
    return { task: null, error: "task_not_found" };
  }

  if (candidates.length > 1) {
    const list = candidates.map((c) => `${c.taskname} (${c._id})`);
    return { task: null, error: "multiple_tasks_found", list };
  }

  return { task: candidates[0] };
}
