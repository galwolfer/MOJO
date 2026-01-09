import { CATEGORY_STRING_VALUES } from "../config/categories.js";

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
  required_fields: ["taskname", "deadline", "estimatedDuration"],

  // Fields that the LLM can infer from context or leave to defaults.
  optional_fields: [
    "description",
    "importance", // 1-5
    "effort", // 1-5
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
- DEFAULTS: importance=${TASK_CONFIG.defaults.importance}/5, effort=${
    TASK_CONFIG.defaults.effort
  }/5 (estimatedDuration must be provided by the user)
- CATEGORIES: You MUST use one of these 18 categories: ${CATEGORY_STRING_VALUES.join(", ")}.

SUBCATEGORY WORKFLOW (IMPORTANT):
1. After the user chooses or you infer a category, ALWAYS call get_subcategories(category=<category_index>) to see what subcategories the user has saved and historical task labels.
2. If a matching subcategory exists in the returned list, suggest it to the user for confirmation.
3. If none match the user's intent, ask them to provide a new subcategory name, then add it.
4. NEVER skip get_subcategories — it provides both user-saved subcategories AND historical task labels that might apply.
5. Respect user preferences: if they have saved subcategories, prioritize those over new suggestions.

SPLITTING & RECURRENCE RULES:
- When a task may be split (user says "spread", "פרוס", or indicates long duration), ALWAYS determine:
  * 'canSplit' (boolean)
  * 'minChunk' (minutes) — ask the user if unsure, default to the configured minChunk when user doesn't care
  * 'taskType' (one of 'perfect', 'in_parts', 'leaky') — choose based on user's instruction: "פרוס" -> 'in_parts'; "פרוס בצורה לא מדויקת" -> 'leaky'; single-block tasks -> 'perfect'
  * 'chunkCount' or 'chunkMinutes' if user requests explicit split counts or sizes
  * 'earliestStart' when user provides availability window
  * 'recurrence' when user asks for repeating tasks (type, interval, endDate or count)
- Always surface these as fields in the 'task_confirmation' widget and confirm with the user before creating the task.
- Use splitting info when choosing 'effort' and when suggesting 'taskType' (LLM should consider duration and user's preference).

DURATION RULE (REQUIRED):
- If the user does NOT provide 'estimatedDuration', ask them directly: "How many minutes will this take?" and wait for an explicit numeric reply. Do NOT infer or guess the duration; do not proceed without it.

EFFORT RULE:
- If the user does not provide 'effort', the assistant (LLM) MUST choose and include a value (integer 1-5) based on task length, category, and complexity. The assistant should NOT rely on hardcoded defaults; include the selected effort when calling preview_task or add_task. NEVER leave 'effort' empty or null.`;
}
