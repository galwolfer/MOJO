/**
 * Widget Parser Utility
 * Extracts and parses <WIDGET_JSON> blocks from agent messages
 */

export interface WidgetData {
  version?: string;
  widget_type: string;
  data: Record<string, any>;
}

/**
 * Detects if a text contains a widget JSON block
 */
export function hasWidget(text: string): boolean {
  return /<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/.test(text);
}

/**
 * Extracts the raw JSON string from <WIDGET_JSON> tags
 */
function extractWidgetJsonString(text: string): string | null {
  const match = text.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  return match ? match[1].trim() : null;
}

/**
 * Parses the widget JSON and returns structured widget data
 * Returns null if parsing fails
 */
export function parseWidget(text: string): WidgetData | null {
  try {
    const jsonString = extractWidgetJsonString(text);
    if (!jsonString) return null;

    const parsed = JSON.parse(jsonString);

    // Validate required fields
    if (!parsed.widget_type) {
      console.warn("[widgetParser] Widget missing required field: widget_type");
      return null;
    }

    return {
      version: parsed.version || "1.0",
      widget_type: parsed.widget_type,
      data: parsed.data || {},
    };
  } catch (error) {
    console.warn("[widgetParser] Failed to parse widget JSON:", error);
    return null;
  }
}

/**
 * Removes the <WIDGET_JSON> block from text, returning only the text content
 */
export function stripWidgetJson(text: string): string {
  return text.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/g, "").trim();
}

/**
 * Splits text into parts: before widget, widget data, after widget
 * Returns { beforeText, widget, afterText }
 */
export function splitTextAndWidget(text: string): {
  beforeText: string;
  widget: WidgetData | null;
  afterText: string;
} {
  const widgetMatch = text.match(/([\s\S]*?)<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>([\s\S]*)/);

  if (!widgetMatch) {
    return {
      beforeText: text,
      widget: null,
      afterText: "",
    };
  }

  const [, beforeText, jsonString, afterText] = widgetMatch;

  try {
    const parsed = JSON.parse(jsonString.trim());
    const widget: WidgetData = {
      version: parsed.version || "1.0",
      widget_type: parsed.widget_type,
      data: parsed.data || {},
    };

    return {
      beforeText: beforeText.trim(),
      widget,
      afterText: afterText.trim(),
    };
  } catch (error) {
    console.warn("[widgetParser] Failed to parse widget:", error);
    return {
      beforeText: text,
      widget: null,
      afterText: "",
    };
  }
}
