/**
 * ========================================
 * TASK RULES & CONFIGURATION
 * ========================================
 *
 * Defines the policy for task creation:
 * - Which fields are REQUIRED (LLM must ask user)
 * - Which fields are OPTIONAL (LLM can infer or use defaults)
 * - Default values for optional fields
 */

export const TASK_CONFIG = {
  // Fields that the LLM MUST obtain from the user.
  // If these are missing, the LLM should ask the user instead of guessing.
  required_fields: ["taskname", "deadline"],

  // Fields that the LLM can infer from context or leave to defaults.
  optional_fields: [
    "description",
    "importance", // 1-5
    "effort", // 1-5
    "duration", // minutes (estimatedDuration)
    "tags",
    "recurrence",
    "canSplit", // boolean
  ],

  // Default values to use if the LLM/User doesn't provide them
  defaults: {
    importance: 3,
    effort: 3,
    duration: 60,
    splitable: true,
    minChunk: 30,
    taskType: "perfect",
  },
};

/**
 * Infer task properties from the task name using keyword matching.
 * This helps auto-fill tags, importance, and effort.
 */
export function inferTaskProperties(taskName) {
  const name = taskName.toLowerCase();
  let tags = [];
  let importance = TASK_CONFIG.defaults.importance;
  let effort = TASK_CONFIG.defaults.effort;
  let duration = TASK_CONFIG.defaults.duration;

  // Tag inference based on keywords
  if (
    name.includes("homework") ||
    name.includes("שיעורי") ||
    name.includes("study") ||
    name.includes("למידה") ||
    name.includes("math") ||
    name.includes("mathematics") ||
    name.includes("linear") ||
    name.includes("ליניארית") ||
    name.includes("ai") ||
    name.includes("machine learning") ||
    name.includes("ml")
  ) {
    tags.push("education");
    importance = 4; // High importance for studies
    effort = 4; // Hard work
    duration = 120; // 2 hours for homework
  }

  if (
    name.includes("clean") ||
    name.includes("נקות") ||
    name.includes("room") ||
    name.includes("חדר") ||
    name.includes("house") ||
    name.includes("בית")
  ) {
    tags.push("household");
    importance = 2; // Low importance
    effort = 2; // Easy
    duration = 30; // 30 minutes
  }

  if (
    name.includes("work") ||
    name.includes("job") ||
    name.includes("project") ||
    name.includes("עבודה") ||
    name.includes("פרויקט")
  ) {
    tags.push("work");
    importance = 4; // High importance
    effort = 4; // Hard work
    duration = 180; // 3 hours
  }

  if (name.includes("shopping") || name.includes("buy") || name.includes("קניות") || name.includes("קנה")) {
    tags.push("shopping");
    importance = 3; // Medium
    effort = 2; // Easy
    duration = 60; // 1 hour
  }

  if (name.includes("urgent") || name.includes("important") || name.includes("דחוף") || name.includes("חשוב")) {
    importance = 5; // Critical
  }

  if (name.includes("easy") || name.includes("simple") || name.includes("קל")) {
    effort = 1; // Very easy
  }

  if (name.includes("hard") || name.includes("difficult") || name.includes("קשה")) {
    effort = 5; // Very hard
  }

  return {
    tags,
    importance,
    effort,
    duration,
  };
}

/**
 * Helper to generate system prompt instructions regarding task fields
 */
export function getTaskFieldInstructions() {
  return `TASK FIELDS:
- REQUIRED: ${TASK_CONFIG.required_fields.join(", ")}
- OPTIONAL: ${TASK_CONFIG.optional_fields.join(", ")}
- AI HELP: The model can infer tags, importance, effort, and estimated duration from the title.
- DEFAULTS: duration=${TASK_CONFIG.defaults.duration}m, importance=${TASK_CONFIG.defaults.importance}/5, effort=${
    TASK_CONFIG.defaults.effort
  }/5`;
}
