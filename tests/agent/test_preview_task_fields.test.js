import test from "node:test";
import assert from "node:assert";
import { setupAgentTests } from "./setup.js";
import { User } from "../../src/models/User.js";
import previewTaskMission from "../../src/agent/missions/previewTask.js";

setupAgentTests();

test("preview_task returns widget JSON containing all expected fields and uses user category importance when not provided", async () => {
  // Create user with explicit per-category importance for study_and_education
  const user = await User.create({
    username: "testuser1",
    email: "testuser1@example.com",
    passwordHash: "x",
    profile: { priorities: { study_and_education: 5 } },
  });

  const args = {
    taskname: "Machine Learning Homework",
    deadline: "2026-01-29",
    category: "study_and_education",
    subcategory: "AI Homework",
    duration: 300,
    canSplit: true,
    chunkCount: 5,
    chunkMinutes: 60,
    effort: 4,
    // Note: intentionally omitting `importance` so previewTask will fetch user's category importance
  };

  const out = await previewTaskMission.execute({ userId: user._id.toString(), args });

  // The mission returns raw JSON payload string (not wrapped in <WIDGET_JSON> tags)
  assert.ok(typeof out === "string" || typeof out === "object");

  // Parse if it's a string
  const payload = typeof out === "string" ? JSON.parse(out) : out;
  const data = payload.data || payload;

  // Check presence of fields (inside `data`)
  assert.strictEqual(data.taskname, args.taskname);
  assert.strictEqual(data.deadline, "2026-01-29");
  assert.strictEqual(data.category, args.category);
  assert.strictEqual(data.subcategory, args.subcategory);
  assert.strictEqual(data.duration, args.duration);
  assert.strictEqual(data.chunkCount, args.chunkCount);
  assert.strictEqual(data.chunkMinutes, args.chunkMinutes);
  assert.strictEqual(data.effort, args.effort);

  // Importance should be filled from user's per-category priority (5)
  assert.strictEqual(data.importance, 5);
});
