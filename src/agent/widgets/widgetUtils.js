import { widgetRegistry } from "./registry.js";

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
  const canonicalData = ensureWidgetFields(widgetType, data);
  const payload = {
    version: "1.0",
    widget_type: widgetType,
    data: canonicalData,
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
  const fixed = text.replace(/<\/?W+IDGET_JSON>/gi, (m) => {
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
