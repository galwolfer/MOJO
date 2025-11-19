// ==================== OFEK — SERVICES (START) ====================
export const ofekService = {
  // Example: fetch items from a DB (mocked)
  list: async () => {
    // TODO(Ofek): connect to DB and return items
    return [];
  },
  create: async (data) => {
    // TODO(Ofek): insert item in DB
    return { id: "mock-id", ...data };
  },
};
// ==================== OFEK — SERVICES (END) ======================

// ==================== GAL — SERVICES (START) =====================
export const galService = {
  getProfile: async () => {
    // TODO(Gal): query user profile
    return { name: "Gal", role: "teammate" };
  },
  updateProfile: async (data) => {
    // TODO(Gal): update user profile
    return { ...data, updatedAt: new Date().toISOString() };
  },
};
// ==================== GAL — SERVICES (END) =======================

// ==================== JONI — SERVICES (START) ====================
// src/services/index.js
import mongoose from "mongoose";
import Task from "../models/Task.js";
import { scoreActivities } from "./priority.js";

// Open = "todo" | "in-progress", Closed = "done"
const mapStatus = (s) =>
  (s === "todo" || s === "in-progress") ? "open" :
  (s === "done" ? "closed" : "open");

export const coacherAlgorithm = {
  // importing tasks by username from the DB
  async computeFromDb(userId, userProfile = {}) {
    // Only user's open tasks
    const tasks = await Task.find(
      { userId, status: { $in: ["todo", "in-progress"] } },
      { taskname: 1, importance: 1, effort: 1, dueDate: 1, status: 1, tags: 1, duration_min: 1, recurrence: 1, timeOfDay: 1, userId: 1 }
    ).lean();

    if (!tasks || tasks.length === 0) {
      return { top: null, ranked: [], reasons: ["No open tasks for this user"] };
    }

    // minimal normalization
    const normalized = tasks.map(t => ({
      ...t,
      importance: Number.isFinite(t.importance) ? t.importance : 3,
      effort: Number.isFinite(t.effort) ? t.effort : 2,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      status: t.status || "todo",
      tags: Array.isArray(t.tags) ? t.tags : []
    }));

    return this.computeFromTasks(normalized, userProfile);
  },

  // conversion to activities format and scoring
  computeFromTasks(tasks, userProfile = {}) {
    const activities = tasks.map((t) => ({
      id: t._id.toString(),
      userId: t.userId?.toString(),
      title: t.taskname || t.title,
      type: t.type || "general",
      duration_min: t.duration_min || 30,
      importance: t.importance ?? 3,
      effort: t.effort ?? 3,
      recurrence: t.recurrence || "none",
      status: mapStatus(t.status), // critical
      deadline: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      required_context: { timeOfDay: t.timeOfDay || "any" },
      tags: Array.isArray(t.tags) ? t.tags : [],
    }));

    const result = scoreActivities(activities, userProfile);
    // keeping the format from your CLI: { top, ranked }
    return { top: result.top, ranked: result.queue, reasons: [] };
  },
};

export default coacherAlgorithm;

// ==================== JONI — SERVICES (END) ======================
