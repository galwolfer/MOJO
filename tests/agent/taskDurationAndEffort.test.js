/**
 * Test: preview_task & add_task duration and effort behavior
 * Run: node tests/agent/taskDurationAndEffort.test.js
 */
import mongoose from "mongoose";
import { User } from "../../src/models/User.js";
import { Task } from "../../src/models/Task.js";
import previewMission from "../../src/agent/missions/previewTask.js";
import addMission from "../../src/agent/missions/addTask.js";
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

  // Ensure test user exists
  let user = await User.findOne({ email: "subcat_test@automated.local" });
  if (!user) {
    user = await User.create({ username: "subcat_test", email: "subcat_test@automated.local", passwordHash: "x" });
    console.log("Created test user", user._id);
  } else {
    console.log("Reusing existing test user", user._id);
  }

  // Cleanup any prior test tasks with known prefixes
  await Task.deleteMany({ userId: user._id, taskname: /^(Preview|Add) / });

  // 1) preview_task: missing duration -> should require duration
  const res1 = await previewMission.execute({
    args: {
      taskname: "Preview Missing Duration",
      deadline: "tomorrow",
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  if (!res1.startsWith("ok=false") || !res1.includes("duration_required"))
    throw new Error("preview_task should require duration when missing");
  console.log("✅ preview_task missing duration check passed");

  // 2) preview_task: with duration but NO effort -> assistant (LLM) should have provided effort; mission should reject missing effort
  const res2 = await previewMission.execute({
    args: {
      taskname: "Preview With Duration",
      deadline: "tomorrow",
      duration: 90,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  if (!res2.startsWith("ok=false") || !res2.includes("effort_required"))
    throw new Error("preview_task should require effort when missing (LLM must provide it)");
  console.log("✅ preview_task missing effort check passed (mission requires LLM to provide effort)");

  // 2b) preview_task: with duration AND effort provided -> should return widget with that effort
  const res2b = await previewMission.execute({
    args: {
      taskname: "Preview With Duration+Effort",
      deadline: "tomorrow",
      duration: 90,
      effort: 2,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  let widget2;
  try {
    widget2 = JSON.parse(res2b);
  } catch (e) {
    throw new Error(`preview_task expected widget JSON, got: ${res2b}`);
  }
  if (!widget2.data) throw new Error("preview_task widget missing data");
  if (widget2.data.effort !== 2) throw new Error("preview_task should reflect provided effort");
  console.log("✅ preview_task accepts provided effort and includes it in widget (effort=", widget2.data.effort, ")");

  // 3) add_task: missing duration -> should require duration
  const res3 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add Missing Duration",
      deadline: "2026-01-20",
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  if (!res3.startsWith("ok=false") || !res3.includes("duration_required"))
    throw new Error("add_task should require duration when missing");
  console.log("✅ add_task missing duration check passed");

  // 4) add_task: with duration but NO effort -> mission should require effort (LLM must supply it)
  const res4 = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add With Duration",
      deadline: "2026-01-21",
      duration: 45,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  if (!res4.startsWith("ok=false") || !res4.includes("effort_required"))
    throw new Error("add_task should require effort when missing (LLM must provide it)");
  console.log("✅ add_task missing effort check passed (mission requires LLM to provide effort)");

  // 4b) add_task: with duration AND effort provided -> task should be created and saved with the provided effort
  const res4b = await addMission.execute({
    userId: user._id.toString(),
    args: {
      taskname: "Add With Duration+Effort",
      deadline: "2026-01-22",
      duration: 30,
      effort: 4,
      category: "study_and_education",
      subcategory: "Machine Learning",
    },
  });
  if (!res4b.startsWith("ok=true")) throw new Error(`add_task failed unexpectedly when effort provided: ${res4b}`);
  const idLineB = res4b.split("\n").find((l) => l.startsWith("id="));
  if (!idLineB) throw new Error("add_task did not return an id when effort provided");
  const idB = idLineB.replace('id="', "").replace('"', "").trim();
  const taskB = await Task.findById(idB).lean();
  if (!taskB) throw new Error("Task not found after add_task with effort");
  if (taskB.effort !== 4) throw new Error("add_task did not persist provided effort correctly");
  console.log("✅ add_task accepts provided effort and persists it (effort=", taskB.effort, ")");

  // Cleanup created tasks
  await Task.deleteMany({ userId: user._id, taskname: /^(Preview|Add) / });

  console.log("\nAll tests passed ✅");
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
