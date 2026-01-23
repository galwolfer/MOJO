import { getDisplayName } from "../../config/categories.js";

export function buildTaskDetailData(task, scheduledSessions = []) {
  return {
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
    effort: task.effort,
    priorityScore: task.priorityScore || 0,
    progressPercentage: task.progressPercentage ?? 0,
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
    category: task.category || null,
    categoryDisplay: getDisplayName(task.category),
    subcategoryDisplay: task.subCategory ? task.subCategory.label : null,
    subcategory: task.subCategory ? task.subCategory.label : null,
    canSplit: task.canSplit,
    scheduledSessions: scheduledSessions || [],
  };
}
