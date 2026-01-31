import mongoose from "mongoose";

const subTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    index: { type: Number, required: true }, // order within the parent task (1..n)
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    minutes: { type: Number }, // optional estimated/minutes for this subtask
    status: { type: String, enum: ["todo", "done"], default: "todo" },
    completedAt: { type: Date },
    earnedPoints: { type: Number, default: 0 }, // points awarded when subtask was completed (reset to 0 if undone)
  },
  { timestamps: true }
);

subTaskSchema.index({ taskId: 1, index: 1 });
subTaskSchema.index({ userId: 1 });

subTaskSchema.methods.markComplete = function () {
  this.status = "done";
  this.completedAt = new Date();
  return this.save();
};

subTaskSchema.methods.markIncomplete = function () {
  this.status = "todo";
  this.completedAt = undefined;
  return this.save();
};

// Helper: Sync parent Task's progress percentage when subtask changes
async function syncParentTaskProgress(subtaskDoc) {
  try {
    const Task = mongoose.model("Task");
    const task = await Task.findById(subtaskDoc.taskId);
    if (!task) return;

    // Only sync for split tasks
    if (!["in_parts", "leaky"].includes(task.taskType)) return;

    // Get all subtasks for this task
    const subtasks = await SubTask.find({ taskId: task._id }).lean();
    if (subtasks.length === 0) {
      task.progressPercentage = 0;
    } else {
      const completedCount = subtasks.filter((st) => st.status === "done").length;
      task.progressPercentage = Math.round((completedCount / subtasks.length) * 100);
    }

    await task.save();
  } catch (err) {
    console.error("⚠️  syncParentTaskProgress failed:", err && err.message ? err.message : err);
  }
}

// Sync parent progress after subtask is saved
subTaskSchema.post("save", async function () {
  await syncParentTaskProgress(this);
});

// Sync parent progress after subtask is deleted
subTaskSchema.post("deleteOne", async function () {
  await syncParentTaskProgress(this);
});

// Also handle bulk operations
subTaskSchema.post("updateOne", async function () {
  const docToUpdate = await SubTask.findOne(this.getQuery());
  if (docToUpdate) {
    await syncParentTaskProgress(docToUpdate);
  }
});

export const SubTask = mongoose.model("SubTask", subTaskSchema);
