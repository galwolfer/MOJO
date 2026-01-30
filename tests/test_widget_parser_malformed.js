// Test for widget parser with malformed JSON (missing closing brace)

/**
 * Attempts to parse JSON, trying to fix common errors like missing closing braces
 */
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    try {
      // Try appending a closing brace
      return JSON.parse(jsonString + "}");
    } catch (e2) {
      try {
        // Try appending two closing braces (nested objects)
        return JSON.parse(jsonString + "}}");
      } catch (e3) {
        throw e;
      }
    }
  }
}

/**
 * Parses the widget JSON and returns structured widget data
 * Returns null if parsing fails
 */
function parseWidget(text) {
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
 * Extracts the raw JSON string from <WIDGET_JSON> tags
 */
function extractWidgetJsonString(text) {
  const normalized = normalizeWidgetTags(text);
  const match = normalized.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  return match ? match[1].trim() : null;
}

function normalizeWidgetTags(text) {
  return text.replace(/<\s*\/?\s*W[^>]*JSON\s*>/gi, (m) => (m.includes("</") ? "</WIDGET_JSON>" : "<WIDGET_JSON>"));
}

/**
 * Splits text into parts: before widget, widget data, after widget
 * Returns { beforeText, widget, afterText }
 */
function splitTextAndWidget(text) {
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
    const widget = {
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

// Mock console.warn to keep output clean or to assert
const originalWarn = console.warn;
console.warn = (...args) => console.log("WARN:", ...args);

// The user's malformed JSON (missing closing brace)
const malformedInput = `
Here is the widget:
<WIDGET_JSON>
{
  "widget_type": "task_confirmation",
  "taskname": "כדורגל",
  "deadline": "2026-01-24",
  "category": "hobbies",
  "subcategory": "כדורגל",
  "duration": 120,
  "canSplit": false,
  "effort": 4
</WIDGET_JSON>
And some text after.
`;

console.log("Testing parseWidget with malformed input...");
const result = parseWidget(malformedInput);
console.log("Result:", JSON.stringify(result, null, 2));

console.log("\nTesting splitTextAndWidget with malformed input...");
const splitResult = splitTextAndWidget(malformedInput);
console.log("Split Result:", JSON.stringify(splitResult, null, 2));

if (result && result.widget_type === "task_confirmation" && result.data.effort === 4) {
  console.log("\nSUCCESS: Parsed malformed widget correctly!");
} else {
  console.log("\nFAILURE: Could not parse malformed widget.");
  process.exit(1);
}
