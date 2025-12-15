import mongoose from "mongoose";

const taskScheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    minutes: { type: Number, required: true },
    status: { type: String, enum: ["planned", "completed", "skipped"], default: "planned" },
  },
  { timestamps: true }
);

taskScheduleSchema.index({ userId: 1, start: 1 });
taskScheduleSchema.index({ taskId: 1, start: 1 });

export const TaskSchedule = mongoose.model("TaskSchedule", taskScheduleSchema);
