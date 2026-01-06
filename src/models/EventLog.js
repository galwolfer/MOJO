/*
 * File: src/models/EventLog.js
 * Purpose: Telemetry model for tracking user actions and system events
 */
import mongoose from "mongoose";

const eventLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User who triggered the event
    eventType: { type: String, required: true },                    // Type of event (e.g., "task_added", "recommendation_shown")
    context: { type: String, default: "" },                         // Additional context or description
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },    // Flexible data storage for event-specific details
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only track creation time, no updates needed
  }
);

export default mongoose.model("EventLog", eventLogSchema);
