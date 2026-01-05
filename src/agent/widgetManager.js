/**
 * ========================================
 * WIDGET REGISTRY
 * ========================================
 *
 * Defines the available UI widgets that the agent can render.
 * Each widget has a schema and a prompt description.
 */

export const WIDGETS = {
  task_list: {
    type: "task_list",
    description: "Display a list of tasks with checkboxes and details.",
    schema: {
      tasks: "Array of task objects { id, title, status, dueDate, priority }",
    },
  },
  task_detail: {
    type: "task_detail",
    description: "Display a single task with full details (title, description, due date, priority, tags, status).",
    schema: {
      task: "Task object { id, title, description, status, dueDate, priority, tags }",
    },
  },
  task_list_detailed: {
    type: "task_list_detailed",
    description:
      "Display a list of tasks with ALL fields shown (title, description, due date, priority, tags, status). Use this when the user wants to see full details of multiple tasks.",
    schema: {
      tasks: "Array of task objects { id, title, description, status, dueDate, priority, tags }",
    },
  },
  confirmation: {
    type: "confirmation",
    description: "Ask for user confirmation before a critical action.",
    schema: {
      message: "The question to ask the user",
      confirmLabel: "Label for the confirm button (default: Yes)",
      cancelLabel: "Label for the cancel button (default: No)",
      actionId: "ID to reference the action if confirmed",
    },
  },
  calendar_event: {
    type: "calendar_event",
    description: "Show a calendar event card.",
    schema: {
      title: "Event title",
      start: "ISO start time",
      end: "ISO end time",
      location: "Location string",
    },
  },
  task_confirmation: {
    type: "task_confirmation",
    description: "Show a task draft with all details and Confirm/Cancel buttons.",
    schema: {
      id: "Draft task ID",
      title: "Task title",
      status: "Task status (draft)",
      dueDate: "ISO due date",
      priority: "Priority level (high/medium/low)",
      tags: "Array of category tags",
      description: "Task description",
      importance: "Importance level 1-5",
      effort: "Effort level 1-5",
      estimatedDuration: "Estimated minutes",
      canSplit: "Boolean can be split",
      confirmLabel: "Label for confirm button",
      cancelLabel: "Label for cancel button",
    },
  },
};

/**
 * Widget Manager - Centralized registry and policy for widgets
 */
export class WidgetManager {
  /**
   * Get the prompt instructions for all registered widgets
   * @returns {string} Formatted instructions for the system prompt
   */
  static getPromptInstructions() {
    let instructions = `WIDGET OUTPUT (REQUIRED FOR TASK LISTS):
When displaying tasks, you MUST use a widget.
Append a JSON payload wrapped in <WIDGET_JSON> tags at the end of your response.

EXAMPLE - When user asks to see tasks:
הנה המשימות שלך:
<WIDGET_JSON>
{"version":"1.0","widget_type":"task_list","data":{"tasks":[{"id":"abc","title":"Task name","dueDate":"2026-01-15","status":"todo"}]}}
</WIDGET_JSON>

FORMAT:
<WIDGET_JSON>
{"version":"1.0","widget_type":"TYPE","data":{...}}
</WIDGET_JSON>

AVAILABLE WIDGET TYPES:`;

    for (const [key, widget] of Object.entries(WIDGETS)) {
      instructions += `\n- ${key}: ${widget.description}`;
    }

    return instructions;
  }

  /**
   * Policy hook to decide if a widget should be suggested based on context
   * (Currently unused, but ready for future logic)
   * @param {Object} context - Analysis of the current turn
   * @returns {string|null} Suggested widget type or null
   */
  static shouldSuggestWidget(context) {
    // Example logic:
    // if (context.intent === 'list_tasks') return 'task_list';
    return null;
  }
}
