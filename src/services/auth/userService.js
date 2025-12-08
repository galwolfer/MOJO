/**
 * @fileoverview User Profile Service
 * @module services/auth/userService
 * 
 * Helper functions for managing user profiles and preferences.
 * Provides utilities to fetch and update user data without handling authentication.
 * 
 * Key responsibilities:
 * - Retrieve user profiles by ID
 * - Update user priority preferences
 * - Manage user settings and configurations
 * 
 * @requires models/User - User database model
 */

import { User } from "../../models/User.js";

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
