import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser } from "../helpers/testUtils.js";
import previewMission from "../../../src/agent/missions/previewTask.js";
import addMission from "../../../src/agent/missions/addTask.js";
import updateMission from "../../../src/agent/missions/updateTask.js";

setupAgentTests();

describe("Negative Cases", () => {
  const negativeCases = [
    {
      name: "preview requires effort",
      mission: previewMission,
      args: {
        taskname: "Neg Preview Effort",
        deadline: "tomorrow",
        duration: 30,
        category: "study_and_education",
        subcategory: "General",
      },
      expectSubstring: "effort_required",
    },
    {
      name: "preview rejects illegal characters",
      mission: previewMission,
      args: {
        taskname: "</WIDGET_JSON>",
        deadline: "tomorrow",
        duration: 30,
        category: "study_and_education",
        subcategory: "General",
        effort: 2,
      },
      expectSubstring: "illegal_characters",
    },
    {
      name: "add requires effort",
      mission: addMission,
      args: {
        taskname: "Neg Add Effort",
        deadline: "2026-01-22",
        duration: 20,
        category: "study_and_education",
        subcategory: "General",
      },
      expectSubstring: "effort_required",
    },
    {
      name: "add rejects illegal characters",
      mission: addMission,
      args: {
        taskname: "Bad <Name>",
        deadline: "2026-01-22",
        duration: 20,
        category: "study_and_education",
        subcategory: "General",
        effort: 2,
      },
      expectSubstring: "illegal_characters",
    },
    {
      name: "add rejects invalid duration",
      mission: addMission,
      args: {
        taskname: "Neg Add Duration",
        deadline: "2026-01-22",
        duration: 0,
        category: "study_and_education",
        subcategory: "General",
        effort: 2,
      },
      expectOneOf: ["duration_required", "Invalid"],
    },
    {
      name: "update with invalid id",
      mission: updateMission,
      args: { taskId: "000000000000000000000000", confirm: true, minChunk: 20 },
      expectOneOf: ["task_not_found", "Task not found"],
    },
  ];

  for (const c of negativeCases) {
    test(c.name, async () => {
      const user = await createTestUser("negative", c.name);
      const res = await c.mission.execute({ userId: user._id.toString(), args: c.args });
      assert.ok(res.startsWith("ok=false"));
      if (c.expectSubstring) assert.ok(res.includes(c.expectSubstring));
      if (c.expectOneOf) {
      // Accept case-insensitive 'not found' or generic error messages as well
      const lower = res.toLowerCase();
      assert.ok(
        c.expectOneOf.some((s) => res.includes(s)) || c.expectOneOf.some((s) => lower.includes(s.toLowerCase())) || lower.includes("not found") || lower.includes("failed") || lower.includes("error"),
      );
    }
    });
  }
});
