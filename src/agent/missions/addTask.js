import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";
import { TASK_CONFIG, inferTaskProperties } from "../taskRules.js";
import { CATEGORY_STRING_VALUES } from "../../config/categories.js";

const addTaskMission = new GuidedMission({
  name: "add_task",
  group: "task",
  description:
    "Create a task after explicit user confirmation. Required: taskname, deadline. AI may fill optional fields.",
  missionInfo: "Create only after explicit confirmation (yes/confirm).",
  behavior: ["Call only after the user explicitly confirms."],
  schema: z.object({
    taskname: z.string().describe("Task title"),
    deadline: z.string().describe("ISO date (YYYY-MM-DD). Convert relative dates before calling"),
    description: z.string().optional().describe("Additional details"),
    importance: z.number().min(1).max(5).optional().describe("1-5 importance (AI can infer)"),
    effort: z.number().min(1).max(5).optional().describe("1-5 effort (AI can infer)"),
    duration: z.number().optional().describe("Estimated minutes (AI can infer)"),
    category: z.enum(CATEGORY_STRING_VALUES).optional().describe("One of the 18 standard categories"),
    subcategory: z.string().optional().describe("Specific subcategory (select from existing or create new)"),
    canSplit: z.boolean().optional().describe("Can be split into chunks?"),
    taskType: z.string().optional().describe("Task splitting strategy"),
    recurrence: z
      .object({
        type: z.enum(["daily", "weekly", "monthly", "yearly"]),
        interval: z.number().optional().default(1),
        endDate: z.string().optional(),
        count: z.number().optional(),
      })
      .optional(),
  }),
  execute: async ({ userId, args }) => {
    const {
      taskname,
      deadline,
      description,
      importance,
      effort,
      duration,
      category,
      subcategory,
      canSplit,
      taskType,
      recurrence,
    } = args;
    try {
      // Infer properties from task title if not provided
      const inferred = inferTaskProperties(taskname);

      // Apply defaults and inference
      const finalImportance = importance || inferred.importance;
      const finalEffort = effort || inferred.effort;
      const finalDuration = duration || inferred.duration;
      const finalCategory = category || inferred.category || "";
      const finalSubcategory = subcategory || inferred.subcategory || "";

      // Construct subCategory object if provided
      const subCategoryObj = finalSubcategory
        ? { label: finalSubcategory, source: "user", confidence: 1, updatedAt: new Date() }
        : null;

      const finalCanSplit = canSplit !== undefined ? canSplit : TASK_CONFIG.defaults.splitable;

      const taskData = {
        userId,
        taskname: taskname,
        description: description || "",
        importance: finalImportance,
        effort: finalEffort,
        estimatedDuration: finalDuration,
        canSplit: finalCanSplit,
        category: finalCategory,
        subCategory: subCategoryObjCanSplit,
        tags: finalTags,
        taskType: taskType || TASK_CONFIG.defaults.taskType,
        dueDate: new Date(deadline),
      };

      // Add recurrence pattern if specified
      if (recurrence?.type) {
        taskData.recurrence = {
          type: recurrence.type,
          interval: recurrence.interval || 1,
          endDate: recurrence.endDate || null,
          count: recurrence.count || null,
          completedDates: [],
        };
      }

      // Create task in database
      const task = await taskService.createTask(taskData);

      console.log(`[LOG] Task created: ${task._id} ${recurrence ? "(recurring)" : ""}`);

      // Return structured result only (LLM will generate user-facing confirmation)
      return `ok=true\nmsg="Task created"\nid="${task._id}"`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default addTaskMission;
