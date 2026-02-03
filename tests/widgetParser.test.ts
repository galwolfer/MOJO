import { parseWidget } from '../utils/widgetParser';

test('parses widget missing closing brace with subtasks', () => {
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

  const parsed = parseWidget(malformed);
  expect(parsed).not.toBeNull();
  expect(parsed?.widget_type).toBe('task_confirmation');
  expect(Array.isArray(parsed?.data.subtasks)).toBe(true);
  expect(parsed?.data.subtasks.length).toBe(3);
});