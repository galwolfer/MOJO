import mongoose from "mongoose";

/**
 * Session Schema - Stores conversation sessions
 */
const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant", "system", "function"],
          required: true,
        },
        content: {
          type: String,
        },
        functionCall: {
          type: mongoose.Schema.Types.Mixed,
        },
        name: String, // For function results
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
sessionSchema.index({ userId: 1, lastActiveAt: -1 });
sessionSchema.index({ sessionId: 1, userId: 1 });

export const Session = mongoose.model("Session", sessionSchema);
