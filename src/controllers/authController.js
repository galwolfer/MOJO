/*
 * File: src/controllers/authController.js
 * Purpose: Handles user registration, login and profile updates
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { env } from "../config/env.js";
import { getDefaultOjoType } from "../utils/ojoTypeUtils.js";

const JWT_SECRET = env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token valid for 7 days

// Normalize gender inputs into canonical enum values used throughout the app.
// Accepts common display variants like "Non-binary", "non binary", "Non_binary", etc.
export function canonicalizeGender(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).toLowerCase().trim();
  const map = {
    female: "female",
    woman: "female",
    male: "male",
    man: "male",
    "non-binary": "nonbinary",
    "non binary": "nonbinary",
    non_binary: "nonbinary",
    nonbinary: "nonbinary",
    "prefer not to say": "prefer_not_to_say",
    prefer_not_to_say: "prefer_not_to_say",
    prefernottosay: "prefer_not_to_say",
    other: "other",
    unspecified: "unspecified",
  };
  if (map[s]) return map[s];
  const alphanumeric = s.replace(/[^a-z]/g, "");
  if (alphanumeric === "nonbinary") return "nonbinary";
  if (alphanumeric === "prefernottosay") return "prefer_not_to_say";
  return null;
}

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const { username, email, password, displayName, profileImage } = req.body;
    let gender = req.body.gender;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Username, email, and password are required",
      });
    }

    if (!displayName || String(displayName).trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Display name is required",
      });
    }

    if (gender !== undefined && gender !== null) {
      const canonical = canonicalizeGender(gender);
      if (!canonical) {
        return res.status(400).json({ success: false, error: "Invalid gender value" });
      }
      // use canonical value for storage
      gender = canonical;
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Username or email already exists",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Get default OjoType
    const defaultOjoType = await getDefaultOjoType();

    // Create user
    const user = new User({
      username,
      email,
      passwordHash,
      profile: {
        name: displayName ? String(displayName).trim() : "",
        profileImage: profileImage || null,
        ojoTypeId: defaultOjoType ? defaultOjoType._id : null,
        gender: gender ? String(gender) : "unspecified",
        // Initialize settings with accessibility defaults so preference exists on new accounts
        settings: { accessibility: { timeFormat: "12h" } },
      },
    });

    await user.save();

    // Populate OjoType for returned profile
    await user.populate("profile.ojoTypeId", "name displayName persona tone");
    const profileObj =
      user.profile && typeof user.profile.toObject === "function"
        ? user.profile.toObject()
        : JSON.parse(JSON.stringify(user.profile || {}));
    profileObj.ojoType = user.profile && user.profile.ojoTypeId ? user.profile.ojoTypeId : null;

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: profileObj,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    // Populate OjoType for returned profile
    await user.populate("profile.ojoTypeId", "name displayName persona tone");
    const profileObj =
      user.profile && typeof user.profile.toObject === "function"
        ? user.profile.toObject()
        : JSON.parse(JSON.stringify(user.profile || {}));
    profileObj.ojoType = user.profile && user.profile.ojoTypeId ? user.profile.ojoTypeId : null;

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: profileObj,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Populate the OjoType object for easier client consumption
    await user.populate("profile.ojoTypeId", "name displayName persona tone");

    const profileObj =
      user.profile && typeof user.profile.toObject === "function"
        ? user.profile.toObject()
        : JSON.parse(JSON.stringify(user.profile || {}));

    profileObj.ojoType = user.profile && user.profile.ojoTypeId ? user.profile.ojoTypeId : null;

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: profileObj,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 * PATCH /api/auth/profile
 */
export async function updateProfile(req, res, next) {
  try {
    const { name, ojoTypeName, settings, profileImage, gender, username, email, currentPassword, newPassword } =
      req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Handle password change if requested
    if (newPassword) {
      // Require current password for security
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: "Current password is required to change password",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: "New password must be at least 6 characters",
        });
      }

      // Hash and update password
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // Check if username is being updated and if it's already taken
    if (username !== undefined && username !== user.username) {
      const existingUserWithUsername = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUserWithUsername) {
        return res.status(409).json({
          success: false,
          error: "Username already taken",
        });
      }
      user.username = username;
    }

    // Check if email is being updated and if it's already taken
    if (email !== undefined && email !== user.email) {
      const existingUserWithEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUserWithEmail) {
        return res.status(409).json({
          success: false,
          error: "Email already in use",
        });
      }
      user.email = email;
    }

    // Update profile fields
    if (name !== undefined) user.profile.name = name;
    if (profileImage !== undefined) user.profile.profileImage = profileImage;
    if (ojoTypeName) {
      // Import OjoType here to avoid circular imports
      const OjoType = (await import("../models/OjoType.js")).default;
      const ojoType = await OjoType.findOne({ name: ojoTypeName.toLowerCase() });
      if (ojoType) {
        user.profile.ojoTypeId = ojoType._id;
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid ojoType name",
        });
      }
    }
    if (gender !== undefined) {
      const canonical = canonicalizeGender(gender);
      if (!canonical) {
        return res.status(400).json({ success: false, error: "Invalid gender value" });
      }
      user.profile.gender = canonical;
    }
    if (settings) {
      // Merge incoming settings with existing settings instead of replacing entirely, to preserve other keys
      console.debug("[updateProfile] received settings:", settings);
      const currentSettings =
        user.profile.settings && typeof user.profile.settings.toObject === "function"
          ? user.profile.settings.toObject()
          : JSON.parse(JSON.stringify(user.profile.settings || {}));
      console.debug("[updateProfile] currentSettings:", currentSettings);
      const merged = { ...currentSettings, ...settings };
      console.debug("[updateProfile] merged settings:", merged);
      user.profile.settings = new Map(Object.entries(merged));
      console.debug("[updateProfile] settings Map created:", user.profile.settings);
    }

    await user.save();
    console.debug("[updateProfile] saved user, checking settings:", user.profile.settings);

    // Populate the OjoType and return the richer profile object
    await user.populate("profile.ojoTypeId", "name displayName persona tone");

    const profileObj =
      user.profile && typeof user.profile.toObject === "function"
        ? user.profile.toObject()
        : JSON.parse(JSON.stringify(user.profile || {}));

    profileObj.ojoType = user.profile && user.profile.ojoTypeId ? user.profile.ojoTypeId : null;

    console.debug("[updateProfile] returning profile with settings:", profileObj.settings);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: profileObj,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete user account
 * DELETE /api/auth/account
 */
export async function deleteAccount(req, res, next) {
  try {
    const userId = req.user.userId;
    console.log(`🗑️  Delete account request for userId: ${userId}`);

    // First verify user exists before deleting data
    const user = await User.findById(userId);

    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    console.log(`📧 Deleting account for user: ${user.username} (${user.email})`);

    // Import all models
    const { Task, Session, Memory, TaskSchedule, SubTask, BusyBlock, EventLog, Subcategory } =
      await import("../models/index.js");

    // Delete all user data from all collections
    const deletionResults = await Promise.allSettled([
      // Delete all tasks
      Task?.deleteMany({ userId }),
      // Delete all subtasks
      SubTask?.deleteMany({ userId }),
      // Delete all task schedules
      TaskSchedule?.deleteMany({ userId }),
      // Delete all sessions (chat history)
      Session?.deleteMany({ userId }),
      // Delete all memories (deprecated but may still have data)
      Memory?.deleteMany({ userId }),
      // Delete all busy blocks
      BusyBlock?.deleteMany({ userId }),
      // Delete all event logs
      EventLog?.deleteMany({ userId }),
      // Delete all user-created subcategories
      Subcategory?.deleteMany({ userId }),
    ]);

    // Log deletion results
    const collectionNames = [
      "Task",
      "SubTask",
      "TaskSchedule",
      "Session",
      "Memory",
      "BusyBlock",
      "EventLog",
      "Subcategory",
    ];
    deletionResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        console.log(`  ✅ Deleted ${result.value.deletedCount || 0} ${collectionNames[index]}(s)`);
      } else if (result.status === "rejected") {
        console.error(`  ❌ Failed to delete ${collectionNames[index]}:`, result.reason);
      }
    });

    // Finally delete the user
    await User.findByIdAndDelete(userId);
    console.log(`✅ Account deleted successfully for user: ${user.username}`);

    res.json({
      success: true,
      message: "Account and all associated data deleted successfully",
    });
  } catch (error) {
    console.error(`❌ Error deleting account:`, error);
    next(error);
  }
}

/**
 * Update user category priorities
 * POST /api/auth/category-priorities
 * Body: { priorities: { category_key: priority_value, ... } }
 */
export async function updateCategoryPriorities(req, res, next) {
  try {
    const { priorities } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!priorities || typeof priorities !== "object") {
      return res.status(400).json({
        success: false,
        error: "Priorities object is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Validate and set priorities (must be 1-5)
    const validatedPriorities = {};
    for (const [key, value] of Object.entries(priorities)) {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1 || numValue > 5) {
        return res.status(400).json({
          success: false,
          error: `Priority for ${key} must be a number between 1 and 5`,
        });
      }
      validatedPriorities[key] = numValue;
    }

    // Update priorities
    user.profile.priorities = {
      ...user.profile.priorities,
      ...validatedPriorities,
    };

    await user.save();

    // Convert priorities to a plain JavaScript object for response
    const savedPriorities =
      user.profile.priorities && typeof user.profile.priorities.toObject === "function"
        ? user.profile.priorities.toObject()
        : JSON.parse(JSON.stringify(user.profile.priorities || {}));

    res.json({
      success: true,
      message: "Category priorities updated successfully",
      priorities: savedPriorities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user preferences (priorities and ojoType)
 * GET /api/auth/preferences
 */
export async function getPreferences(req, res, next) {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Populate OjoType for the response
    await user.populate("profile.ojoTypeId", "name displayName persona tone");

    // Convert priorities to a plain JavaScript object (Mongoose subdocument -> plain object)
    const prioritiesDoc = user.profile.priorities;
    const priorities =
      prioritiesDoc && typeof prioritiesDoc.toObject === "function"
        ? prioritiesDoc.toObject()
        : JSON.parse(JSON.stringify(prioritiesDoc || {}));

    const ojoType = user.profile.ojoTypeId
      ? {
          name: user.profile.ojoTypeId.name,
          displayName: user.profile.ojoTypeId.displayName,
          persona: user.profile.ojoTypeId.persona,
          tone: user.profile.ojoTypeId.tone,
        }
      : null;

    // Convert settings Map to plain object.
    // Use direct Map iteration - the most reliable approach regardless of Mongoose version.
    const settings = {};
    if (user.profile.settings) {
      for (const [key, value] of user.profile.settings) {
        settings[key] = value;
      }
    }
    console.debug("[getPreferences] converted settings via Map iteration:", JSON.stringify(settings));

    // Ensure accessibility defaults exist server-side for consistency
    if (!settings.accessibility || typeof settings.accessibility !== "object") {
      console.debug("[getPreferences] accessibility missing, adding defaults");
      settings.accessibility = { timeFormat: "12h", theme: "system" };
    }

    console.debug("[getPreferences] final settings.accessibility:", JSON.stringify(settings.accessibility));

    // Scheduling preferences (added in main branch)
    const schedPrefs = user.schedulingPreferences
      ? typeof user.schedulingPreferences.toObject === "function"
        ? user.schedulingPreferences.toObject()
        : JSON.parse(JSON.stringify(user.schedulingPreferences))
      : { minGapMinutes: 10 };

    res.json({
      success: true,
      priorities,
      ojoType,
      appSettings: settings,
      schedulingPreferences: schedPrefs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update scheduling preferences (minGapMinutes, etc.)
 * PATCH /api/auth/scheduling-preferences
 */
export async function updateSchedulingPreferences(req, res, next) {
  try {
    const userId = req.user.userId;
    const { minGapMinutes } = req.body;

    if (minGapMinutes === undefined) {
      return res.status(400).json({ success: false, error: "minGapMinutes is required" });
    }

    const gap = parseInt(minGapMinutes, 10);
    if (isNaN(gap) || gap < 0 || gap > 120) {
      return res.status(400).json({ success: false, error: "minGapMinutes must be a number between 0 and 120" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.schedulingPreferences) {
      user.schedulingPreferences = {};
    }
    user.schedulingPreferences.minGapMinutes = gap;
    await user.save();

    const saved =
      typeof user.schedulingPreferences.toObject === "function"
        ? user.schedulingPreferences.toObject()
        : JSON.parse(JSON.stringify(user.schedulingPreferences));

    res.json({ success: true, schedulingPreferences: saved });
  } catch (error) {
    next(error);
  }
}
