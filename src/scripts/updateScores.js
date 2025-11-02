// src/scripts/updateScores.js
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { scoreActivities } from "../services/priority.js";
import Task from "../models/Task.js";
import User from "../models/User.js";

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
  tags: Array.isArray(task.tags) ? task.tags : [],
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

    const tasksByUser = openTasks.reduce((acc, task) => {
      const userId = task.userId?.toString();
      if (!userId) return acc;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(task);
      return acc;
    }, {});

    const userIds = Object.keys(tasksByUser);
    const users = await User.find(
      { _id: { $in: userIds } },
      { profile: 1 }
    ).lean();

    const profileMap = new Map(users.map((u) => [u._id.toString(), u.profile || {}]));

    const operations = [];

    for (const [userId, userTasks] of Object.entries(tasksByUser)) {
      const profile = profileMap.get(userId) || {};
      const scored = scoreActivities(userTasks.map(toActivity), profile);

      if (!scored.queue.length) continue;

      for (const { activityId, score } of scored.queue) {
        operations.push({
          updateOne: {
            filter: { _id: activityId },
            update: { $set: { priorityScore: score } },
          },
        });
      }
    }

    if (!operations.length) {
      console.log("ℹ️ Scoring produced no ranked tasks; priority scores unchanged");
      return;
    }

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
