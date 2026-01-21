import { widgetRegistry } from "./registry.js";
import { sanitizeDisplayStringsDeep } from "../../utils/illegalChars.js";

const TASK_FIELDS = [
  "id",
  "title",
  "taskname",
  "description",
  "status",
  "dueDate",
  "deadline",
  "estimatedDuration",
  "duration",
  "importance",
  "effort",
  "priorityScore",
  "progressPercentage",
  "taskType",
  "minChunk",
  "chunkCount",
  "chunkMinutes",
  "minMinutes",
  "maxMinutes",
  "earliestStart",
  "category",
  "categoryDisplay",
  "subcategory",
  "subcategoryDisplay",
  "subCategory",
  "canSplit",
  "tags",
  "scheduledSessions",
];

const SCHEDULE_FIELDS = [
  "taskId",
  "id",
  "start",
  "end",
  "minutes",
  "status",
  "subtaskIndex",
  "subtaskId",
  "subtaskTitle",
  "subtaskStatus",
];

function normalizeScheduleSession(session = {}) {
  const out = { ...session };
  SCHEDULE_FIELDS.forEach((key) => {
    if (!(key in out)) out[key] = null;
  });
  return out;
}

function normalizeTaskItem(task = {}) {
  const out = { ...task };
  TASK_FIELDS.forEach((key) => {
    if (!(key in out)) out[key] = null;
  });
  if (Array.isArray(out.scheduledSessions)) {
    out.scheduledSessions = out.scheduledSessions.map(normalizeScheduleSession);
  } else if (out.scheduledSessions == null) {
    out.scheduledSessions = [];
  }
  return out;
}

function normalizeTaskList(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task) => normalizeTaskItem(task));
}

function normalizeUpcomingGroup(group) {
  if (!group || typeof group !== "object") {
    return { date: null, tasks: [] };
  }
  return {
    ...group,
    date: group.date || null,
    tasks: normalizeTaskList(group.tasks),
  };
}

function normalizeWidgetData(widgetType, data = {}) {
  if (!data || typeof data !== "object") return data;

  if (widgetType === "list") {
    const listType = data.listType || data.list_type || null;
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    return {
      ...data,
      listType,
      tasks,
      taskId: data.taskId || null,
      title: data.title || null,
      days: data.days ?? null,
      filters: data.filters || null,
    };
  }

  if (widgetType === "task_list" || widgetType === "task_list_detailed") {
    return { ...data, tasks: normalizeTaskList(data.tasks) };
  }

  if (widgetType === "task_detail") {
    const task = data.task ? normalizeTaskItem(data.task) : normalizeTaskItem(data);
    return { ...data, task };
  }

  if (widgetType === "task_confirmation") {
    const normalized = normalizeTaskItem(data);
    if (normalized.progressPercentage === null || normalized.progressPercentage === undefined) {
      normalized.progressPercentage = 0;
    }
    return normalized;
  }

  if (widgetType === "upcoming_tasks") {
    return {
      ...data,
      days: data.days ?? null,
      today: normalizeUpcomingGroup(data.today),
      upcoming: Array.isArray(data.upcoming) ? data.upcoming.map(normalizeUpcomingGroup) : [],
    };
  }

  return data;
}

/**
 * Ensure the provided data object contains all keys listed in the widget
 * definition schema. Missing keys are added with null values. This enforces
 * the 'exact fields' requirement and case-sensitive keys from registry.
 */
export function ensureWidgetFields(widgetType, data = {}) {
  const def = widgetRegistry.get(widgetType);
  if (!def) return data;

  const schemaKeys = Object.keys(def.schema || {});
  const out = { ...data };

  schemaKeys.forEach((key) => {
    if (!(key in out)) {
      out[key] = null;
    }
  });

  return out;
}

/**
 * Build a canonical widget string with proper tags and JSON structure.
 * Always uses version "1.0" and places `widget_type` and `data` keys exactly.
 * Returns a string ready to embed in an assistant message.
 */
export function buildWidgetString(widgetType, data = {}) {
  const normalizedData = normalizeWidgetData(widgetType, data);
  const canonicalData = ensureWidgetFields(widgetType, normalizedData);
  const safeData = sanitizeDisplayStringsDeep(canonicalData);
  const payload = {
    version: "1.0",
    widget_type: widgetType,
    data: safeData,
  };

  // JSON.stringify with stable ordering - use Object.keys to ensure order
  const ordered = {};
  Object.keys(payload).forEach((k) => {
    ordered[k] = payload[k];
  });

  const jsonString = JSON.stringify(ordered);

  return `<WIDGET_JSON>${jsonString}</WIDGET_JSON>`;
}

/**
 * Tolerant parser/fixer for incoming LLM messages: if a message contains
 * an opening <WIDGET_JSON> but a malformed closing tag (e.g., </WWIDGET_JSON>),
 * attempt to correct it to </WIDGET_JSON> before parsing. Also validates
 * the JSON and returns null if parsing fails.
 */
export function extractWidgetFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Quick fix: replace common misspellings of the closing tag
  const fixed = text.replace(/<\s*\/?\s*W[^>]*JSON\s*>/gi, (m) => {
    // Normalize to either opening or correct closing tag
    return m.startsWith("</") ? "</WIDGET_JSON>" : "<WIDGET_JSON>";
  });

  const match = fixed.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  if (!match) return null;

  try {
    return JSON.parse(match[1].trim());
  } catch (err) {
    console.warn("[widgetUtils] Failed to parse widget JSON:", err.message);
    return null;
  }
}
