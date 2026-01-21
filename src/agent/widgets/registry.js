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
    type: "list",
    description:
      "Unified list widget for task displays. Client fetches live data using listType; include minimal IDs/titles for memory.",
    schema: {
      listType:
        'String list type: "task_list", "task_list_detailed", "task_detail", "upcoming_tasks", "overdue_tasks"',
      tasks: "Optional array of minimal task refs { id, title }",
      taskId: "Task ID for task_detail",
      title: "Task title for task_detail",
      days: "Number of days for upcoming_tasks",
      filters: "Optional filters { category, completed, dueBefore, dueAfter, search }",
    },
  }),
  new WidgetDefinition({
    type: "task_list",
    description: "Display a list of tasks with checkboxes and details.",
    schema: {
      tasks:
        "Array of task objects { id, title, status, dueDate, importance, effort, estimatedDuration, category, subcategory, progressPercentage, priorityScore, taskType, subCategory, tags, description, canSplit, scheduledSessions: Array { id, taskId, start, end, minutes, status, subtaskIndex, subtaskId, subtaskTitle, subtaskStatus } }",
    },
  }),
  new WidgetDefinition({
    type: "task_detail",
    description:
      "Display a single task with full details (title, description, due date, category, subcategory, priority, tags, status).",
    schema: {
      task:
        "Task object { id, title, description, status, dueDate, category, subcategory, importance, effort, estimatedDuration, canSplit, taskType, progressPercentage, priorityScore, tags, scheduledSessions: Array { id, taskId, start, end, minutes, status, subtaskIndex, subtaskId, subtaskTitle, subtaskStatus } }",
    },
  }),
  new WidgetDefinition({
    type: "task_list_detailed",
    description:
      "Display a list of tasks with ALL fields shown (title, description, due date, category, subcategory, priority, importance, effort, tags, status). Use this when the user wants to see full details of multiple tasks.",
    schema: {
      tasks:
        "Array of task objects { id, title, description, status, dueDate, importance, effort, estimatedDuration, canSplit, taskType, progressPercentage, priorityScore, category, subcategory, tags, scheduledSessions: Array { id, taskId, start, end, minutes, status, subtaskIndex, subtaskId, subtaskTitle, subtaskStatus } }",
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
    description: "Show a task draft with all details for user confirmation.",
    schema: {
      id: "Draft task ID",
      title: "Task title",
      description: "Task description (optional)",
      status: "Task status (draft)",
      dueDate: "ISO due date",
      category: "Category display name",
      subcategory: "Subcategory name",
      importance: "Importance level 1-5",
      effort: "Effort level 1-5",
      estimatedDuration: "Estimated minutes",
      canSplit: "Boolean can be split",
      taskType: "Splitting strategy (perfect/in_parts/leaky)",
      minChunk: "Min chunk minutes (for in_parts)",
      chunkCount: "Number of chunks (for in_parts)",
      minMinutes: "Min minutes per chunk (for leaky)",
      maxMinutes: "Max minutes per chunk (for leaky)",
      earliestStart: "Earliest start date (optional)",
      recurrence: "Recurrence config object (optional)",
      tags: "Tags array (optional)",
      progressPercentage: "Progress percentage 0-100",
      scheduledSessions: "Optional scheduled sessions (array)",
    },
  }),
  new WidgetDefinition({
    type: "upcoming_tasks",
    description: "Display tasks scheduled for today and the next N days with session times and completion controls.",
    schema: {
      days: "Number of days in the upcoming range",
      today: "Object { date, tasks } for today",
      upcoming: "Array of objects { date, tasks } for future days",
    },
  }),
]);

export const WIDGETS = widgetRegistry.toObject();
