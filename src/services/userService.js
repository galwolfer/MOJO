// src/services/userService.js
// Helpers for user profile and preferences.

import { User } from "../models/User.js";

/**
 * Fetch fresh user document by ID.
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @returns {Promise<object | null>}
 */
export async function getUserById(userId) {
  return User.findById(userId).lean();
}

/**
 * Update a user's profile priorities.
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @param {Record<string, number>} priorities
 * @returns {Promise<object | null>}
 */
export async function updatePriorities(userId, priorities) {
  await User.updateOne({ _id: userId }, { $set: { "profile.priorities": priorities } });
  return getUserById(userId);
}

/**
 * Update routine-block settings in the user profile.
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @param {{ enabled: boolean, blocks: object[] }} settings
 * @returns {Promise<object | null>}
 */
export async function updateRoutineSettings(userId, settings) {
  await User.updateOne({ _id: userId }, { $set: { "profile.settings.routineBlocks": settings } });
  return getUserById(userId);
}
