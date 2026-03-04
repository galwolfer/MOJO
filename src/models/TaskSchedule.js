/*
 * File: src/models/TaskSchedule.js
 * Purpose: Stores scheduled task sessions and time allocations
 */
import mongoose from "mongoose";

const taskScheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    subtaskIndex: { type: Number, min: 1 }, // optional: links to SubTask.index (e.g., Part 1, Part 2)
    subtaskTitle: { type: String }, // Subtask title (e.g., "Research", "Writing", "Editing")
    description: { type: String }, // Subtask description (e.g., "its harddd")
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    minutes: { type: Number, required: true },
    status: { type: String, enum: ["planned", "completed", "skipped"], default: "planned" },
    /** True when the user manually set this session via the schedule editor; the auto-scheduler will not delete it */
    manuallyScheduled: { type: Boolean, default: false },
    /**
     * Deterministic SHA-256 fingerprint: SHA256("userId|taskId|start.iso|end.iso|subtaskIndex")
     * Used as a DB-level unique guard against duplicate sessions.
     * NOT sparse — every session must carry a hash so the unique constraint covers all rows.
     * Run the migration script (scripts/migrate-session-hashes.js) once to backfill legacy rows.
     */
    sessionHash: { type: String, index: { unique: true, sparse: false } },
  },
  { timestamps: true }
);

taskScheduleSchema.index({ userId: 1, start: 1 });
taskScheduleSchema.index({ taskId: 1, start: 1 });

export const TaskSchedule = mongoose.model("TaskSchedule", taskScheduleSchema);
