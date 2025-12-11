/**
 * @fileoverview Schedule Persistence Service
 * @module services/scheduling/schedulePersistence
 * 
 * Handles database persistence for generated task schedules.
 * Manages the lifecycle of scheduled sessions in the database.
 * 
 * Key responsibilities:
 * - Save generated plans to TaskSchedule collection
 * - Clear outdated future sessions before saving new plans
 * - Preserve completed sessions for historical records
 * - Support schedule regeneration without data loss
 * 
 * @requires models/TaskSchedule - TaskSchedule database model
 */

import { TaskSchedule } from "../../models/TaskSchedule.js";

/**
 * Persist a generated plan to the database.
 * Clears existing future planned sessions before saving new ones.
 * @param {string} userId - The user ID
 * @param {object[]} plan - Array of planned sessions
 */
export async function persistPlan(userId, plan) {
  // Clear existing future sessions for this user before saving new plan
  // Keep only completed sessions in the past
  const now = new Date();
  await TaskSchedule.deleteMany({
    userId,
    start: { $gte: now },
    status: { $ne: "done" },  // Keep only completed sessions
  });

  if (!plan.length) return;

  const docs = plan.map((slot) => ({
    userId,
    taskId: slot.taskId,
    start: slot.start,
    end: slot.end,
    minutes: slot.minutes,
    status: "planned",
  }));

  await TaskSchedule.insertMany(docs);
}
