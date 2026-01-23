import test from "node:test";
import assert from "node:assert";
import { extractWidgetFromText } from "../../src/agent/widgets/widgetUtils.js";

test("repairs and parses malformed widget JSON (missing closing brace)", async () => {
  const malformed = `<WIDGET_JSON>
{
  "widget_type": "task_confirmation",
  "taskname": "כדורסל",
  "deadline": "2026-01-24",
  "category": "hobbies",
  "subcategory": "כדורסל",
  "duration": 180,
  "canSplit": false,
  "effort": 4
</WIDGET_JSON>`;

  const parsed = extractWidgetFromText(malformed);
  assert.ok(parsed, "parsed widget must not be null");
  assert.strictEqual(parsed.widget_type, "task_confirmation");
  assert.strictEqual(parsed.taskname, "כדורסל");
  assert.strictEqual(parsed.subcategory, "כדורסל");
  assert.strictEqual(parsed.duration, 180);
  assert.strictEqual(parsed.canSplit, false);
  assert.strictEqual(parsed.effort, 4);
});