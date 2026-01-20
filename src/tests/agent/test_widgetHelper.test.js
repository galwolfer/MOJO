import test from "node:test";
import assert from "node:assert";
import { buildWidget } from "../../agent/lib/widgetHelper.js";

test("buildWidget returns well-formed widget string", async () => {
  const s = buildWidget("task_detail", { task: { id: "t1", title: "Test" } });
  assert.ok(typeof s === "string");
  assert.ok(s.startsWith("<WIDGET_JSON>"));
  const match = s.match(/<WIDGET_JSON>([\s\S]*?)<\/WIDGET_JSON>/);
  assert.ok(match, "widget should contain JSON block");
  const parsed = JSON.parse(match[1]);
  assert.strictEqual(parsed.widget_type, "task_detail");
  assert.ok(parsed.data);
  assert.strictEqual(parsed.data.task.id, "t1");
});
