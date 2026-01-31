import mongoose from "mongoose";
import { updateAllScores } from "../scripts/updateScores.js";
import { detectCategory } from "../algorithms/priority/categorizing.js";
import { generateSubCategory } from "../services/ml/subcategoryGenerator.js";
import { predictTask } from "../services/mlPredictionService.js";
import { CATEGORY_STRING_VALUES, isValidCategory } from "../config/categories.js";

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskname: { type: String, required: true, trim: true }, // user-facing short name for the task
    description: { type: String, default: "", trim: true },
    dueDate: { type: Date }, // optional deadline
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    progressPercentage: { type: Number, min: 0, max: 100, default: 0 }, // 0-100, synced from subtasks
    importance: { type: Number, min: 1, max: 5, default: 3 }, // 1=low, 5=high
    effort: { type: Number, min: 1, max: 5, default: 3 }, // 1=small, 5=big
    category: {
      type: String,
      validate: {
        validator: function (value) {
          return isValidCategory(value) || value === "" || !value;
        },
        message: `Invalid category. Must be one of: ${CATEGORY_STRING_VALUES.join(", ")} or empty`,
      },
      default: "",
      trim: true,
      lowercase: true,
    },
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
    // Recurrence settings for repeating tasks
    recurrence: {
      type: { type: String, enum: ["daily", "weekly", "monthly", "yearly"] },
      interval: { type: Number, default: 1 },
      endDate: { type: Date },
      count: { type: Number },
      completedDates: { type: [Date], default: [] },
    },
    // Cached score so we can sort quickly (optional)
    // add field: user's behavior default value ineffective
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
    // Task progress tracking (for split tasks)
    progressPercentage: { type: Number, min: 0, max: 100, default: 0 }, // 0-100, synced from subtasks
    // User-defined tags for categorization and filtering
    tags: { type: [String], default: [] },
    // Temporary storage for subtask data provided during task creation (not persisted)
    _pendingSubtasks: { type: [Object], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// (add/edit) after each task save
import { SubTask } from "./SubTask.js";

// Helper: Synchronize subtasks to match the task's chunkCount when taskType is in_parts or leaky
async function syncSubTasksForTask(taskDoc) {
  try {
    console.log(`[syncSubTasksForTask] Task ${taskDoc._id} (${taskDoc.taskname}) taskType: ${taskDoc.taskType}`);
    
    // Only relevant for "in_parts" or "leaky"
    if (!["in_parts", "leaky"].includes(taskDoc.taskType)) {
      console.log(`[syncSubTasksForTask] Task type is "${taskDoc.taskType}", not creating subtasks. Deleting any existing...`);
      // If switching to "perfect", remove any existing subtasks
      await SubTask.deleteMany({ taskId: taskDoc._id }).catch(() => {});
      return;
    }

    // Check if we have explicit subtask data from task creation
    const pendingSubtasks = taskDoc._pendingSubtasks && taskDoc._pendingSubtasks.length > 0 
      ? taskDoc._pendingSubtasks 
      : null;

    if (pendingSubtasks) {
      const existing = await SubTask.find({ taskId: taskDoc._id });
      if (existing.length === 0) {
        console.log(`[syncSubTasksForTask] Creating ${pendingSubtasks.length} subtasks from pending data`);
        // Use the provided subtask data
        const desiredCount = pendingSubtasks.length;
        
        // Remove all existing subtasks first
        await SubTask.deleteMany({ taskId: taskDoc._id }).catch(() => {});
        
        // Create subtasks with the exact provided data
        const createOps = pendingSubtasks.map((subtask, index) => ({
          taskId: taskDoc._id,
          userId: taskDoc.userId,
          index: index + 1,
          title: subtask.title || `Part ${index + 1}`,
          description: subtask.description || "",
          minutes: subtask.minutes ? parseInt(subtask.minutes, 10) : 0,
        }));
        
        if (createOps.length) {
          const created = await SubTask.insertMany(createOps);
          console.log(`[syncSubTasksForTask] Created ${created.length} subtasks: ${created.map(st => st._id).join(", ")}`);
        }
      } else {
        console.log(`[syncSubTasksForTask] Task already has ${existing.length} subtasks, skipping pending data processing`);
      }
      // Clear _pendingSubtasks from DB
      await Task.updateOne({ _id: taskDoc._id }, { $unset: { _pendingSubtasks: 1 } });
    } else {
      console.log(`[syncSubTasksForTask] No pending subtasks, using auto-generation logic`);
      // Original auto-generation logic when no explicit subtasks provided
      // Determine desired count of subtasks:
      // Prefer explicit chunkCount, otherwise estimate from estimatedDuration and minChunk/default
      const minChunk = taskDoc.minChunk || 30;
      const desiredCount =
        taskDoc.chunkCount && Number.isInteger(taskDoc.chunkCount) && taskDoc.chunkCount > 0
          ? taskDoc.chunkCount
          : Math.max(1, Math.ceil((taskDoc.estimatedDuration || minChunk) / minChunk));

      const existing = await SubTask.find({ taskId: taskDoc._id }).sort({ index: 1 });

      // If there are fewer than desired, create missing
      if (existing.length < desiredCount) {
        const toCreate = desiredCount - existing.length;
        const startIndex = existing.length + 1;
        const createOps = [];
        for (let i = 0; i < toCreate; i++) {
          const idx = startIndex + i;
          createOps.push({
            taskId: taskDoc._id,
            userId: taskDoc.userId,
            index: idx,
            title: `Part ${idx}`,
            minutes: taskDoc.chunkMinutes || Math.round((taskDoc.estimatedDuration || minChunk) / desiredCount),
          });
        }
        if (createOps.length) {
          await SubTask.insertMany(createOps);
        }
      }

      // If there are more than desired, remove the extras (highest indexes)
      if (existing.length > desiredCount) {
        const toRemove = existing.slice(desiredCount).map((s) => s._id);
        if (toRemove.length) {
          await SubTask.deleteMany({ _id: { $in: toRemove } });
        }
      }

      // If counts match, ensure indexes are sequential and titles are "Part N" if empty
      const updatedList = await SubTask.find({ taskId: taskDoc._id }).sort({ index: 1 });
      for (let i = 0; i < updatedList.length; i++) {
        const desiredIndex = i + 1;
        const s = updatedList[i];
        let changed = false;
        if (s.index !== desiredIndex) {
          s.index = desiredIndex;
          changed = true;
        }
        if (!s.title || s.title.trim() === "") {
          s.title = `Part ${desiredIndex}`;
          changed = true;
        }
        if (changed) await s.save();
      }
    }
  } catch (err) {
    console.error("⚠️  syncSubTasksForTask failed:", err && err.message ? err.message : err);
  }
}

// Helper: Calculate and sync progress percentage based on subtasks
async function syncProgressPercentageForTask(taskDoc) {
  try {
    // Only relevant for split tasks
    if (!["in_parts", "leaky"].includes(taskDoc.taskType)) {
      taskDoc.progressPercentage = 0;
      return;
    }

    const subtasks = await SubTask.find({ taskId: taskDoc._id }).lean();
    if (subtasks.length === 0) {
      taskDoc.progressPercentage = 0;
      return;
    }

    const completedCount = subtasks.filter((st) => st.status === "done").length;
    taskDoc.progressPercentage = Math.round((completedCount / subtasks.length) * 100);
  } catch (err) {
    console.error("⚠️  syncProgressPercentageForTask failed:", err && err.message ? err.message : err);
  }
}

taskSchema.post("save", async function () {
  // When a task is created or updated, recalculate priority scores for all open tasks
  console.log("🧩 Task saved — updating priority scores...");
  await updateAllScores();

  // After saving, ensure subTasks reflect the task's chunk configuration
  await syncSubTasksForTask(this);

  // Sync progress percentage from subtasks
  await syncProgressPercentageForTask(this);
});

// (remove) after each task remove
taskSchema.post("remove", async function () {
  // When a task is deleted, recalculate priority scores to keep cache consistent
  console.log("🧩 Task removed — updating priority scores...");
  await updateAllScores();

  // Remove any subtasks belonging to this task
  await SubTask.deleteMany({ taskId: this._id }).catch(() => {});
});

taskSchema.pre("save", async function () {
  const shouldRefreshCategory =
    !this.category || this.isNew || this.isModified("taskname") || this.isModified("description");

  if (shouldRefreshCategory) {
    const autoCategory = detectCategory({
      title: this.taskname,
      description: this.description,
      category: this.category,
    });
    this.category = autoCategory;
  }

  const hasManualSubCategory = this.subCategory?.label && this.subCategory?.source === "user";
  const shouldRefreshSubCategory = (shouldRefreshCategory || !this.subCategory?.label) && !hasManualSubCategory;

  console.log("[Task.pre-save] Subcategory check:", {
    isNew: this.isNew,
    taskname: this.taskname,
    hasSubCategory: !!this.subCategory?.label,
    subCategoryLabel: this.subCategory?.label,
    subCategorySource: this.subCategory?.source,
    hasManualSubCategory,
    shouldRefreshSubCategory,
  });

  if (shouldRefreshSubCategory) {
    console.log("[Task.pre-save] Generating subcategory for:", this.taskname);
    this.subCategory = await generateSubCategory({
      userId: this.userId,
      title: this.taskname,
      description: this.description,
      category: this.category,
      current: this.subCategory,
      TaskModel: this.constructor,
    });
    console.log("[Task.pre-save] Generated subcategory:", this.subCategory?.label, "source:", this.subCategory?.source);
  } else {
    console.log("[Task.pre-save] Keeping existing subcategory:", this.subCategory?.label);
  }

  // ========================================================================
  // ML PREDICTION: Auto-predict task difficulty on creation/modification
  // ========================================================================
  // Triggers when:
  // - New task created
  // - Key fields modified (importance, effort, estimatedDuration, dueDate, category)
  //
  // Process:
  // 1. Convert task to ML input (5 fields → 28 engineered features)
  // 2. Call Python ML service (loads user's model or creates new one)
  // 3. Get prediction: score (0-1 confidence) + category (1-5 difficulty)
  // 4. Store in predictionScore and predictedCompletionCategory fields
  //
  // Result: Every task gets instant ML predictions at save time
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

      // Validate prediction response
      if (!prediction || typeof prediction.score !== "number" || !prediction.category) {
        console.error("⚠️  ML Prediction returned invalid data:", prediction);
        // Leave prediction fields undefined - task will save without predictions
        return;
      }

      // Populate prediction fields (stored in MongoDB for priority calculations)
      // Clamp predictionScore to valid range [0, 1] to prevent validation errors
      this.predictionScore = Math.max(0, Math.min(1, prediction.score));
      this.predictedCompletionCategory = prediction.category;

      console.log(`🤖 ML Prediction: score=${prediction.score.toFixed(3)}, category=${prediction.category}`);
    } catch (error) {
      // Don't break task save if ML prediction fails
      console.error("⚠️  ML Prediction failed (task will save without predictions):", {
        taskId: this._id,
        userId: this.userId,
        error: error.message,
        stack: error.stack?.split("\n")[0], // First line of stack for debugging
      });
      // Leave prediction fields undefined - they'll remain empty in DB
    }
  }
});

// Virtual populate: subtasks (created for in_parts / leaky tasks)
taskSchema.virtual("subTasks", {
  ref: "SubTask",
  localField: "_id",
  foreignField: "taskId",
});

// Compound indexes for efficient queries
taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ userId: 1, tag: 1 });
taskSchema.index({ userId: 1, completed: 1 });

// Methods
taskSchema.methods.markComplete = function () {
  this.status = "done";
  return this.save();
};

taskSchema.methods.markIncomplete = function () {
  this.status = "todo";
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
