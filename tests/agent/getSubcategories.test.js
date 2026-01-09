/**
 * Test: get_subcategories mission
 * Run: node tests/agent/getSubcategories.test.js
 */
import mongoose from "mongoose";
import { User } from "../../src/models/User.js";
import { Task } from "../../src/models/Task.js";
import getSubcategoriesMission from "../../src/agent/missions/getSubcategories.js";
import { env } from "../../src/config/env.js";

const MONGODB_URI = env.MONGODB_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (e) {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  }
}

async function runTests() {
  await connectDB();

  // Create test user
  let user = await User.findOne({ email: "subcat_test@automated.local" });
  if (!user) {
    user = await User.create({ username: "subcat_test", email: "subcat_test@automated.local", passwordHash: "x" });
    console.log("Created test user", user._id);
  } else {
    // Clean up tasks
    await Task.deleteMany({ userId: user._id });
    console.log("Reusing existing test user", user._id);
  }

  // Set user-level subcategories
  user.subCategories = [
    { name: "My Projects", category: 8 }, // creative_projects
    { name: "Machine Learning", category: 0 }, // study_and_education
  ];
  await user.save();

  // Create some tasks with subCategory labels (some duplicates / casing differences)
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

  // Call mission: for study_and_education
  const res1 = await getSubcategoriesMission.execute({
    userId: user._id.toString(),
    args: { category: "study_and_education" },
  });
  if (!res1.startsWith("ok=true")) throw new Error("Expected ok=true for study category");
  const payload1 = res1.split("\n").find((l) => l.startsWith("subcategories="));
  const subs1 = JSON.parse(payload1.replace("subcategories=", ""));

  // Expect merge of user subs and task subs, deduped and normalized by trimming/case (case-insensitive)
  if (!Array.isArray(subs1)) throw new Error("subcategories result not array");
  if (!subs1.some((s) => s.toLowerCase() === "machine learning")) throw new Error("missing 'Machine Learning'");

  console.log("✅ Study category subcategories:", subs1);

  // Call mission: for creative_projects
  const res2 = await getSubcategoriesMission.execute({
    userId: user._id.toString(),
    args: { category: "creative_projects" },
  });
  if (!res2.startsWith("ok=true")) throw new Error("Expected ok=true for creative category");
  const payload2 = res2.split("\n").find((l) => l.startsWith("subcategories="));
  const subs2 = JSON.parse(payload2.replace("subcategories=", ""));

  if (!subs2.some((s) => s.toLowerCase().trim() === "my projects")) throw new Error("missing 'My Projects'");
  if (subs2.length !== new Set(subs2.map((s) => s.trim().toLowerCase())).size) throw new Error("expected deduped list");

  console.log("✅ Creative category subcategories:", subs2);

  console.log("\nAll tests passed ✅");
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
