import test from "node:test";
import assert from "node:assert";
import { extractWidgetFromText } from "../src/agent/widgets/widgetUtils.js";

test("parses widget missing closing brace with subtasks (mirrors TS test)", async () => {
  const malformed = `<WIDGET_JSON>
{
  "widget_type": "task_confirmation",
  "taskname": "שיעורי בית בלמידת מכונה",
  "deadline": "2026-02-05",
  "category": "Study & Education",
  "subcategory": "למידת מכונה",
  "duration": 900,
  "canSplit": true,
  "taskType": "in_parts",
  "effort": 4,
  "subtasks": [
    { "title": "חלק 1", "minutes": 300 },
    { "title": "חלק 2", "minutes": 300 },
    { "title": "חלק 3", "minutes": 300 }
  ]
</WIDGET_JSON>`;

  const parsed = extractWidgetFromText(malformed);
  assert.ok(parsed, "parsed widget must not be null");
  assert.strictEqual(parsed.widget_type, "task_confirmation");
  assert.ok(Array.isArray(parsed.subtasks));
  assert.strictEqual(parsed.subtasks.length, 3);
});
