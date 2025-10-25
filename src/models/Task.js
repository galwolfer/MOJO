import mongoose from "mongoose";

/**
 * Task Schema
 * Represents user tasks with deadlines and tags
 */
const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    tag: {
      type: String,
      trim: true,
      default: null,
      maxlength: 50,
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound indexes for efficient queries
taskSchema.index({ userId: 1, deadline: 1 });
taskSchema.index({ userId: 1, tag: 1 });
taskSchema.index({ userId: 1, completed: 1 });

// Methods
taskSchema.methods.markComplete = function () {
  this.completed = true;
  return this.save();
};

taskSchema.methods.markIncomplete = function () {
  this.completed = false;
  return this.save();
};

// Static methods
taskSchema.statics.findByUserId = function (userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ deadline: 1 });
};

taskSchema.statics.findUpcoming = function (userId, days = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return this.find({
    userId,
    deadline: { $gte: now, $lte: futureDate },
    completed: false,
  }).sort({ deadline: 1 });
};

taskSchema.statics.findOverdue = function (userId) {
  const now = new Date();

  return this.find({
    userId,
    deadline: { $lt: now },
    completed: false,
  }).sort({ deadline: 1 });
};

export const Task = mongoose.model("Task", taskSchema);
