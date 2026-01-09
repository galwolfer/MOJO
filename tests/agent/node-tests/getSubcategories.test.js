import test from "node:test";
import assert from "node:assert/strict";
import { setupAgentTests } from "../setup.js";
import { createTestUser, parseSubcategories } from "../helpers/testUtils.js";
import getSubcategoriesMission from "../../../src/agent/missions/getSubcategories.js";
import { Task } from "../../../src/models/Task.js";

setupAgentTests();

test("getSubcategories merges and dedupes", async () => {
  const user = await createTestUser("subcat", "merge");
  user.subCategories = [
    { name: "My Projects", category: 8 },
    { name: "Machine Learning", category: 0 },
  ];
  await user.save();

  await Task.create({
    userId: user._id,
    taskname: "Task 1",
    category: "study_and_education",
    subCategory: { label: "machine learning", source: "user", confidence: 1 },
  });
  await Task.create({
    userId: user._id,
    taskname: "Task 2",
    category: "study_and_education",
    subCategory: { label: "Machine Learning", source: "keyword-match", confidence: 0.7 },
  });
  await Task.create({
    userId: user._id,
    taskname: "Task 3",
    category: "creative_projects",
    subCategory: { label: "My Projects", source: "user", confidence: 1 },
  });
  await Task.create({
    userId: user._id,
    taskname: "Task 4",
    category: "creative_projects",
    subCategory: { label: "My Projects ", source: "keyword-match", confidence: 0.5 },
  });

  const res1 = await getSubcategoriesMission.execute({
    userId: user._id.toString(),
    args: { category: "study_and_education" },
  });
  assert.ok(res1.startsWith("ok=true"));
  const subs1 = parseSubcategories(res1);
  assert.ok(Array.isArray(subs1));
  assert.ok(subs1.map((s) => s.toLowerCase()).includes("machine learning"));

  const res2 = await getSubcategoriesMission.execute({
    userId: user._id.toString(),
    args: { category: "creative_projects" },
  });
  assert.ok(res2.startsWith("ok=true"));
  const subs2 = parseSubcategories(res2);
  assert.ok(subs2.some((s) => s.toLowerCase().trim() === "my projects"));
  assert.strictEqual(subs2.length, new Set(subs2.map((s) => s.trim().toLowerCase())).size);
});
