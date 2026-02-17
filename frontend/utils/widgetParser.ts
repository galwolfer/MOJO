/**
 * Widget Parser Utility
 * Extracts and parses <WIDGET_JSON> blocks from agent messages
 */

export interface WidgetData {
  version?: string;
  widget_type: string;
  data: Record<string, any>;
}

function normalizeWidgetTags(text: string): string {
  return text.replace(/<\s*\/?\s*W[^>]*JSON\s*>/gi, (m) => (m.includes("</") ? "</WIDGET_JSON>" : "<WIDGET_JSON>"));
}

/**
 * Attempts to parse JSON, trying to fix common errors like missing closing braces
 */
function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Helper: compute unmatched brace/bracket counts while ignoring strings
    function computeDepths(s: string) {
      let braceDepth = 0;
      let bracketDepth = 0;
      let inString = false;
      let escape = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
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
            braceDepth++;
          } else if (ch === "}") {
            braceDepth--;
          } else if (ch === "[") {
            bracketDepth++;
          } else if (ch === "]") {
            bracketDepth--;
          }
        }
      }
      return { braceDepth: Math.max(0, braceDepth), bracketDepth: Math.max(0, bracketDepth) };
    }

    // Attempt 1: If ends with ] but has unclosed braces, insert } before ]
    try {
      const depths = computeDepths(jsonString);
      const trimmedEnd = jsonString.trimEnd();
      const lastChar = trimmedEnd[trimmedEnd.length - 1];

      if (lastChar === "]" && depths.braceDepth > 0) {
        const repaired = jsonString.replace(/\n  \]$/, "\n    }\n  ]\n}");
        return JSON.parse(repaired);
      }
    } catch (e2) {
      // continue
    }

    // Attempt 2: Remove trailing commas and then balance closers
    try {
      let repaired = jsonString.replace(/,\s*([}\]])/g, "$1");
      const depths2 = computeDepths(repaired);
      if (depths2.braceDepth > 0 || depths2.bracketDepth > 0) {
        repaired += "]".repeat(depths2.bracketDepth) + "}".repeat(depths2.braceDepth);
      }
      return JSON.parse(repaired);
    } catch (e3) {
      // continue
    }

    // Fallback: try simple braces as before
    try {
      return JSON.parse(jsonString + "}");
    } catch (e4) {
      try {
        return JSON.parse(jsonString + "}}");
      } catch (e5) {
        throw e;
      }
    }
  }
}

/**
 * Detects if a text contains a widget JSON block
 */
export function hasWidget(text: string): boolean {
  const normalized = normalizeWidgetTags(text);
  return /<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/.test(normalized);
}

/**
 * Extracts the raw JSON string from <WIDGET_JSON> tags
 */
function extractWidgetJsonString(text: string): string | null {
  const normalized = normalizeWidgetTags(text);
  const match = normalized.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
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

    const parsed = safeJsonParse(jsonString);

    // Validate required fields
    if (!parsed.widget_type) {
      console.warn("[widgetParser] Widget missing required field: widget_type");
      return null;
    }

    return {
      version: parsed.version || "1.0",
      widget_type: parsed.widget_type,
      data: parsed.data || parsed,
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
  const normalized = normalizeWidgetTags(text);
  return normalized.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/g, "").trim();
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
  const normalized = normalizeWidgetTags(text);
  const widgetMatch = normalized.match(/([\s\S]*?)<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>([\s\S]*)/);

  if (!widgetMatch) {
    // Check for incomplete widget (streaming) - hide the raw JSON part so user doesn't see code typing out
    const openMatch = normalized.match(/([\s\S]*?)<WIDGET_JSON>([\s\S]*)/);
    if (openMatch) {
      const [, beforeText] = openMatch;
      return {
        beforeText: beforeText.trim(),
        widget: null,
        afterText: "",
      };
    }

    return {
      beforeText: text,
      widget: null,
      afterText: "",
    };
  }

  const [, beforeText, jsonString, afterText] = widgetMatch;

  try {
    const parsed = safeJsonParse(jsonString.trim());
    const widget: WidgetData = {
      version: parsed.version || "1.0",
      widget_type: parsed.widget_type,
      data: parsed.data || parsed,
    };

    return {
      beforeText: beforeText.trim(),
      widget,
      afterText: afterText.trim(),
    };
  } catch (error) {
    console.warn("[widgetParser] Failed to parse widget:", error);
    return {
      beforeText: text, // Return original text if parsing fails (fallback)
      widget: null,
      afterText: "",
    };
  }
}
