import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeGender } from "./authController.js";

test("canonicalizeGender handles common variants", () => {
  assert.equal(canonicalizeGender("Non-binary"), "nonbinary");
  assert.equal(canonicalizeGender("non binary"), "nonbinary");
  assert.equal(canonicalizeGender("Non_binary"), "nonbinary");
  assert.equal(canonicalizeGender("nonbinary"), "nonbinary");
  assert.equal(canonicalizeGender("Prefer not to say"), "prefer_not_to_say");
  assert.equal(canonicalizeGender("Prefer_not_to_say"), "prefer_not_to_say");
  assert.equal(canonicalizeGender("Female"), "female");
  assert.equal(canonicalizeGender("Man"), "male");
  assert.equal(canonicalizeGender(null), null);
  assert.equal(canonicalizeGender(undefined), null);
  assert.equal(canonicalizeGender("some invalid value"), null);
});
