import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import { getDisplayName } from "../../../src/config/categories.js";

setupAgentTests();

test("preview widget includes shortDescription and categoryDisplay and keeps summary concise", async () => {
  const user = await createTestUser("preview", "formatting");

  const res = await previewMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Computability Homework",
      deadline: "2026-01-12",
      duration: 360,
      category: "study_and_education",
      subcategory: "Computability",
      effort: 4,
      // importance omitted so user's category priority should be applied by mission
      canSplit: true,
      taskType: "in_parts",
      chunkCount: 5,
      minChunk: 30,
    },
  });

  const widget = JSON.parse(res);
  assert.ok(widget.data.shortDescription, "shortDescription should be present");
  // shortDescription should be concise (don't repeat all fields)
  assert.ok(widget.data.shortDescription.length < 140, "shortDescription should be brief");

  const expectedDisplay = getDisplayName("study_and_education");
  assert.strictEqual(widget.data.categoryDisplay, expectedDisplay, "categoryDisplay should show user-friendly name");

  // Ensure internal category key is still present for internal use but not used as user-facing label
  assert.strictEqual(widget.data.category, "study_and_education");

  // Do NOT expose a separate priority string; use numeric 'importance' only
  assert.ok(
    !Object.prototype.hasOwnProperty.call(widget.data, "priority"),
    "widget should not include 'priority' field",
  );
  assert.ok(typeof widget.data.importance === "number", "importance should be present as numeric value");

  // We no longer include a separate confirmationMessage field; UI uses surrounding text instead
  assert.ok(
    !Object.prototype.hasOwnProperty.call(widget.data, "confirmationMessage"),
    "confirmationMessage should not be present",
  );
});
