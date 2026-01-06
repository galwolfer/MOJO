/*
 * File: src/models/Memory.js
 * Purpose: (Deprecated) Separate memory model for migration/compatibility
 */
import mongoose from "mongoose";

/**
 * Memory Schema - DEPRECATED
 * Memories are now stored embedded within User documents
 * This model is kept for backward compatibility and migration purposes only
 *
 * @deprecated Use User.memories array instead
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
      enum: [
        "profile", // primary memory - user settings
        "preference", // primary memory - user preferences
        "user_fact", // primary memory - facts about the user
        "conversation", // conversation memory - information from chats
        "conversation_summary", // conversation memory - conversation summary
        "task", // conversation memory - tasks
        "note", // conversation memory - notes
        "message", // NEW: raw session message
        "general", // general
      ],
      default: "general",
    },
    category: {
      type: String,
      enum: ["primary", "conversation", "session_message"], // main category
      required: true,
      index: true,
    },
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    // NEW: Priority & Scoring for pruning
    priority: {
      type: Number,
      default: 5,
      index: true,
    },
    recencyWeight: {
      type: Number,
      default: 1.0, // decays over time
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      default: "chat",
    },
    // NEW: For session_message category
    role: {
      type: String,
      enum: ["user", "assistant", "system", "function"],
      default: null,
    },
    functionCall: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    embedding: {
      type: [Number], // Vector embedding stored directly on the Memory
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sessionId: {
      type: String,
      index: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Extended indexes
memorySchema.index({ userId: 1, category: 1, createdAt: -1 });
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, importance: -1 });
memorySchema.index({ userId: 1, category: 1, importance: -1 });
memorySchema.index({ userId: 1, category: 1, priority: -1 }); // NEW: for priority-based retrieval
memorySchema.index({ userId: 1, lastAccessedAt: -1 }); // NEW: for LRU
memorySchema.index({ sessionId: 1, createdAt: 1 }); // NEW: for session message queries

export const Memory = mongoose.model("Memory", memorySchema);
