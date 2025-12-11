import mongoose from "mongoose";

/**
 * Memory Sub-Schema
 * Embedded memories directly in User document for better performance
 */
const memorySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "profile", // User profile information
        "preference", // User preferences
        "user_fact", // Facts about the user
        "conversation", // Conversation-based memory
        "conversation_summary", // Conversation summary
        "task", // Task-related memory
        "note", // User notes
        "general", // General memory
      ],
      default: "general",
    },
    category: {
      type: String,
      enum: ["primary", "conversation"],
      required: true,
      index: true,
    },
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    priority: {
      type: Number,
      default: 5,
      index: true,
    },
    recencyWeight: {
      type: Number,
      default: 1.0,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      default: "chat",
    },
    sessionId: {
      type: String,
      default: null,
    },
    embedding: {
      type: [Number],
      default: null,
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

/**
 * User Schema
 * Enhanced with embedded memories and user-level embedding
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },

    profile: {
      name: {
        type: String,
        trim: true,
        default: "",
      },
      tone: {
        type: String,
        enum: ["friendly", "professional", "casual", "formal", "enthusiastic"],
        default: "friendly",
      },
      persona: {
        type: String,
        default: "assistant",
      },
      settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
      priorities: {
        work: { type: Number, min: 1, max: 5, default: 3 },
        study: { type: Number, min: 1, max: 5, default: 3 },
        health: { type: Number, min: 1, max: 5, default: 3 },
        social: { type: Number, min: 1, max: 5, default: 3 },
        finance: { type: Number, min: 1, max: 5, default: 3 },
        household: { type: Number, min: 1, max: 5, default: 3 },
        creative: { type: Number, min: 1, max: 5, default: 3 },
      },
    },

    // User-level embedding - represents the user's overall profile/preferences
    // Updated dynamically based on memories
    embedding: {
      type: [Number],
      default: null,
    },
    // Embedded memories array
    memories: {
      type: [memorySchema],
      default: [],
    },
    // Metadata for user-level information
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Memory statistics
    memoryStats: {
      primaryCount: {
        type: Number,
        default: 0,
      },
      conversationCount: {
        type: Number,
        default: 0,
      },
      lastMemoryUpdate: {
        type: Date,
        default: Date.now,
      },
      lastEmbeddingUpdate: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
);

// Indexes for performance
// Note: `unique: true` on the schema fields already creates indexes for username and email.
userSchema.index({ "memories.category": 1, "memories.importance": -1 });
userSchema.index({ "memories.priority": -1 });

// Avoid model recompilation errors in hot-reload/dev environments by reusing existing model
const UserModel = (mongoose.models && mongoose.models.User) || mongoose.model("User", userSchema);

export const User = UserModel;
export default UserModel;
