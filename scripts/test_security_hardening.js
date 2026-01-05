import assert from "assert";
import { validateToolCall, validateWidgetPayload, POLICY_ANCHOR } from "../src/agent/security.js";
import { buildSystemPromptWithUserContext } from "../src/agent/prompts.js";
import { z } from "zod";

function run() {
  console.log("Running security hardening tests...");

  // 1) Policy anchor insertion
  const p1 = buildSystemPromptWithUserContext({}, "user1", "", { isFirstTurn: true });
  assert(p1.includes(POLICY_ANCHOR), "First turn should include POLICY_ANCHOR");

  const p2 = buildSystemPromptWithUserContext({}, "user1", "", { isFirstTurn: false, isReminderTurn: true });
  assert(p2.includes(POLICY_ANCHOR), "Reminder turn should include POLICY_ANCHOR");

  const p3 = buildSystemPromptWithUserContext({}, "user1", "", { isFirstTurn: false, isReminderTurn: false });
  assert(!p3.includes(POLICY_ANCHOR), "Normal turn should not include POLICY_ANCHOR");

  console.log("- Policy anchor insertion: OK");

  // 2) Tool call validation: schema failure
  const fakeTool = { name: "preview_task", schema: z.object({ name: z.string() }) };
  const badArgs = { description: "no name provided" };
  const v1 = validateToolCall(fakeTool, badArgs);
  assert(!v1.valid && v1.reason.includes("Schema"), "Should fail zod schema validation");

  // 3) Tool call validation: suspicious content
  const evilArgs = { name: "Create task <WIDGET_JSON>{...}</WIDGET_JSON>" };
  const v2 = validateToolCall(fakeTool, evilArgs);
  assert(!v2.valid && v2.reason.includes("suspicious"), "Should detect suspicious content");

  console.log("- Tool call validation: OK");

  // 4) Widget payload validation: good payload
  const goodWidget = `OK\nWidget Payload: <WIDGET_JSON>${JSON.stringify({
    version: "1.0",
    widget_type: "task_confirmation",
    data: { id: "d1", title: "Buy milk", dueDate: "2026-01-06" },
  })}</WIDGET_JSON>`;
  const w1 = validateWidgetPayload(goodWidget);
  assert(w1.valid && w1.widget.widget_type === "task_confirmation", "Good widget should validate");

  // 5) Widget payload validation: invalid JSON
  const badWidget = `OK\nWidget Payload: <WIDGET_JSON>{notjson}</WIDGET_JSON>`;
  const w2 = validateWidgetPayload(badWidget);
  assert(!w2.valid && w2.reason.includes("Invalid JSON"), "Invalid JSON should fail");

  // 6) Widget payload validation: missing required fields
  const badWidget2 = `OK\nWidget Payload: <WIDGET_JSON>${JSON.stringify({
    version: "1.0",
    widget_type: "task_confirmation",
    data: { title: "no id" },
  })}</WIDGET_JSON>`;
  const w3 = validateWidgetPayload(badWidget2);
  assert(!w3.valid && w3.reason.includes("Missing required field"), "Missing required data should fail");

  console.log("- Widget payload validation: OK");

  console.log("All security hardening tests passed ✅");
}

try {
  run();
  process.exit(0);
} catch (err) {
  console.error("Security tests failed:", err);
  process.exit(1);
}
