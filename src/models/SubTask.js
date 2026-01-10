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

export const SubTask = mongoose.model("SubTask", subTaskSchema);
