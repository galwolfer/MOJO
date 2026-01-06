// scripts/debug_plan.js
// Run this with: npm run debug:plan
// Make sure server is NOT running (this connects to DB directly)

import mongoose from "mongoose";
import { config } from "dotenv";
import { Task } from "../src/models/Task.js";
import { User } from "../src/models/User.js";
import { generatePlan } from "../src/services/schedulingService.js";

config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Find user Yonatan
  const user = await User.findOne({ username: "Yonatan" });
  if (!user) {
    console.log("User Yonatan not found");
    process.exit(1);
  }
  console.log("User:", user.username, user._id);
  console.log("Profile:", JSON.stringify(user.profile, null, 2));

  // Find their tasks
  const tasks = await Task.find({ userId: user._id, status: { $in: ["todo", "in_progress"] } }).lean();
  console.log("\nTasks:");
  for (const t of tasks) {
    console.log(`  - ${t.taskname}: ${t.estimatedDuration}min, type=${t.taskType}, canSplit=${t.canSplit}, min=${t.minMinutes}, max=${t.maxMinutes}, due=${t.dueDate}`);
  }

  console.log("\n--- Running generatePlan ---\n");

  const result = await generatePlan({
    userId: user._id,
    profile: user.profile || {},
  });

  console.log("\n--- Result ---");
  console.log("Plan:", result.plan.length, "items");
  if (result.plan.length > 0) {
    for (const p of result.plan) {
      console.log(`  ${p.date} ${p.start.toTimeString().slice(0,5)}-${p.end.toTimeString().slice(0,5)} ${p.title} (${p.minutes}m)`);
    }
  }
  console.log("Unscheduled:", result.unscheduled.length, "items");
  for (const u of result.unscheduled) {
    console.log(`  - ${u.title}: ${u.remainingMinutes}min remaining`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
