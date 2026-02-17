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

test("repairs and parses malformed widget JSON with subtasks and missing closing brace", async () => {
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
  assert.strictEqual(parsed.taskname, "שיעורי בית בלמידת מכונה");
  assert.ok(Array.isArray(parsed.subtasks));
  assert.strictEqual(parsed.subtasks.length, 3);
  assert.strictEqual(parsed.subtasks[2].minutes, 300);
});
