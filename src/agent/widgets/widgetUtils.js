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
 * Detect raw JSON blobs in free-form text and wrap them with the canonical
 * <WIDGET_JSON>...</WIDGET_JSON> tags when they appear to be widget payloads.
 * Behaviors:
 * - If the text already contains a <WIDGET_JSON> tag, return it unchanged.
 * - Scan for balanced JSON objects; when a JSON object parses and contains
 *   a `widget_type` field (or `version` + `data`), replace that object with
 *   a wrapped widget block.
 * - Also tolerate common malformed variants like `WIDGET_JSON{...}/`.
 */
export function wrapRawWidgetJsonInTags(text) {
  if (!text || typeof text !== "string") return text;

  // If it already contains proper widget tags, nothing to do
  if (/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i.test(text)) return text;

  let out = text;
  const results = [];

  // First, normalize bare 'WIDGET_JSON{' -> marker so we can find the JSON easily
  out = out.replace(/WIDGET_JSON\s*\{/g, "__WIDGET_OPEN__{");

  // Find JSON-looking blocks by scanning for '{' and finding the matching '}'
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    let j = i;
    for (; j < out.length; j++) {
      const ch = out[j];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') {
          inString = true;
        } else if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
    }

    if (j >= out.length) continue; // no matching close

    const candidate = out.slice(i, j + 1);

    // Quick guard: reject extremely large blocks
    if (candidate.length > 20000) continue;

    try {
      const parsed = JSON.parse(candidate);
      // Heuristic: must look like a widget payload
      if (parsed && (parsed.widget_type || (parsed.version && parsed.data))) {
        results.push({ start: i, end: j + 1, json: JSON.stringify(parsed) });
      }
    } catch (e) {
      // Not JSON – skip
    }

    // advance position to avoid nested re-checks
    i = j;
  }

  // Apply replacements from end to front so indices remain valid
  if (results.length > 0) {
    let acc = out;
    for (let k = results.length - 1; k >= 0; k--) {
      const r = results[k];
      acc = acc.slice(0, r.start) + `<WIDGET_JSON>${r.json}</WIDGET_JSON>` + acc.slice(r.end);
    }
    out = acc;
  }

  // Fix common malformed close like '}/' or trailing '/' following JSON
  out = out.replace(/<WIDGET_JSON>([\s\S]*?)\}\s*\//g, (m, p1) => {
    return `<WIDGET_JSON>${p1}}<\/WIDGET_JSON>`;
  });

  // Restore any normalized marker to proper tag if left behind
  out = out.replace(/__WIDGET_OPEN__\{/g, "<WIDGET_JSON>{");

  return out;
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
