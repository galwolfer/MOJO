import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import * as taskService from "../../services/taskService.js";
import { TASK_CONFIG, inferTaskProperties, inferSplittingParams } from "../taskRules.js";
import { CATEGORY_STRING_VALUES } from "../../config/categories.js";
import { getIllegalDisplayFields, getIllegalCharsErrorMessage } from "../../utils/illegalChars.js";
import { createTaskViaController, saveSubcategoryToProfile } from "../missionControllerHelpers.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

const addTaskMission = new GuidedMission({
  name: "add_task",
  group: "task",
  description:
    "Create a task after explicit user confirmation. Required: taskname, deadline, estimatedDuration, category, subcategory. Call get_subcategories before this.",
  missionInfo: "Create only after user confirms category/subcategory choices.",
  behavior: [
    "IMPORTANT: User must first choose/confirm category AND subcategory.",
    "Call get_subcategories(category=<chosen>) to fetch options BEFORE calling add_task.",
    "AUTO-SELECTION RULE: If get_subcategories returns an existing subcategory that matches (exact or very close) the task name, automatically use it WITHOUT asking the user for confirmation.",
    "Only ask the user to confirm if there is NO matching subcategory or if creating a new one.",
    "Call only after the user explicitly confirms the task details (except for auto-matched subcategories).",
  ],
  schema: z.object({
    taskname: z.string().describe("Task title"),
    deadline: z.string().describe("ISO date (YYYY-MM-DD). Convert relative dates before calling"),
    description: z.string().optional().describe("Additional details"),
    importance: z.number().min(1).max(5).optional().describe("1-5 importance (AI can infer)"),
    effort: z.number().min(1).max(5).optional().describe("1-5 effort (AI can infer)"),
    duration: z.number().describe("REQUIRED: Estimated minutes to complete the task (user must specify)"),
    category: z.enum(CATEGORY_STRING_VALUES).describe("REQUIRED: One of the 18 standard categories"),
    subcategory: z
      .string()
      .describe(
        "REQUIRED: Specific subcategory. If get_subcategories returned an exact or close match to the task name, use it automatically. Otherwise, confirm with user before using/creating.",
      ),
    canSplit: z.boolean().optional().describe("Can be split into chunks?"),
    minChunk: z.number().optional().describe("Minimum chunk size in minutes when splitting"),
    chunkCount: z.number().optional().describe("Optional: number of chunks to split into"),
    chunkMinutes: z.number().optional().describe("Optional: minutes per chunk if specified"),
    minMinutes: z.number().optional().describe("Minimum minutes for a split chunk"),
    maxMinutes: z.number().optional().describe("Maximum minutes for a split chunk"),
    earliestStart: z.string().optional().describe("Optional earliest start date/time for the task"),
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
      minChunk,
      chunkCount,
      chunkMinutes,
      minMinutes,
      maxMinutes,
      earliestStart,
      taskType,
      recurrence,
    } = args;
    try {
      const illegalFields = getIllegalDisplayFields({
        taskname,
        description,
        subcategory,
      });
      if (illegalFields.length > 0) {
        return okFalse("illegal_characters", { msg: getIllegalCharsErrorMessage(illegalFields) });
      }

      // Infer properties from task title if not provided
      const inferred = inferTaskProperties(taskname);

      // Apply defaults and inference (do NOT hardcode effort; LLM should pick effort based on task info)
      // For importance: if caller provided it explicitly, use it; otherwise query user's category preference
      let finalImportance;
      if (importance !== undefined && importance !== null) {
        finalImportance = importance;
      } else {
        // Will fetch user's category priority below after we have finalCategory
        finalImportance = null; // placeholder, will be set after category priority lookup
      }
      const finalEffort = effort !== undefined && effort !== null ? effort : (inferred.effort ?? null);
      const finalDuration = duration !== undefined && duration !== null ? duration : (inferred.duration ?? null);
      const finalCategory = category || inferred.category || "";
      const finalSubcategory = subcategory || inferred.subcategory || "";

      // Enforce estimatedDuration must be provided by the user; if missing, ask explicitly
      if (!finalDuration || typeof finalDuration !== "number" || isNaN(finalDuration) || finalDuration <= 0) {
        return okFalse("duration_required", { msg: "Please ask the user: 'How many minutes will this task take?'" });
      }

      // Enforce effort must be explicitly set by the LLM (1-5). If missing, instruct LLM to pick one.
      if (
        finalEffort === null ||
        finalEffort === undefined ||
        !Number.isInteger(finalEffort) ||
        finalEffort < 1 ||
        finalEffort > 5
      ) {
        return okFalse("effort_required", {
          msg: "Assistant must select an effort (integer 1-5) based on task duration, category, and complexity, and include it in the mission call.",
        });
      }

      // If importance was not explicitly provided by the caller, use user's per-category priority mapping
      if (finalImportance === null) {
        try {
          const { getUserCategoryImportance } = await import("../../services/userPreferenceService.js");
          finalImportance = await getUserCategoryImportance(userId, finalCategory);
        } catch (err) {
          finalImportance = TASK_CONFIG.defaults.importance;
        }
      }

      // Construct subCategory object if provided
      const subCategoryObj = finalSubcategory
        ? { label: finalSubcategory, source: "user", confidence: 1, updatedAt: new Date() }
        : null;

      const finalCanSplit = canSplit !== undefined ? canSplit : TASK_CONFIG.defaults.splitable;

      // Compute splitting defaults and validation
      const finalMinChunk = typeof minChunk === "number" && minChunk > 0 ? minChunk : TASK_CONFIG.defaults.minChunk;
      const finalChunkCount = typeof chunkCount === "number" && chunkCount > 0 ? chunkCount : null;
      const finalChunkMinutes = typeof chunkMinutes === "number" && chunkMinutes > 0 ? chunkMinutes : null;
      const finalMinMinutes = typeof minMinutes === "number" && minMinutes > 0 ? minMinutes : null;
      const finalMaxMinutes = typeof maxMinutes === "number" && maxMinutes > 0 ? maxMinutes : null;
      const finalEarliestStart = earliestStart || null;

      // Determine final taskType based on explicit value or which splitting fields were provided
      let finalTaskType;
      if (taskType) {
        finalTaskType = taskType;
      } else if (minMinutes !== undefined || maxMinutes !== undefined) {
        finalTaskType = "leaky";
      } else if (chunkCount !== undefined || chunkMinutes !== undefined) {
        finalTaskType = "in_parts";
      } else {
        finalTaskType = finalCanSplit ? "in_parts" : TASK_CONFIG.defaults.taskType;
      }

      const storedMinChunk = finalTaskType === "in_parts" ? finalMinChunk : null;
      const storedChunkCount = finalTaskType === "in_parts" ? finalChunkCount : null;
      const storedChunkMinutes = finalTaskType === "in_parts" ? finalChunkMinutes : null;
      const storedMinMinutes = finalTaskType === "leaky" ? finalMinMinutes : null;
      const storedMaxMinutes = finalTaskType === "leaky" ? finalMaxMinutes : null;

      // Infer splitting params if not explicitly provided for this taskType
      const inferredParams = inferSplittingParams(finalTaskType, finalDuration);
      const persistMinChunk = finalTaskType === "in_parts" ? storedMinChunk || inferredParams.minChunk : null;
      const persistChunkCount = finalTaskType === "in_parts" ? storedChunkCount || inferredParams.chunkCount : null;
      const persistChunkMinutes =
        finalTaskType === "in_parts" ? storedChunkMinutes || inferredParams.chunkMinutes : null;
      const persistMinMinutes = finalTaskType === "leaky" ? storedMinMinutes || inferredParams.minMinutes : null;
      const persistMaxMinutes = finalTaskType === "leaky" ? storedMaxMinutes || inferredParams.maxMinutes : null;

      const taskData = {
        userId,
        taskname: taskname,
        description: description || "",
        importance: finalImportance,
        effort: finalEffort,
        estimatedDuration: finalDuration,
        canSplit: finalCanSplit,
        minChunk: persistMinChunk,
        chunkCount: persistChunkCount,
        chunkMinutes: persistChunkMinutes,
        minMinutes: persistMinMinutes,
        maxMinutes: persistMaxMinutes,
        earliestStart: finalEarliestStart,
        category: finalCategory,
        subCategory: subCategoryObj,
        // If canSplit is true and taskType not provided, default to 'in_parts' so that 'פרוס' is respected
        taskType: finalTaskType,
        dueDate: new Date(deadline),
        recurrence: recurrence || null,
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

      // Create task through controller (which automatically triggers scheduling)
      const task = await createTaskViaController(userId, taskData);

      if (!task) {
        return okFalse("task_creation_failed", { msg: "Failed to create task" });
      }

      console.log(`[LOG] Task created: ${task._id} ${recurrence ? "(recurring)" : ""}`);
      console.log(`[LOG] Schedule updated via controller after task creation`);

      // Return structured result only (LLM will generate user-facing confirmation)
      return okTrue({ msg: "Task created", id: `${task._id}` });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default addTaskMission;
