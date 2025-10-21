import mongoose from "mongoose";

/**
 * Memory Schema - Stores user-level memories
 */
const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["general", "conversation", "conversation_summary", "task", "note", "preference"],
      default: "general",
    },
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    source: {
      type: String, // e.g., "chat", "datalake", "manual"
      default: "chat",
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
memorySchema.index({ userId: 1, createdAt: -1 });
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, importance: -1 });

export const Memory = mongoose.model("Memory", memorySchema);
