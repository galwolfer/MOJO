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

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const { username, email, password, displayName, profileImage, gender } = req.body;

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

    const ALLOWED_GENDERS = ["female", "male", "nonbinary", "prefer_not_to_say", "other", "unspecified"];

    if (gender !== undefined && gender !== null) {
      const g = String(gender).toLowerCase();
      if (!ALLOWED_GENDERS.includes(g)) {
        return res.status(400).json({ success: false, error: "Invalid gender value" });
      }
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
        gender: gender ? String(gender).toLowerCase() : "unspecified",
        settings: {},
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
      { expiresIn: JWT_EXPIRES_IN }
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
      { expiresIn: JWT_EXPIRES_IN }
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
    const { name, ojoTypeName, settings, profileImage, gender, username, email, currentPassword, newPassword } = req.body;
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
      const g = String(gender).toLowerCase();
      user.profile.gender = g;
    }
    if (settings) {
      user.profile.settings = new Map(Object.entries(settings));
    }

    await user.save();

    // Populate the OjoType and return the richer profile object
    await user.populate("profile.ojoTypeId", "name displayName persona tone");

    const profileObj =
      user.profile && typeof user.profile.toObject === "function"
        ? user.profile.toObject()
        : JSON.parse(JSON.stringify(user.profile || {}));

    profileObj.ojoType = user.profile && user.profile.ojoTypeId ? user.profile.ojoTypeId : null;

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

    // Delete user and all associated data
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Delete all tasks associated with the user
    const Task = (await import("../models/index.js")).Task;
    if (Task) {
      await Task.deleteMany({ userId });
    }

    // Delete all chat sessions associated with the user
    const ChatSession = (await import("../models/index.js")).ChatSession;
    if (ChatSession) {
      await ChatSession.deleteMany({ userId });
    }

    // Delete all chat messages associated with the user
    const ChatMessage = (await import("../models/index.js")).ChatMessage;
    if (ChatMessage) {
      await ChatMessage.deleteMany({ userId });
    }

    res.json({
      success: true,
      message: "Account and all associated data deleted successfully",
    });
  } catch (error) {
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

    res.json({
      success: true,
      message: "Category priorities updated successfully",
      priorities: user.profile.priorities,
    });
  } catch (error) {
    next(error);
  }
}
