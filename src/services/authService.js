// src/services/authService.js
// Handles user registration and authentication logic.

import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { logEvent } from "./telemetry.js";

const SALT_ROUNDS = 10;

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
