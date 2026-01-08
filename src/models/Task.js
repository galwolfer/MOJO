import mongoose from "mongoose";
import { updateAllScores } from "../scripts/updateScores.js";
import { detectTags } from "../algorithms/priority/tagging.js";
import { generateSubCategory } from "../services/ml/subcategoryGenerator.js";
import { predictTask } from "../services/mlPredictionService.js";

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskname: { type: String, required: true, trim: true }, // user-facing short name for the task
    description: { type: String, default: "", trim: true },
    dueDate: { type: Date }, // optional deadline
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    importance: { type: Number, min: 1, max: 5, default: 3 }, // 1=low, 5=high
    effort: { type: Number, min: 1, max: 5, default: 3 }, // 1=small, 5=big
    category: { type: String, default: "", trim: true },
    estimatedDuration: { type: Number, min: 15, default: 60 }, // minutes
    canSplit: { type: Boolean, default: true },
    minChunk: { type: Number, min: 15, default: 30 }, // minimum chunk length in minutes when splitting
    taskType: {
      type: String,
      enum: ["perfect", "in_parts", "leaky"],
      default: "perfect",
      trim: true,
    },
    chunkCount: { type: Number, min: 1 },
    chunkMinutes: { type: Number, min: 1 },
    minMinutes: { type: Number, min: 1 },
    maxMinutes: { type: Number, min: 1 },
    earliestStart: { type: Date },
    // Cached score so we can sort quickly (optional)
    // add field: user's behaviour default value ineffective
    priorityScore: { type: Number, default: 0 },
    // ML Prediction fields
    predictedCompletionCategory: { type: Number, min: 1, max: 5 }, // 1=very quick, 5=won't complete
    predictionScore: { type: Number, min: 0, max: 1 }, // confidence score (0-1)
    actualCompletionMinutes: { type: Number }, // minutes taken when task completes (for reward calculation)
    subCategory: {
      label: { type: String, default: "", trim: true },
      source: { type: String, default: "heuristic", trim: true },
      confidence: { type: Number, min: 0, max: 1, default: 0 },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// (add/edit) after each task save
taskSchema.post("save", async function () {
  // When a task is created or updated, recalculate priority scores for all open tasks
  console.log("🧩 Task saved — updating priority scores...");
  await updateAllScores();
});

// (remove) after each task remove
taskSchema.post("remove", async function () {
  // When a task is deleted, recalculate priority scores to keep cache consistent
  console.log("🧩 Task removed — updating priority scores...");
  await updateAllScores();
});

taskSchema.pre("save", async function () {
  const shouldRefreshCategory =
    !this.category || this.isNew || this.isModified("taskname") || this.isModified("description");

  if (shouldRefreshCategory) {
    const autoCategory = detectTags({
      title: this.taskname,
      description: this.description,
      category: this.category,
    });
    this.category = autoCategory;
  }

  const hasManualSubCategory = this.subCategory?.label && this.subCategory?.source === "user";
  const shouldRefreshSubCategory = (shouldRefreshCategory || !this.subCategory?.label) && !hasManualSubCategory;

  if (shouldRefreshSubCategory) {
    this.subCategory = await generateSubCategory({
      userId: this.userId,
      title: this.taskname,
      description: this.description,
      category: this.category,
      current: this.subCategory,
      TaskModel: this.constructor,
    });
  }

  // ML Prediction: Predict task completion difficulty when task is new or key fields change
  const shouldPredict = 
    this.isNew || 
    this.isModified("importance") || 
    this.isModified("effort") || 
    this.isModified("estimatedDuration") ||
    this.isModified("dueDate") ||
    this.isModified("category");

  if (shouldPredict) {
    try {
      // Get ML prediction for this task
      const prediction = await predictTask(this);
      
      // Populate prediction fields
      this.predictionScore = prediction.score;
      this.predictedCompletionCategory = prediction.category;
      
      console.log(`🤖 ML Prediction: score=${prediction.score.toFixed(3)}, category=${prediction.category}`);
    } catch (error) {
      // Don't break task save if ML prediction fails
      console.error('⚠️  ML Prediction failed (task will save without predictions):', error.message);
      // Leave prediction fields undefined - they'll remain empty in DB
    }
  }
});

// Compound indexes for efficient queries
taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ userId: 1, category: 1 });
taskSchema.index({ userId: 1, completed: 1 });

// Methods
taskSchema.methods.markComplete = function () {
  this.completed = true;
};

taskSchema.methods.markIncomplete = function () {
  this.completed = false;
  return this.save();
};

// Calculate next deadline for recurring task
taskSchema.methods.calculateNextDeadline = function () {
  if (!this.recurrence || !this.recurrence.type) {
    return this.dueDate;
  }

  const current = new Date(this.dueDate);
  const interval = this.recurrence.interval || 1;

  switch (this.recurrence.type) {
    case "daily":
      current.setDate(current.getDate() + interval);
      break;
    case "weekly":
      current.setDate(current.getDate() + 7 * interval);
      break;
    case "monthly":
      current.setMonth(current.getMonth() + interval);
      break;
    case "yearly":
      current.setFullYear(current.getFullYear() + interval);
      break;
  }

  return current;
};

// Check if recurring task should continue
taskSchema.methods.shouldContinueRecurrence = function () {
  if (!this.recurrence || !this.recurrence.type) {
    return false;
  }

  // Check count limit
  if (this.recurrence.count && this.recurrence.completedDates.length >= this.recurrence.count) {
    return false;
  }

  // Check end date
  if (this.recurrence.endDate) {
    const nextDeadline = this.calculateNextDeadline();
    if (nextDeadline > this.recurrence.endDate) {
      return false;
    }
  }

  return true;
};

// Static methods
taskSchema.statics.findByUserId = function (userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ dueDate: 1 });
};

taskSchema.statics.findUpcoming = function (userId, days = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return this.find({
    userId,
    dueDate: { $gte: now, $lte: futureDate },
    status: { $ne: "done" },
  }).sort({ dueDate: 1 });
};

taskSchema.statics.findOverdue = function (userId) {
  const now = new Date();

  return this.find({
    userId,
    dueDate: { $lt: now },
    status: { $ne: "done" },
  }).sort({ dueDate: 1 });
};

export const Task = mongoose.model("Task", taskSchema);
