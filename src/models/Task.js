// Notes are in English as requested.
import mongoose from "mongoose";
import { updateAllScores } from "../scripts/updateScores.js";
import { detectTags } from "../algorithms/priority/tagging.js";

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskname: { type: String, required: true, trim: true }, // user-facing short name for the task
    description: { type: String, default: "", trim: true },
    dueDate: { type: Date },                 // optional deadline
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    importance: { type: Number, min: 1, max: 5, default: 3 }, // 1=low, 5=high
    effort: { type: Number, min: 1, max: 5, default: 3 },     // 1=small, 5=big
    tags: { type: [String], default: [] },
    estimatedDuration: { type: Number, min: 15, default: 60 }, // minutes
    canSplit: { type: Boolean, default: true },
    minChunk: { type: Number, min: 15, default: 30 },          // minimum chunk length in minutes when splitting
    earliestStart: { type: Date },
    // Cached score so we can sort quickly (optional)
    // add field: user's behaviour default value ineffective
    priorityScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// (add/edit) after each task save
taskSchema.post("save", async function () {
  // When a task is created or updated, recalculate priority scores for all open tasks
  console.log("🧩 Task saved — updating priority scores...");
  await updateAllScores();
});

// (remove) after each task remove
taskSchema.post("remove", async function () {
  // When a task is deleted, recalculate priority scores to keep cache consistent
  console.log("🧩 Task removed — updating priority scores...");
  await updateAllScores();
});

taskSchema.pre("save", function (next) {
  if (!this.isModified("taskname") && !this.isModified("description") && !this.isNew && this.tags?.length) {
    return next();
  }

  const autoTags = detectTags({
    title: this.taskname,
    description: this.description,
    tags: this.tags,
  });

  this.tags = autoTags;
  next();
});

// pre-save hook: auto-detect tags from title/description and save them before persisting

export default mongoose.model("Task", taskSchema);
