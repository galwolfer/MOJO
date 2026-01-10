/*
 * File: src/routes/auth.js
 * Purpose: Authentication routes (register, login, profile)
 */

import express from "express";
import { register, login, getMe, updateProfile, updateCategoryPriorities } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Authentication Routes
 */

// Register new user
router.post("/register", register);

// Login user
router.post("/login", login);

// Get current user (protected)
router.get("/me", requireAuth, getMe);

// Update user profile (protected)
router.patch("/profile", requireAuth, updateProfile);

// Update category priorities (protected)
router.post("/category-priorities", requireAuth, updateCategoryPriorities);

export default router;
