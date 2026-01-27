import test from "node:test";
import assert from "node:assert";
import { okTrue, okFalse } from "../../src/agent/lib/errorFormatter.js";

test("okTrue formatting", () => {
  const s = okTrue({ msg: "Saved", id: "123", count: 2 });
  assert.ok(s.startsWith("ok=true"));
  assert.ok(s.includes('msg="Saved"'));
  assert.ok(s.includes('id="123"'));
  assert.ok(s.includes("count=2"));
});

test("okFalse formatting", () => {
  const s = okFalse("illegal_characters", { msg: "Bad chars", list: "- a\n- b" });
  assert.ok(s.startsWith("ok=false"));
  assert.ok(s.includes('err="illegal_characters"'));
  assert.ok(s.includes('msg="Bad chars"'));
  assert.ok(s.includes('list="- a\n- b"'));
});
