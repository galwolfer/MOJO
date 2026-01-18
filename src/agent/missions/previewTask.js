import { z } from "zod";
import { GuidedMission } from "./GuidedMission.js";
import { TASK_CONFIG, inferTaskProperties, inferSplittingParams } from "../taskRules.js";
import { getDisplayName } from "../../config/categories.js";

/**
 * Parse relative date strings like "next Thursday", "tomorrow", "in 3 days"
 * and convert them to ISO format (YYYY-MM-DD)
 */
function parseRelativeDate(dateString) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday

  const lowerStr = dateString.toLowerCase().trim();

  // Handle: "tomorrow"
  if (lowerStr === "tomorrow" || lowerStr === "מחר") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }

  // Handle: "today"
  if (lowerStr === "today" || lowerStr === "היום") {
    return today.toISOString().split("T")[0];
  }

  // Handle: "next Thursday", "this Thursday", "Thursday", etc.
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  for (let i = 0; i < days.length; i++) {
    const engDay = days[i];
    const hebDay = hebrewDays[i];
    if (
      lowerStr.includes(engDay) ||
      lowerStr.includes(hebDay) ||
      lowerStr.includes(`ליום ${hebDay}`) ||
      lowerStr.includes(`ל${hebDay}`)
    ) {
      // Calculate days until next occurrence of this day
      let daysToAdd = (i - dayOfWeek + 7) % 7;

      // If it's today, move to next week
      if (daysToAdd === 0) {
        daysToAdd = 7;
      }

      // If user says "next" explicitly
      if (lowerStr.includes("next") || lowerStr.includes("הקרוב")) {
        if (daysToAdd === 0) daysToAdd = 7; // Ensure it's in the future
      }

      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return targetDate.toISOString().split("T")[0];
    }
  }

  // Handle: "in 3 days", "in 1 week", etc.
  const relativeRegex = /in\s+(\d+)\s+(days?|weeks?|hours?)/i;
  const hebrewRelativeRegex = /בעוד\s+(\d+)\s+(ימים?|שבועות?|שעות?)/i;
  let match = lowerStr.match(relativeRegex) || lowerStr.match(hebrewRelativeRegex);
  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const futureDate = new Date(today);
    if (unit.includes("day")) futureDate.setDate(futureDate.getDate() + amount);
    else if (unit.includes("week")) futureDate.setDate(futureDate.getDate() + amount * 7);
    else if (unit.includes("hour")) futureDate.setHours(futureDate.getHours() + amount);

    return futureDate.toISOString().split("T")[0];
  }

  // If already in ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Fallback: throw error if can't parse
  throw new Error(
    `Cannot parse date: "${dateString}". Use formats like "2026-01-09", "tomorrow", "next Thursday", etc.`,
  );
}

const previewTaskMission = new GuidedMission({
  name: "preview_task",
  group: "task",
  description:
    "Return a task_confirmation widget for approval. Required: taskname, deadline, estimatedDuration, category, subcategory. Must call get_subcategories first.",
  missionInfo: "Draft and show a task_confirmation widget. User must choose category/subcategory first.",
  behavior: [
    "Use when user asks to create a task.",
    "STEP 1: Determine category ",
    "STEP 2: Call get_subcategories(category=<chosen>) to fetch options.",
    "STEP 3: Show preview_task with confirmed category and subcategory.",
    "STEP 4: After user confirms, call add_task with final details.",
  ],
  widgets: ["task_confirmation"],
  schema: z.object({
    taskname: z.string().describe("Task title (required)"),
    deadline: z.string().describe("ISO date (YYYY-MM-DD). Convert relative dates before calling"),
    description: z.string().optional().describe("Optional details"),
    category: z.string().describe("REQUIRED: Category (one of the 18 standard categories)"),
    subcategory: z
      .string()
      .describe("REQUIRED: Subcategory (MUST be from get_subcategories result or new user-confirmed)"),
    importance: z.number().min(1).max(5).optional().describe("1-5 importance (AI can infer)"),
    effort: z.number().min(1).max(5).optional().describe("1-5 effort (AI can infer)"),
    duration: z.number().describe("REQUIRED: Estimated minutes to complete the task (user must specify)"),
    canSplit: z.boolean().optional().describe("Can the task be split?"),
    minChunk: z.number().optional().describe("Minimum chunk size in minutes when splitting"),
    chunkCount: z.number().optional().describe("Optional: number of chunks to split into"),
    chunkMinutes: z.number().optional().describe("Optional: minutes per chunk if specified"),
    minMinutes: z.number().optional().describe("Minimum minutes for a split chunk"),
    maxMinutes: z.number().optional().describe("Maximum minutes for a split chunk"),
    earliestStart: z.string().optional().describe("Optional earliest start date/time for the task"),
    taskType: z.string().optional().describe("Task splitting strategy (perfect/in_parts/leaky)"),
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
      category,
      subcategory,
      importance,
      effort,
      duration,
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
      // Parse relative dates (e.g., "next Thursday", "tomorrow", "in 3 days") to ISO format
      let finalDeadline = deadline;
      try {
        finalDeadline = parseRelativeDate(deadline);
      } catch (e) {
        // If parsing fails, try to use it as-is (might be ISO format already)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
          return `ok=false\nerr="Invalid deadline format: ${deadline}. Use 'YYYY-MM-DD', 'tomorrow', 'next Thursday', etc."`;
        }
        finalDeadline = deadline;
      }

      // Validate deadline is a valid date
      const deadlineDate = new Date(finalDeadline);
      if (isNaN(deadlineDate.getTime())) {
        return `ok=false\nerr="Invalid deadline date: ${finalDeadline}"`;
      }

      // Infer properties from task name if not provided
      const inferred = inferTaskProperties(taskname);

      // Apply defaults and inference
      let finalImportance = importance !== undefined && importance !== null ? importance : null;
      const finalEffort = effort !== undefined && effort !== null ? effort : (inferred.effort ?? null);
      const finalDuration = duration !== undefined && duration !== null ? duration : (inferred.duration ?? null);
      const finalCanSplit = canSplit !== undefined ? canSplit : TASK_CONFIG.defaults.splitable;

      // If duration isn't provided, request it from the user
      if (!finalDuration || typeof finalDuration !== "number" || isNaN(finalDuration) || finalDuration <= 0) {
        return `ok=false\nerr="duration_required"\nmsg="Please ask the user: 'How many minutes will this task take?'"`;
      }

      // Enforce effort must be provided by the assistant (LLM) — pick integer 1-5 based on duration/category
      if (
        finalEffort === null ||
        finalEffort === undefined ||
        !Number.isInteger(finalEffort) ||
        finalEffort < 1 ||
        finalEffort > 5
      ) {
        return `ok=false\nerr="effort_required"\nmsg="Assistant must select an effort (integer 1-5) based on task duration, category, and complexity, and include it in the preview_task call."`;
      }

      // If importance was not explicitly provided by the caller, use user's per-category priority mapping (#categorise entity)
      if (importance === undefined || importance === null) {
        try {
          const { getUserCategoryImportance } = await import("../../services/userPreferenceService.js");
          finalImportance = await getUserCategoryImportance(userId, category || inferred.category || "");
        } catch (err) {
          finalImportance = TASK_CONFIG.defaults.importance;
        }
      }

      // Compute defaults for splitting-related fields
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

      const previewMinChunk = finalTaskType === "in_parts" ? finalMinChunk : null;
      const previewChunkCount = finalTaskType === "in_parts" ? finalChunkCount : null;
      const previewChunkMinutes = finalTaskType === "in_parts" ? finalChunkMinutes : null;
      const previewMinMinutes = finalTaskType === "leaky" ? finalMinMinutes : null;
      const previewMaxMinutes = finalTaskType === "leaky" ? finalMaxMinutes : null;

      // Infer splitting params if not explicitly provided for this taskType
      const inferredParams = inferSplittingParams(finalTaskType, finalDuration);
      const displayMinChunk = finalTaskType === "in_parts" ? previewMinChunk || inferredParams.minChunk : null;
      const displayChunkCount = finalTaskType === "in_parts" ? previewChunkCount || inferredParams.chunkCount : null;
      const displayChunkMinutes =
        finalTaskType === "in_parts" ? previewChunkMinutes || inferredParams.chunkMinutes : null;
      const displayMinMinutes = finalTaskType === "leaky" ? previewMinMinutes || inferredParams.minMinutes : null;
      const displayMaxMinutes = finalTaskType === "leaky" ? previewMaxMinutes || inferredParams.maxMinutes : null;

      const categoryDisplay = getDisplayName(category || inferred.category || "");
      const shortDescription = `${taskname} — ${categoryDisplay} • due ${finalDeadline}`;

      // Widget payload - clean structure with no duplicate fields
      const widgetPayload = {
        id: "draft-" + Date.now(),
        title: taskname,
        description: description || "",
        status: "draft",
        dueDate: new Date(finalDeadline).toISOString(),
        category: categoryDisplay, // Use display name for category
        subcategory: subcategory || "",
        importance: finalImportance,
        effort: finalEffort,
        estimatedDuration: finalDuration,
        canSplit: finalCanSplit,
        taskType: finalTaskType,
        // Splitting parameters (only include when relevant)
        minChunk: displayMinChunk,
        chunkCount: displayChunkCount,
        minMinutes: displayMinMinutes,
        maxMinutes: displayMaxMinutes,
        earliestStart: finalEarliestStart,
        recurrence: recurrence || null,
        tags: null,
        // Store internal category key for task creation
        _categoryKey: category || "",
      };

      // Build a canonical widget string using the central helper (ensures
      // fields match registry schema and always uses the exact tags)
      try {
        const { buildWidgetString } = await import("../widgets/widgetUtils.js");
        return buildWidgetString("task_confirmation", widgetPayload);
      } catch (err) {
        console.error("[previewTask] Failed to build widget string:", err.message);
        // If widget generation fails for any reason, return a human-friendly
        // assistant message and DO NOT include any widget block so the
        // frontend will not attempt to parse one.
        return (
          "I’m sorry — I ran into a problem generating a preview for the task. " +
          "I can still create the task for you with the details you provided, " +
          "or make any edits you want before I create it."
        );
      }
    } catch (error) {
      return `ok=false\nerr="Failed to generate preview: ${error.message}"`;
    }
  },
});

export default previewTaskMission;
