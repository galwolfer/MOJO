import { WidgetDefinition } from "./WidgetDefinition.js";

export class WidgetRegistry {
  constructor(definitions = []) {
    this.definitions = new Map();
    definitions.forEach((definition) => this.register(definition));
  }

  register(definition) {
    if (!definition) return;
    this.definitions.set(definition.type, definition);
  }

  get(type) {
    return this.definitions.get(type);
  }

  list() {
    return Array.from(this.definitions.values());
  }

  toObject() {
    const result = {};
    this.list().forEach((definition) => {
      result[definition.type] = definition.toRecord();
    });
    return result;
  }
}

export const widgetRegistry = new WidgetRegistry([
  new WidgetDefinition({
    type: "task_list",
    description: "Display a list of tasks with checkboxes and details.",
    schema: {
      tasks: "Array of task objects { id, title, status, dueDate, importance }",
    },
  }),
  new WidgetDefinition({
    type: "task_detail",
    description:
      "Display a single task with full details (title, description, due date, category, subcategory, priority, tags, status).",
    schema: {
      task: "Task object { id, title, description, status, dueDate, category, subcategory, importance, effort, estimatedDuration, canSplit, tags }",
    },
  }),
  new WidgetDefinition({
    type: "task_list_detailed",
    description:
      "Display a list of tasks with ALL fields shown (title, description, due date, category, subcategory, priority, importance, effort, tags, status). Use this when the user wants to see full details of multiple tasks.",
    schema: {
      tasks:
        "Array of task objects { id, title, description, status, dueDate, importance, effort, estimatedDuration, canSplit, tags }",
    },
  }),
  new WidgetDefinition({
    type: "confirmation",
    description: "Ask for user confirmation before a critical action.",
    schema: {
      message: "The question to ask the user",
    },
  }),
  new WidgetDefinition({
    type: "calendar_event",
    description: "Show a calendar event card.",
    schema: {
      title: "Event title",
      start: "ISO start time",
      end: "ISO end time",
      location: "Location string",
    },
  }),
  new WidgetDefinition({
    type: "task_confirmation",
    description: "Show a task draft with all details.",
    schema: {
      id: "Draft task ID",
      title: "Task title",
      status: "Task status (draft)",
      dueDate: "ISO due date",
      category: "REQUIRED: Primary category (one of 18 standard categories)",
      subcategory: "REQUIRED: Specific subcategory (from get_subcategories result)",
      importance: "Importance level 1-5",
      effort: "Effort level 1-5",
      estimatedDuration: "Estimated minutes",
      canSplit: "Boolean can be split",
      taskType: "Task splitting strategy (perfect/in_parts/leaky)",
      tags: "Legacy tags array (optional)",
      description: "Task description",
    },
  }),
]);

export const WIDGETS = widgetRegistry.toObject();
