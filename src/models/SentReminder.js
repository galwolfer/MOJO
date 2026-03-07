/*
 * File: src/models/SentReminder.js
 * Purpose: Tracks sent task reminder notifications to prevent duplicates.
 *          Uses a MongoDB TTL index to auto-expire records after 6 hours.
 */
import mongoose from "mongoose";

const sentReminderSchema = new mongoose.Schema({
  // Unique dedup key: includes taskId + targetTime + windowMinutes (+ subtaskIndex)
  key: { type: String, required: true, unique: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  taskName: { type: String, default: null }, // denormalized task name for easy viewing
  subtaskIndex: { type: Number, default: null },
  subtaskTitle: { type: String, default: null }, // denormalized subtask title for easy viewing
  windowMinutes: { type: Number, required: true }, // which reminder window was sent (e.g. 180, 90, 30)
  targetTime: { type: Date, default: null }, // the schedule/due time this reminder was for
  source: { type: String, enum: ["schedule", "dueDate"], default: "dueDate" },
  sentAt: { type: Date, default: Date.now, required: true },
});

// Auto-delete documents 6 hours after sentAt (MongoDB TTL index)
sentReminderSchema.index({ sentAt: 1 }, { expireAfterSeconds: 6 * 60 * 60 });

export const SentReminder = mongoose.model("SentReminder", sentReminderSchema);
