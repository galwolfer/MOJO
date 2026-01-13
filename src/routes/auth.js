/*
 * File: src/routes/auth.js
 * Purpose: Authentication routes (register, login, profile)
 */

import express from "express";
import path from "path";
import multer from "multer";
import { register, login, getMe, updateProfile, updateCategoryPriorities } from "../controllers/authController.js";
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
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
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
router.post("/register", register);

// Upload profile avatar (multipart/form-data with 'avatar' field)
router.post("/upload-avatar", upload.single("avatar"), (req, res) => {
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
router.post("/login", login);

// Get current user (protected)
router.get("/me", requireAuth, getMe);

// Update user profile (protected)
router.patch("/profile", requireAuth, updateProfile);

// Update category priorities (protected)
router.post("/category-priorities", requireAuth, updateCategoryPriorities);

export default router;
