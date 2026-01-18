import { WIDGETS, POLICY_ANCHOR } from "./agentConfig.js";
import { extractWidgetFromText } from "./widgets/widgetUtils.js";

/**
 * Basic heuristic checks for suspicious input content
 */
function containsSuspiciousToken(val) {
  if (typeof val !== "string") return false;
  const lowered = val.toLowerCase();
  const suspicious = ["<script>", "<widget_json>", "__internal__", "secret", "api_key", "system:"];
  return suspicious.some((t) => lowered.includes(t));
}

/**
 * Validate a tool call against the tool's Zod schema and basic policy checks
 * @param {Object} tool - The tool object (should include .name and .schema)
 * @param {Object} args - The args from the LLM tool_call
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateToolCall(tool, args) {
  if (!tool || !tool.name) return { valid: false, reason: "Unknown tool" };

  // Basic checks: args must be an object
  if (args == null || typeof args !== "object") return { valid: false, reason: "Tool args must be an object" };

  // Heuristic: deny suspicious string content
  for (const [k, v] of Object.entries(args)) {
    if (containsSuspiciousToken(String(v))) {
      return { valid: false, reason: `Argument '${k}' contains suspicious content` };
    }
    if (typeof v === "string" && v.length > 2000) {
      return { valid: false, reason: `Argument '${k}' is too long` };
    }
  }

  // If the tool exposes a Zod schema, use it to parse/validate
  try {
    if (tool.schema && typeof tool.schema.parse === "function") {
      tool.schema.parse(args);
    }
  } catch (err) {
    return { valid: false, reason: `Schema validation failed: ${err.message}` };
  }

  return { valid: true };
}

/**
 * Validate a widget JSON payload string found inside tool output
 * @param {string} raw - The raw tool output string potentially containing <WIDGET_JSON>...</WIDGET_JSON>
 * @returns {{ valid: boolean, reason?: string, widget?: any }}
 */
export function validateWidgetPayload(raw) {
  if (typeof raw !== "string") return { valid: false, reason: "Tool result not a string" };

  const start = raw.indexOf("<WIDGET_JSON>");
  const end = raw.indexOf("</WIDGET_JSON>");
  let payload = null;

  // First try the simple substring approach
  if (!(start === -1 || end === -1 || end < start)) {
    const jsonText = raw.substring(start + "<WIDGET_JSON>".length, end).trim();
    try {
      payload = JSON.parse(jsonText);
    } catch (err) {
      return { valid: false, reason: `Invalid JSON: ${err.message}` };
    }
  }

  // Fallback: tolerant extractor (fix common malformed tags and parse)
  if (!payload) {
    try {
      payload = extractWidgetFromText(raw);
      if (!payload) return { valid: false, reason: "No widget payload found" };
    } catch (err) {
      return { valid: false, reason: "No widget payload found" };
    }
  }

  // Basic structure checks
  if (!payload.version || !payload.widget_type || !payload.data)
    return { valid: false, reason: "Missing required widget fields" };
  if (payload.version !== "1.0") return { valid: false, reason: "Unsupported widget version" };

  const widgetDef = WIDGETS[payload.widget_type];
  if (!widgetDef) return { valid: false, reason: `Unknown widget type: ${payload.widget_type}` };

  // Heuristic checks on data presence for critical widget types
  if (payload.widget_type === "task_confirmation") {
    const required = ["id", "title", "dueDate"];
    for (const r of required) {
      if (!(r in payload.data)) return { valid: false, reason: `Missing required field in task_confirmation: ${r}` };
    }
  }

  // Reject empty task lists to avoid showing widgets with no useful data
  if (payload.widget_type === "task_list") {
    if (!payload.data || !Array.isArray(payload.data.tasks)) {
      return { valid: false, reason: "task_list payload missing tasks array" };
    }
    if (payload.data.tasks.length === 0) {
      // Return parsed widget for special handling by the controller
      return { valid: false, reason: "Empty task list", widget: payload };
    }
  }

  // No suspicious tokens in JSON string
  if (containsSuspiciousToken(JSON.stringify(payload)))
    return { valid: false, reason: "Widget payload contains suspicious tokens" };

  return { valid: true, widget: payload };
}

// Backwards-compatible export
export { POLICY_ANCHOR };
