// src/scripts/updateScores.js
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { scoreActivities } from "../services/priority.js";
import Task from "../models/Task.js";

const mapStatus = (status) =>
  status === "todo" || status === "in_progress" ? "open" : "closed";

const toActivity = (task) => ({
  id: task._id.toString(),
  userId: task.userId?.toString(),
  title: task.title,
  type: task.type || "general",
  duration_min: task.duration_min || 30,
  importance: Number.isFinite(task.importance) ? task.importance : 3,
  effort: Number.isFinite(task.effort) ? task.effort : 3,
  recurrence: task.recurrence || "none",
  status: mapStatus(task.status),
  deadline: task.dueDate ? new Date(task.dueDate).toISOString() : null,
  required_context: { timeOfDay: task.timeOfDay || "any" },
});

export async function updateAllScores() {
  let shouldDisconnect = false;
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
      shouldDisconnect = true;
    }

    const openTasks = await Task.find(
      { status: { $in: ["todo", "in_progress"] } },
      {
        title: 1,
        importance: 1,
        effort: 1,
        dueDate: 1,
        status: 1,
        tags: 1,
        duration_min: 1,
        recurrence: 1,
        timeOfDay: 1,
        userId: 1,
      }
    ).lean();

    if (!openTasks.length) {
      console.log("ℹ️ No open tasks found; priority scores unchanged");
      return;
    }

    const scored = scoreActivities(openTasks.map(toActivity));

    if (!scored.queue.length) {
      console.log("ℹ️ Scoring produced no ranked tasks; priority scores unchanged");
      return;
    }

    const operations = scored.queue.map(({ activityId, score }) => ({
      updateOne: {
        filter: { _id: activityId },
        update: { $set: { priorityScore: score } },
      },
    }));

    await Task.bulkWrite(operations, { ordered: false });
    console.log("✅ Priority scores updated for all open tasks");
  } catch (err) {
    console.error("❌ Error updating scores:", err);
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }
}
