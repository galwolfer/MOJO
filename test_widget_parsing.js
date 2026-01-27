import { extractWidgetFromText } from "./src/agent/widgets/widgetUtils.js";

// Test malformed JSON (missing closing brace)
const malformedWidget = `<WIDGET_JSON>
{
  "widget_type": "task_confirmation",
  "taskname": "football",
  "deadline": "2026-01-24",
  "category": "hobbies",
  "subcategory": "football",
  "duration": 180,
  "canSplit": false,
  "effort": 4
</WIDGET_JSON>`;

console.log("Testing malformed widget JSON (missing closing brace):");
const result = extractWidgetFromText(malformedWidget);
console.log("Result:", JSON.stringify(result, null, 2));

if (result) {
  console.log("\n✅ SUCCESS: Widget parsed correctly!");
  console.log("Task name:", result.taskname);
  console.log("Subcategory:", result.subcategory);
  console.log("Duration:", result.duration);
  console.log("Can split:", result.canSplit);
} else {
  console.log("\n❌ FAILED: Could not parse widget");
}
