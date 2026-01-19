/*
 * File: src/models/Session.js
 * Purpose: Session model storing conversation messages and metadata
 */
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
          enum: ["user", "assistant", "system", "function", "tool"],
          required: true,
        },
        content: {
          type: String,
        },
        functionCall: {
          type: mongoose.Schema.Types.Mixed,
        },
        toolCalls: [mongoose.Schema.Types.Mixed],
        tool_call_id: String,
        name: String, // For tool/function results
        // New: indicate which OjoType produced this message (for assistant messages)
        ojoTypeName: {
          type: String,
          index: true,
        },
        ojoTypeDisplayName: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Optional cached count for efficient pagination.
    // Falls back to messages.length if missing for existing documents.
    messageCount: {
      type: Number,
      default: 0,
      index: true,
    },
    // Rolling summary of the conversation
    summary: {
      type: String,
      default: "",
    },
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
