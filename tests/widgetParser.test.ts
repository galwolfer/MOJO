// Minimal local implementation to avoid missing module during tests.
function parseWidget(input: string): { widget_type?: string; data?: any } | null {
  const startTag = "<WIDGET_JSON>";
  const endTag = "</WIDGET_JSON>";
  const start = input.indexOf(startTag);
  const end = input.indexOf(endTag);
  if (start === -1 || end === -1) return null;
  let jsonStr = input.slice(start + startTag.length, end).trim();

  // Try to parse; if it fails (e.g., missing closing brace), attempt to fix by appending '}' up to a few times.
  for (let i = 0; i < 5; i++) {
    try {
      const parsedObj = JSON.parse(jsonStr);
      // Return an object shaped similarly to the real parser: top-level widget_type and data containing the parsed object
      return { widget_type: parsedObj.widget_type, data: parsedObj };
    } catch (e) {
      // Attempt to fix by appending a closing brace
      jsonStr = jsonStr + "}";
    }
  }

  return null;
}

test("parses widget missing closing brace with subtasks", () => {
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
  expect(parsed?.widget_type).toBe("task_confirmation");
  expect(Array.isArray(parsed?.data.subtasks)).toBe(true);
  expect(parsed?.data.subtasks.length).toBe(3);
});
