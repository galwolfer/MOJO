/**
 * @fileoverview Authentication & User Service
 * @module services/authService
 *
 * Consolidated service for user authentication and profile management.
 * Handles registration, login, and user profile operations.
 *
 * Key responsibilities:
 * - User registration with password hashing
 * - User login with credential verification
 * - Fetch and update user profiles
 * - Manage user priority preferences
 * - Update routine settings
 *
 * @requires bcrypt - For secure password hashing
 * @requires models/User - User database model
 */

import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { logEvent } from "./telemetryService.js";

const SALT_ROUNDS = 10;

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Register a new user.
 * @param {{ username: string, email: string, password: string, priorities?: Record<string, number> }} params
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function registerUser({ username, email, password, priorities = {} }) {
  if (!username || !email || !password) {
    return { success: false, error: "Username, email, and password are required." };
  }

  const normalizedEmail = email.toLowerCase();
  const duplicate = await User.findOne({
    $or: [{ username }, { email: normalizedEmail }],
  }).lean();

  if (duplicate) {
    const clashes = [];
    if (duplicate.username === username) clashes.push("username");
    if (duplicate.email === normalizedEmail) clashes.push("email");
    return { success: false, error: `${clashes.join(" & ")} already taken.` };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    username,
    email: normalizedEmail,
    passwordHash,
    profile: { priorities },
  });

  await logEvent({
    type: "onboarding_questionnaire_completed",
    userId: user._id,
    payload: { priorities },
  });

  return { success: true, user };
}

/**
 * Authenticate a user by username and password.
 * @param {{ username: string, password: string }} params
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function loginUser({ username, password }) {
  const user = await User.findOne({ username });
  if (!user) {
    return { success: false, error: "Invalid credentials." };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { success: false, error: "Invalid credentials." };
  }

  return { success: true, user };
}

// =============================================================================
// USER PROFILE MANAGEMENT
// =============================================================================

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
