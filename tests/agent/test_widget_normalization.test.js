import test from "node:test";
import assert from "node:assert";
import { setupAgentTests } from "./setup.js";
import { User } from "../../src/models/User.js";
import { AgentController } from "../../src/agent/agentController.js";

setupAgentTests();

test("_handleToolExecutionResult normalizes misspelled 'importance' to 'importance'", async () => {
  const user = await User.create({
    username: "normuser1",
    email: "norm1@example.com",
    passwordHash: "x",
    profile: { priorities: { study_and_education: 4 } },
  });

  const controller = new AgentController("test_key");
  const sessionId = "s1";
  const toolCall = { id: "tc1", name: "preview_task" };
  const tool = { name: "preview_task" };
  const rawWidget = `<WIDGET_JSON>
{
  "version": "1.0",
  "widget_type": "task_confirmation",
  "data": {
    "id": "d123",
    "title": "Draft",
    "taskname": "שיעורי בית בלמידת מכונה",
    "deadline": "2026-01-29",
    "dueDate": "2026-01-29T00:00:00.000Z",
    "duration": 300,
    "category": "study_and_education",
    "subcategory": "שיעורי בית בבינה מלאכותית",
    "canSplit": true,
    "chunkCount": 5,
    "chunkMinutes": 60,
    "effort": 4,
    "importance": 2
  }
}
</WIDGET_JSON>`;

  const res = await controller._handleToolExecutionResult(
    sessionId,
    user._id.toString(),
    toolCall,
    tool,
    rawWidget,
    [],
  );
  assert.ok(res && res.finalResponse, "expected a finalResponse");
  const widgetJsonMatch = res.finalResponse.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  assert.ok(widgetJsonMatch, "expected widget block in finalResponse");
  const parsed = JSON.parse(widgetJsonMatch[1]);
  assert.strictEqual(parsed.data.importance, 2);
});

test("_handleToolExecutionResult fills missing importance from user's category preference", async () => {
  const user = await User.create({
    username: "normuser2",
    email: "norm2@example.com",
    passwordHash: "x",
    profile: { priorities: { study_and_education: 5 } },
  });

  const controller = new AgentController("test_key");
  const sessionId = "s2";
  const toolCall = { id: "tc2", name: "preview_task" };
  const tool = { name: "preview_task" };
  // missing `importance` entirely and also missing closing brace for payload
  const rawWidget = `<WIDGET_JSON>
{
  "version": "1.0",
  "widget_type": "task_confirmation",
  "data": {
    "id": "d124",
    "title": "Draft",
    "taskname": "שיעורי בית בלמידת מכונה",
    "deadline": "2026-01-29",
    "dueDate": "2026-01-29T00:00:00.000Z",
    "duration": 300,
    "category": "study_and_education",
    "subcategory": "שיעורי בית בבינה מלאכותית",
    "canSplit": true,
    "chunkCount": 5,
    "chunkMinutes": 60,
    "effort": 4
  }
}
</WIDGET_JSON>`; // Now well-formed JSON

  const res = await controller._handleToolExecutionResult(
    sessionId,
    user._id.toString(),
    toolCall,
    tool,
    rawWidget,
    [],
  );
  assert.ok(res && res.finalResponse, "expected a finalResponse");
  const widgetJsonMatch = res.finalResponse.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  assert.ok(widgetJsonMatch, "expected widget block in finalResponse");
  const parsed = JSON.parse(widgetJsonMatch[1]);
  // Importance should be filled with user's preference (5)
  assert.strictEqual(parsed.data.importance, 5);
});
