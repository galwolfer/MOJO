/*
 * File: src/models/User.js
 * Purpose: User model with embedded memory sub-schema
 */
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
  },
);

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: Number, required: true }, // Index from CATEGORIES config (0-17)
  },
  { _id: false },
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
      profileImage: {
        type: String,
        default: null,
      },
      ojoTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OjoType",
        default: null,
      },
      gender: {
        type: String,
        enum: ["female", "male", "nonbinary", "prefer_not_to_say", "other", "unspecified"],
        default: "unspecified",
      },
      settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        // Default settings includes accessibility preferences so new users have a defined value
        default: { accessibility: { timeFormat: "12h" } },
      },
      priorities: {
        study_and_education: { type: Number, min: 1, max: 5, default: 3 },
        skill_building: { type: Number, min: 1, max: 5, default: 3 },
        workout: { type: Number, min: 1, max: 5, default: 3 },
        reflection: { type: Number, min: 1, max: 5, default: 3 },
        home_and_chores: { type: Number, min: 1, max: 5, default: 3 },
        family: { type: Number, min: 1, max: 5, default: 3 },
        life_management: { type: Number, min: 1, max: 5, default: 3 },
        work_and_career: { type: Number, min: 1, max: 5, default: 3 },
        creative_projects: { type: Number, min: 1, max: 5, default: 3 },
        hobbies: { type: Number, min: 1, max: 5, default: 3 },
        relationship: { type: Number, min: 1, max: 5, default: 3 },
        goals: { type: Number, min: 1, max: 5, default: 3 },
        mindfulness: { type: Number, min: 1, max: 5, default: 3 },
        health: { type: Number, min: 1, max: 5, default: 3 },
        social_activity: { type: Number, min: 1, max: 5, default: 3 },
        recovery: { type: Number, min: 1, max: 5, default: 3 },
        exploration: { type: Number, min: 1, max: 5, default: 3 },
        uncategorized: { type: Number, min: 1, max: 5, default: 3 },
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
    // User specific subcategories (IDs)
    subCategories: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" }],
      default: [],
    },
    // Lightweight recent sessions summary for quick UI access (keeps last N sessions)
    sessions: {
      type: [
        new mongoose.Schema(
          {
            sessionId: { type: String, required: true, index: true },
            lastActiveAt: { type: Date, default: Date.now },
            createdAt: { type: Date, default: Date.now },
            messageCount: { type: Number, default: 0 },
            preview: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
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
    // Gamification stats for user profile
    gamification: {
      type: new mongoose.Schema(
        {
          points: { type: Number, default: 0 },
          currentStreak: { type: Number, default: 0 },
          longestStreak: { type: Number, default: 0 },
          lastActiveDate: { type: Date, default: null },
          completedTasks: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: {
        points: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedTasks: 0,
      },
    },

    // Push notification settings
    pushNotifications: {
      type: new mongoose.Schema(
        {
          // Expo Push Token for this device
          expoPushToken: { type: String, default: null },
          // Device platform (ios/android)
          platform: { type: String, enum: ["ios", "android", "web", null], default: null },
          // Whether notifications are enabled globally
          enabled: { type: Boolean, default: true },
          // Morning summary notification (8 AM)
          morningDigest: {
            enabled: { type: Boolean, default: true },
            hour: { type: Number, min: 0, max: 23, default: 8 },
            minute: { type: Number, min: 0, max: 59, default: 0 },
          },
          // Task reminder notifications
          taskReminders: {
            enabled: { type: Boolean, default: true },
            // Default minutes before due date to remind
            defaultReminderMinutes: { type: Number, default: 60 },
            // Use ML predictions for smart reminders
            useSmartReminders: { type: Boolean, default: true },
          },
          // Timezone for scheduling (IANA format, e.g., 'America/New_York')
          timezone: { type: String, default: "UTC" },
          // Last notification sent timestamps
          lastMorningDigest: { type: Date, default: null },
          lastTaskReminder: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: {
        expoPushToken: null,
        platform: null,
        enabled: true,
        morningDigest: { enabled: true, hour: 8, minute: 0 },
        taskReminders: { enabled: true, defaultReminderMinutes: 60, useSmartReminders: true },
        timezone: "UTC",
        lastMorningDigest: null,
        lastTaskReminder: null,
      },
    },
  },
  { timestamps: true },
);

// Indexes for performance
// Note: `unique: true` on the schema fields already creates indexes for username and email.
userSchema.index({ "memories.category": 1, "memories.importance": -1 });
userSchema.index({ "memories.priority": -1 });

// Avoid model recompilation errors in hot-reload/dev environments by reusing existing model
const UserModel = (mongoose.models && mongoose.models.User) || mongoose.model("User", userSchema);

export const User = UserModel;
export default UserModel;
