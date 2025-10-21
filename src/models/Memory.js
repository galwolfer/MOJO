import mongoose from "mongoose";

/**
 * Memory Schema - Stores user-level memories with embeddings
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
        "profile", // זיכרון ראשי - הגדרות משתמש
        "preference", // זיכרון ראשי - העדפות
        "user_fact", // זיכרון ראשי - עובדות על המשתמש
        "conversation", // זיכרון שיחות - מידע מהשיחות
        "conversation_summary", // זיכרון שיחות - סיכום שיחה
        "task", // זיכרון שיחות - משימות
        "note", // זיכרון שיחות - הערות
        "message", // NEW: הודעת session גולמית
        "general", // כללי
      ],
      default: "general",
    },
    category: {
      type: String,
      enum: ["primary", "conversation", "session_message"], // קטגוריה עיקרית
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
      type: [Number], // Vector embedding מוטמע ישירות ב-Memory
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

// Indexes מורחבים
memorySchema.index({ userId: 1, category: 1, createdAt: -1 });
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, importance: -1 });
memorySchema.index({ userId: 1, category: 1, importance: -1 });
memorySchema.index({ userId: 1, category: 1, priority: -1 }); // NEW: for priority-based retrieval
memorySchema.index({ userId: 1, lastAccessedAt: -1 }); // NEW: for LRU
memorySchema.index({ sessionId: 1, createdAt: 1 }); // NEW: for session message queries

export const Memory = mongoose.model("Memory", memorySchema);
