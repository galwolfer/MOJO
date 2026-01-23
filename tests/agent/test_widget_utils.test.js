import test from "node:test";
import assert from "node:assert";
import { wrapRawWidgetJsonInTags, extractWidgetFromText } from "../../src/agent/widgets/widgetUtils.js";

test("wraps raw JSON widget payloads with tags", async () => {
  const raw = JSON.stringify({ version: "1.0", widget_type: "task_confirmation", data: { id: "d1", title: "T" } });
  const out = wrapRawWidgetJsonInTags(raw);
  assert.ok(out.includes("<WIDGET_JSON>"), "should include opening tag");
  assert.ok(out.includes("</WIDGET_JSON>"), "should include closing tag");
  const parsed = extractWidgetFromText(out);
  assert.ok(parsed, "parsed widget must not be null");
  assert.strictEqual(parsed.widget_type, "task_confirmation");
  assert.strictEqual(parsed.data.id, "d1");
});

test("fixes malformed WIDGET_JSON{...}/ variant", async () => {
  const malformed = `Here is your draft:\nWIDGET_JSON${JSON.stringify({ version: "1.0", widget_type: "task_confirmation", data: { id: "x", title: "Hi" } })}/`;
  const out = wrapRawWidgetJsonInTags(malformed);
  assert.ok(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/.test(out), "should convert malformed variant to proper tags");
  const parsed = extractWidgetFromText(out);
  assert.ok(parsed);
  assert.strictEqual(parsed.data.id, "x");
});

test("preserves surrounding text when wrapping JSON", async () => {
  const before = "אופק, מכיוון שמדובר במשימה ארוכה";
  const raw = JSON.stringify({ version: "1.0", widget_type: "task_confirmation", data: { id: "d2", title: "D2" } });
  const out = wrapRawWidgetJsonInTags(`${before}\n${raw}`);
  assert.ok(out.startsWith(before));
  const parsed = extractWidgetFromText(out);
  assert.strictEqual(parsed.data.id, "d2");
});
