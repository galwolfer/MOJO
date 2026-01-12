/*
 * File: src/controllers/authController.js
 * Purpose: Handles user registration, login and profile updates
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { env } from "../config/env.js";

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

    // Create user
    const user = new User({
      username,
      email,
      passwordHash,
      profile: {
        name: displayName ? String(displayName).trim() : "",
        profileImage: profileImage || null,
        tone: "friendly",
        persona: "assistant",
        gender: gender ? String(gender).toLowerCase() : "unspecified",
        settings: {},
      },
    });

    await user.save();

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
        profile: user.profile,
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
        profile: user.profile,
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

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
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
    const { name, tone, persona, settings, profileImage, gender } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update profile fields
    if (name !== undefined) user.profile.name = name;
    if (profileImage !== undefined) user.profile.profileImage = profileImage;
    if (tone) user.profile.tone = tone;
    if (persona) user.profile.persona = persona;
    if (gender !== undefined) {
      const g = String(gender).toLowerCase();
      user.profile.gender = g;
    }
    if (settings) {
      user.profile.settings = new Map(Object.entries(settings));
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      profile: user.profile,
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
