/*
 * File: src/routes/auth.js
 * Purpose: Authentication routes (register, login, profile)
 */

import express from "express";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { generalLimiter, strictLimiter, authLimiter } from "../middlewares/rateLimiter.js";
import {
  register,
  login,
  getMe,
  updateProfile,
  updateCategoryPriorities,
  updateSchedulingPreferences,
  deleteAccount,
  getPreferences,
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
} from "../controllers/authController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// Multer setup for avatar uploads
const uploadsPath = path.join(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsPath);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 }, // 500 KB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Invalid file type"));
    cb(null, true);
  },
});

/**
 * Authentication Routes
 */

// Register new user
router.post("/register", authLimiter, register);

// Upload profile avatar (multipart/form-data with 'avatar' field)
router.post("/upload-avatar", strictLimiter, upload.single("avatar"), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const url = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
    return res.json({ success: true, url });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return res.status(500).json({ success: false, error: "Failed to upload avatar" });
  }
});
// Login user
router.post("/login", authLimiter, login);

// Get current user (protected)
router.get("/me", generalLimiter, requireAuth, getMe);

// Update user profile (protected)
router.patch("/profile", strictLimiter, requireAuth, updateProfile);

// Delete account (protected)
router.delete("/account", strictLimiter, requireAuth, deleteAccount);

// Update category priorities (protected)
router.post("/category-priorities", strictLimiter, requireAuth, updateCategoryPriorities);

// Get user preferences (protected)
router.get("/preferences", generalLimiter, requireAuth, getPreferences);

// Update scheduling preferences (minGapMinutes, etc.)
router.patch("/scheduling-preferences", strictLimiter, requireAuth, updateSchedulingPreferences);

// Memory management (primary memories the LLM uses for user context)
router.get("/memories", generalLimiter, requireAuth, getMemories);
router.post("/memories", strictLimiter, requireAuth, addMemory);
router.patch("/memories/:memoryId", strictLimiter, requireAuth, updateMemory);
router.delete("/memories/:memoryId", strictLimiter, requireAuth, deleteMemory);

export default router;
