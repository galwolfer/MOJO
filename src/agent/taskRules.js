import { CATEGORY_STRING_VALUES } from "../../config/categories.js";

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
    "category",
    "subcategory",
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
  // Intentionally minimal: DO NOT hardcode category, subcategory, importance, effort, or duration here.
  // The LLM should *decide* these values or ask clarifying questions when unsure. Returning empty/null
  // ensures downstream logic does not auto-assign these fields without the LLM's explicit choice.
  return {
    category: "",
    subcategory: "",
    importance: null,
    effort: null,
    duration: null,
  };
}

/**
 * Helper to generate system prompt instructions regarding task fields
 */
export function getTaskFieldInstructions() {
  return `TASK FIELDS:
- REQUIRED: ${TASK_CONFIG.required_fields.join(", ")}
- OPTIONAL: ${TASK_CONFIG.optional_fields.join(", ")}
- AI DECISION: The model MUST choose a category from the 18 provided and SHOULD use the 'get_subcategories' tool to fetch the user's existing subcategories and choose one. If uncertain, ask a short clarifying question instead of guessing.
- DEFAULTS: duration=${TASK_CONFIG.defaults.duration}m, importance=${TASK_CONFIG.defaults.importance}/5, effort=${
    TASK_CONFIG.defaults.effort
  }/5
- CATEGORIES: You MUST use one of these 18 categories: ${CATEGORY_STRING_VALUES.join(", ")}.
- SUBCATEGORIES: Select from the user's existing subcategories for the chosen category (use get_subcategories tool). If none fit, you may propose a new subcategory and confirm with the user.`;
}
