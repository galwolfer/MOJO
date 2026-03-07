/*
 * File: src/models/InAppNotification.js
 * Purpose: Stores in-app copies of every push notification so the user
 *          can review them inside the app (notification inbox).
 *          Auto-expires after 30 days via a TTL index.
 */
import mongoose from "mongoose";

const inAppNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Notification type matches push types: morning_digest, task_reminder, test, etc.
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: "",
    },
    // Arbitrary data payload (same as push notification data field)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Whether the user has seen / opened this notification
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Optional Ojo personality type (for styled rendering)
    ojoType: {
      type: String,
      enum: ["mentorjo", "brojo", "bestojo", "strictojo", "chat", null],
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for efficient per-user queries sorted by newest first
inAppNotificationSchema.index({ userId: 1, createdAt: -1 });

// Auto-delete documents 30 days after creation
inAppNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const InAppNotification =
  mongoose.models.InAppNotification ||
  mongoose.model("InAppNotification", inAppNotificationSchema);
